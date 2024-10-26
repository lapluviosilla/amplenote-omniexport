import { loadConflux, loadFileSaver, loadJSZip } from "./dependency_loader";
import { MarkdownExporter } from "./markdown_exporter";

import streamSaver from "./streamSaver";
import { escapeCSVPart, generateMarkdownHeader, parseISOString } from "./utilities";

// import { showSaveFilePicker } from "native-file-system-adapter";
// import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10/+esm";

// Lazy loaded dependencies
let confluxWriter;

/** Bulk Exporter
 * options
 * - directory: "tag" - by first tag, "flat" - all in root directory
 */
export class BulkExporter {
  constructor(app, noteList, format, options = {}) {
    this._app = app; // Keep app reference for loading notes
    this.exportNoteList = noteList;
    this.format = format;
    this.options = { ...{ directory: "tag" }, ...options };
  }

  async initialize() {
    await this._ensureBaseDependenciesLoaded();
  }

  async _ensureBaseDependenciesLoaded() {
    [{ Writer: confluxWriter }] = await Promise.all([
      // loadStreamSaver(),
      loadConflux(),
    ]);
    // JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10/+esm")).default;
  }

  _logProgress(completed, message) {
    if (this.options.progressCallback) this.options.progressCallback(completed, message);
  }

  // Streamsaver.js version
  async export() {
    if (this.format === "csv") {
      // we don't need a zip file for csv, so export it separately
      this.exportCSV();
      return;
    }
    // Only do stream on Electron (Amplenote Desktop App), otherwise a blob export which loads everything into memory first
    const fileStream = streamSaver.createWriteStream("export.zip", {
      useBlob: navigator.userAgent.indexOf("Electron") < 0,
    }); //, {
    //   size: content.size, // Makes the percentage visiable in the download. We can't do this because we don't know the total size
    // });

    if (this.options.progressCallback)
      this.options.progressCallback(
        0,
        `Starting Bulk Export of ${this.exportNoteList.length} notes`
      );

    const exporter = new MarkdownExporter();
    await exporter.initialize();

    // Set up conflux
    const { readable, writable } = new confluxWriter();
    const writer = writable.getWriter();

    // Start piping immediately
    let pipePromise;
    if (window.WritableStream && readable.pipeTo) {
      pipePromise = readable.pipeTo(fileStream).then(() => {
        console.log("Export completed");
      });
    } else {
      // Fallback for browsers without pipeTo support - less efficient
      const outputWriter = fileStream.getWriter();
      const reader = readable.getReader();
      const pump = () =>
        reader
          .read()
          .then((res) =>
            res.done ? outputWriter.close() : outputWriter.write(res.value).then(pump)
          );
      pump();
    }

    let filesDone = 0;
    const nameCache = [];
    for (const note of this.exportNoteList) {
      // Get next note
      const noteContent = await this._app.getNoteContent({ uuid: note.uuid });

      let name = note.name || note.uuid;
      // Reset the exporter with the new name and content
      exporter.reset(note.name, noteContent);

      let sanitizedName = name.replace(/[<>:"/\\|?*]+/g, "_");

      let fileName;

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

      switch (this.format) {
        case "pdf":
          const pdf = await exporter.toPDF();
          await writer.write({
            name: "/" + fileName + ".pdf",
            lastModified: parseISOString(note.updated),
            stream: () => pdf.stream(),
          });
          break;
        case "docx":
          const docx = await exporter.toDOCX();
          await writer.write({
            name: "/" + fileName + ".docx",
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
          const latex = exporter.toLaTeX();
          await writer.write({
            name: "/" + fileName + ".tex",
            lastModified: parseISOString(note.updated),
            stream: () =>
              new Response(latex, { headers: { "Content-Type": "application/x-tex" } }).body,
          });
          break;
        case "html":
          const html = exporter.toHTML();
          await writer.write({
            name: "/" + fileName + ".html",
            lastModified: parseISOString(note.updated),
            stream: () => new Response(html, { headers: { "Content-Type": "text/html" } }).body,
          });
          break;
        case "md":
          const header = generateMarkdownHeader(note);
          const output = header + "\n\n" + noteContent;
          await writer.write({
            name: "/" + fileName + ".md",
            lastModified: parseISOString(note.updated),
            stream: () =>
              new Response(output, { headers: { "Content-Type": "text/markdown" } }).body,
          });
          break;
      }

      filesDone++;
      this._logProgress(filesDone, `${fileName}.${this.format}`);
      // Add a 100ms delay to observe streaming behavior
      // await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this._logProgress(filesDone, "Export Complete");

    writer.close();

    // Wait for the piping to finish
    if (pipePromise) {
      await pipePromise;
    } else {
      console.log("Export completed");
    }
  }

  async exportCSV() {
    const csvHeader = "UUID,Title,Tags,Content\n";
    // const csvParts = [csvHeader];

    const fileStream = streamSaver.createWriteStream("export.csv", {
      useBlob: navigator.userAgent.indexOf("Electron") < 0,
    });

    const notes = this.exportNoteList.values();
    const encoder = new TextEncoder(); // For encoding strings to Uint8Array

    const app = this._app;
    const myReadable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(csvHeader));
      },
      async pull(controller) {
        const { done, value } = notes.next();
        if (done) return controller.close();

        const content = await app.getNoteContent({ uuid: value.uuid });
        const tags = value.tags ? value.tags.join() : "";
        const csvParts = [value.uuid, value.title, tags, content];
        const line = csvParts.map((part) => escapeCSVPart(part)).join() + "\n";
        return controller.enqueue(encoder.encode(line));
      },
    });
    myReadable.pipeTo(fileStream);
  }
}
