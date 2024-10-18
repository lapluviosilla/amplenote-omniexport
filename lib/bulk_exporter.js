import { loadConflux, loadFileSaver, loadJSZip, loadStreamSaver } from "./dependency_loader";

// import { showSaveFilePicker } from "native-file-system-adapter";
// import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10/+esm";

// Lazy loaded dependencies
let streamSaver, confluxWriter;
export class BulkExporter {
  constructor() {
    // this.title = title;
    // this.markdownText = markdownText;
    // this.htmlContent = "";
  }

  async initialize() {
    await this._ensureBaseDependenciesLoaded();
  }

  async _ensureBaseDependenciesLoaded() {
    [streamSaver, { Writer: confluxWriter }] = await Promise.all([
      loadStreamSaver(),
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
    // Set up conflux
    const { readable, writable } = new confluxWriter();
    const writer = writable.getWriter();

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
      return pipe;
      // writer.close();
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
