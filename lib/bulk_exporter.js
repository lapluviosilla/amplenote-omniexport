import { loadConflux, loadEpubGenMemory } from "./dependency_loader";
import { MarkdownExporter } from "./markdown_exporter";

import streamSaver from "./streamSaver";
import {
  addTitleToCoverImage,
  escapeCSVPart,
  generateMarkdownHeader,
  parseISOString,
  saveAs,
  startConfluxStream,
} from "./utilities";

import styles from "../styles/markdownHtml.css";
import ePubCover from "../images/ePubCover.png";

// import { showSaveFilePicker } from "native-file-system-adapter";

// Lazy loaded dependencies
let confluxWriter;
let epubGen;

/** Bulk Exporter
 * options
 * - directory: "tag" - by first tag, "flat" - all in root directory
 * - includeAttachments: Whether to download attachments or not.
 */
export class BulkExporter {
  constructor(app, noteList, format, options = {}) {
    this._app = app; // Keep app reference for loading notes
    this.exportNoteList = noteList;
    this.format = format;
    this.options = { ...{ directory: "tag", includeAttachments: true }, ...options };
  }

  async initialize() {
    await this._ensureBaseDependenciesLoaded();
  }

  async _ensureBaseDependenciesLoaded() {
    const result = await loadConflux();
    ({ Writer: confluxWriter } = result);
    // JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10/+esm")).default;
  }

  _logProgress(completed, message) {
    if (this.options.progressCallback) this.options.progressCallback(completed, message);
  }

  async _loadEpubGen() {
    if (!epubGen) epubGen = await loadEpubGenMemory();
  }

  // Streamsaver.js version
  async export() {
    if (this.format === "csv") {
      // we don't need a zip file for csv, so export it separately
      await this.exportCSV();
      return;
    }
    if (this.format === "epub-single") {
      await this.exportEpubNotebook();
      return;
    }

    // Get markdown exporter ready
    const exporter = new MarkdownExporter();
    await exporter.initialize();

    this._logProgress(0, `Starting Bulk Export of ${this.exportNoteList.length} notes`);
    // Start zip stream
    const { writable, pipePromise } = await startConfluxStream();
    const writer = writable.getWriter();

    let filesDone = 0;
    const nameCache = [];

    // Start processing notes and streaming them
    for (const note of this.exportNoteList) {
      // Get next note
      const noteContent = await this._app.getNoteContent({ uuid: note.uuid });

      let name = note.name || note.uuid;
      // Reset the exporter with the new name and content
      exporter.reset(note.name, noteContent);

      let sanitizedName = name.replace(/[<>:"/\\|?*]+/g, "_");

      let fileName;

      // Rename duplicate file names
      if (nameCache.includes(sanitizedName)) {
        fileName = sanitizedName + `(${note.uuid})`;
        this._logProgress(
          filesDone,
          `${sanitizedName}.${this.format} already exists! Renaming to ${fileName}.${this.format}.`
        );
      } else {
        fileName = sanitizedName;
      }

      nameCache.push(fileName);

      // Process based on format
      // TODO: Switch attachment strategy to silent if attachments aren't downloaded
      switch (this.format) {
        case "pdf":
          const pdf = await exporter.toPDF();
          await writer.write({
            name: fileName + ".pdf",
            lastModified: parseISOString(note.updated),
            stream: () => pdf.stream(),
          });
          break;
        case "docx":
          const docx = await exporter.toDOCX();
          await writer.write({
            name: fileName + ".docx",
            lastModified: parseISOString(note.updated),
            stream: () => docx.stream(),
          });
          break;
        case "epub":
          const epub = await exporter.toEPUB();
          await writer.write({
            name: fileName + ".epub",
            lastModified: parseISOString(note.updated),
            stream: () => epub.stream(),
          });
          break;
        case "latex":
          const latex = await exporter.toLaTeX();
          // Get the latex images
          // const { outLatex, images } = await processLaTeXForImages(latex, note.uuid + "/");
          await writer.write({
            name: fileName + ".tex",
            lastModified: parseISOString(note.updated),
            stream: () =>
              new Response(latex, { headers: { "Content-Type": "application/x-tex" } }).body,
          });
          // Write out the images
          // for (const image of images) {
          //   await writer.write({
          //     name: "images/" + image.filename,
          //     stream: () => image.blob.stream(),
          //   });
          // }
          break;
        case "html":
          exporter.assetExporter.setAssetStrategy("local", "local");
          const html = await exporter.toHTML();
          await writer.write({
            name: fileName + ".html",
            lastModified: parseISOString(note.updated),
            stream: () => new Response(html, { headers: { "Content-Type": "text/html" } }).body,
          });
          break;
        case "md":
          exporter.assetExporter.setAssetStrategy("local", "local");
          const markdown = await exporter.toMarkdown();
          const header = generateMarkdownHeader(note);
          const output = header + "\n\n" + markdown;
          await writer.write({
            name: fileName + ".md",
            lastModified: parseISOString(note.updated),
            stream: () =>
              new Response(output, { headers: { "Content-Type": "text/markdown" } }).body,
          });
          break;
      }

      filesDone++;
      this._logProgress(filesDone, `${fileName}.${this.format}`);
    }
    writer.releaseLock();

    let assetStream;
    // Write Attachments
    // TODO: Update progress for attachments
    if (this.options.includeAttachments) {
      assetStream = exporter.assetExporter.streamLocalAssets();
    } else {
      assetStream = exporter.assetExporter.streamLocalImages();
    }

    assetStream.pipeTo(writable); // Write the assets

    this._logProgress(filesDone, "Export Complete");

    // Wait for the piping to finish
    if (pipePromise) {
      await pipePromise;
    } else {
      console.log("Export completed");
    }
  }

  async exportEpubNotebook() {
    await this._loadEpubGen();
    const title = await this._app.prompt("EPub Options", {
      inputs: [{ label: "Book Title (will be embedded in cover)", type: "string" }],
    });
    if (!title) return; // user cancelled

    this._logProgress(0, `Starting ePub Export of ${this.exportNoteList.length} notes`);
    const newCover = await addTitleToCoverImage(ePubCover, title);

    const exporter = new MarkdownExporter();
    await exporter.initialize();
    exporter.assetExporter.setAssetStrategy("proxify", "silent");

    let notesProcessed = 0;
    const chapterLoaders = this.exportNoteList.map(async (note) => {
      exporter.reset(note.name || "", await this._app.getNoteContent({ uuid: note.uuid }));
      notesProcessed++;
      this._logProgress(notesProcessed, note.name || "");
      return { title: note.name || "", content: await exporter.toHTML(false) };
    });
    const chapters = await Promise.all(chapterLoaders);

    this._logProgress(notesProcessed, "Building eBook");
    const book = new epubGen.EPub(
      {
        title: title,
        css: styles,
        cover: new File([newCover], "cover.png", { type: "image/png" }),
        ignoreFailedDownloads: true,
      },
      chapters
    );
    const blob = await book.genEpub();
    saveAs(blob, title.replace(/[^A-Za-z0-9 ]/g, "_") + ".epub");
    this._logProgress(notesProcessed, "Export Complete");
  }

  async exportCSV() {
    const csvHeader = "UUID,Title,Tags,Content\n";
    // const csvParts = [csvHeader];

    const fileStream = streamSaver.createWriteStream("export.csv", {
      useBlob: navigator.userAgent.indexOf("Electron") < 0,
    });

    const notes = this.exportNoteList.values();
    const encoder = new TextEncoder(); // For encoding strings to Uint8Array

    this._logProgress(0, `Starting CSV Export of ${this.exportNoteList.length} notes`);

    const app = this._app;
    let notesExported = 0;
    const log = (complete, message) => this._logProgress(complete, message);
    const myReadable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(csvHeader));
      },
      async pull(controller) {
        const { done, value } = notes.next();
        if (done) return controller.close();

        const content = await app.getNoteContent({ uuid: value.uuid });
        const tags = value.tags ? value.tags.join() : "";
        const csvParts = [value.uuid, value.name, tags, content];
        const line = csvParts.map((part) => escapeCSVPart(part)).join() + "\n";
        notesExported++;
        log(notesExported, value.name);
        return controller.enqueue(encoder.encode(line));
      },
    });
    await myReadable.pipeTo(fileStream);
    this._logProgress(notesExported, "Export Complete");
  }
}
