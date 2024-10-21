import { loadConflux, loadFileSaver, loadJSZip } from "./dependency_loader";
import { MarkdownExporter } from "./markdown_exporter";

import streamSaver from "./streamSaver";

// import { showSaveFilePicker } from "native-file-system-adapter";
// import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10/+esm";

// Lazy loaded dependencies
let confluxWriter;

/** Bulk Exporter
 * options
 * - directory: "tag" - by first tag, "flat" - all in root directory
 */
export class BulkExporter {
  constructor(noteList, format, options = {}) {
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

  // async export() {
  //   const fileHandle = await showSaveFilePicker({
  //     _preferPolyfill: false,
  //     suggestedName: "export.zip",
  //     types: [{ accept: { "application/zip": [".zip"] } }],
  //     excludeAcceptAllOption: false, // default
  //   });

  //   // Look at what extension they chosen
  //   const extensionChosen = fileHandle.name.split(".").pop();

  //   const fileStream = fileHandle.createWritable();

  //   const { readable, writable } = new confluxWriter();
  //   const writer = writable.getWriter();

  //   writer.write({
  //     name: "/cat.txt",
  //     lastModified: new Date(0),
  //     stream: () => new Response("mjau").body,
  //   });

  //   writer.write({
  //     name: "/folder/dog.txt",
  //     lastModified: new Date(0),
  //     stream: () => new Response("woof").body,
  //   });

  //   //  more optimized pipe version
  //   // (Safari may have pipeTo but it's useless without the WritableStream)
  //   if (window.WritableStream && readable.pipeTo) {
  //     const pipe = readable.pipeTo(fileStream).then(() => {
  //       console.log("done writing");
  //     });
  //     writer.close();
  //   }

  //   // Write (pipe) manually
  //   window.writer = fileStream.getWriter();

  //   const reader = readable.getReader();
  //   const pump = () =>
  //     reader.read().then((res) => (res.done ? writer.close() : writer.write(res.value).then(pump)));

  //   pump();
  //   // see FileSaver.js
  //   // saveAs(content, "example.zip");
  // }

  // Streamsaver version
  async export() {
    const fileStream = streamSaver.createWriteStream("export.zip"); //, {
    //   size: content.size, // Makes the percentage visiable in the download
    // });

    const exporter = new MarkdownExporter();
    await exporter.initialize();

    // Set up conflux
    const { readable, writable } = new confluxWriter();
    const writer = writable.getWriter();

    for (note in this.exportNoteList) {
      // Get next note
      const noteContent = await mockApp.getNoteContent(note);
      // Reset the exporter with the new name and content
      exporter.reset(note.name, noteContent);
    }

    writer.write({
      name: "/cat.txt",
      lastModified: new Date(0),
      stream: () => new Response("mjau").body,
    });

    writer.write({
      name: "/folder/dog.txt",
      lastModified: new Date(0),
      stream: () => new Response("woof").body,
    });

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
    // see FileSaver.js
    // saveAs(content, "example.zip");
  }
}
