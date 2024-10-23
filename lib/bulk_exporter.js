import { loadConflux, loadFileSaver, loadJSZip } from "./dependency_loader";
import { MarkdownExporter } from "./markdown_exporter";

import streamSaver from "./streamSaver";
import { generateMarkdownHeader, parseISOString } from "./utilities";

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

  // Streamsaver.js version
  async export() {
    // Only do stream on Electron (Amplenote Desktop App)
    const fileStream = streamSaver.createWriteStream("export.zip", {
      useBlob: navigator.userAgent.indexOf("Electron") < 0,
    }); //, {
    //   size: content.size, // Makes the percentage visiable in the download. We can't do this because we don't know the total size
    // });

    const exporter = new MarkdownExporter();
    await exporter.initialize();

    // Set up conflux
    const { readable, writable } = new confluxWriter();
    const writer = writable.getWriter();

    const nameCache = [];
    for (const note of this.exportNoteList) {
      // Get next note
      const noteContent = await this._app.getNoteContent({ uuid: note.uuid });
      // Reset the exporter with the new name and content
      exporter.reset(note.name, noteContent);

      const fileName = nameCache.includes(note.name) ? note.name + `(${note.uuid})` : note.name;
      nameCache.push(fileName);

      switch (this.format) {
        case "pdf":
          const pdf = await exporter.toPDF();
          writer.write({
            name: "/" + fileName + ".pdf",
            lastModified: parseISOString(note.updated),
            stream: () => pdf.stream(),
          });
          break;
        case "docx":
          const docx = await exporter.toDOCX();
          writer.write({
            name: "/" + fileName + ".docx",
            lastModified: parseISOString(note.updated),
            stream: () => docx.stream(),
          });
          break;
        case "epub":
          const epub = await exporter.toEPUB();
          writer.write({
            name: "/" + fileName + ".epub",
            lastModified: parseISOString(note.updated),
            stream: () => epub.stream(),
          });
          break;
        case "latex":
          const latex = exporter.toLaTeX();
          writer.write({
            name: "/" + fileName + ".tex",
            lastModified: parseISOString(note.updated),
            stream: () =>
              new Response(latex, { headers: { "Content-Type": "application/x-tex" } }).body,
          });
          break;
        case "html":
          const html = exporter.toHTML();
          writer.write({
            name: "/" + fileName + ".html",
            lastModified: parseISOString(note.updated),
            stream: () => new Response(html, { headers: { "Content-Type": "text/html" } }).body,
          });
          break;
        case "md":
          const header = generateMarkdownHeader(note);
          const output = header + "\n\n" + noteContent;
          writer.write({
            name: "/" + fileName + ".md",
            lastModified: parseISOString(note.updated),
            stream: () =>
              new Response(output, { headers: { "Content-Type": "text/markdown" } }).body,
          });
          break;
      }
    }

    // more optimized pipe version
    // (Safari may have pipeTo but it's useless without the WritableStream)
    if (window.WritableStream && readable.pipeTo) {
      const pipe = readable.pipeTo(fileStream).then(() => {
        console.log("done writing");
      });
      writer.close();
      return pipe;
    }

    // Write (pipe) manually
    window.writer = fileStream.getWriter();

    const reader = readable.getReader();
    const pump = () =>
      reader.read().then((res) => (res.done ? writer.close() : writer.write(res.value).then(pump)));

    pump();
  }
}
