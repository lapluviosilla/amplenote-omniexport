import { MarkdownExporter } from "./markdown_exporter";

// --------------------------------------------------------------------------------------
const plugin = {
  // --------------------------------------------------------------------------------------
  constants: {},

  // --------------------------------------------------------------------------
  // https://www.amplenote.com/help/developing_amplenote_plugins#insertText
  insertText: {},

  // --------------------------------------------------------------------------
  // https://www.amplenote.com/help/developing_amplenote_plugins#noteOption
  noteOption: {
    "Export as...": {
      check(app, noteUUID) {
        return "Export as...";
      },
      async run(app, noteUUID) {
        const [format, action] = await app.prompt("Export Options", {
          inputs: [
            {
              type: "select",
              options: [
                { label: "Microsoft Word (*.docx)", value: "docx" },
                { label: "PDF", value: "pdf" },
                { label: "Web Page (*.html)", value: "html" },
                { label: "ePub", value: "epub" },
                { label: "LaTeX (*.tex)", value: "latex" },
              ],
            },
          ],
          actions: [{ icon: "file_download", label: "Export", value: "export" }],
        });
        debugger;
        if (action === "export") {
          const note = await app.notes.find({ uuid: noteUUID });

          const exporter = new MarkdownExporter(note.name, await note.content());
          await exporter.initialize();

          switch (format) {
            case "docx":
              exporter.toDOCX();
              break;
            case "pdf":
              exporter.toPDF();
              break;
            case "html":
              exporter.toHTMLFile();
            case "epub":
              exporter.toEPUB();
            case "latex":
              exporter.toLaTeXFile();
          }
        }
      },
    },
    "Export as PDF": {
      run: async function (app, noteUUID) {
        const note = await app.notes.find({ uuid: noteUUID });

        const exporter = new MarkdownExporter(note.name, await note.content());
        await exporter.initialize();

        exporter.toPDF();
      },
    },
    "Export as LaTeX": {
      run: async function (app, noteUUID) {
        const note = await app.notes.find({ uuid: noteUUID });

        const exporter = new MarkdownExporter(note.name, await note.content());
        await exporter.initialize();

        exporter.toLaTeXFile();
      },
    },
    "Export as DOCX": {
      run: async function (app, noteUUID) {
        const note = await app.notes.find({ uuid: noteUUID });

        const exporter = new MarkdownExporter(note.name, await note.content());
        await exporter.initialize();

        exporter.toDOCX();
      },
    },
    "Export as HTML": {
      run: async function (app, noteUUID) {
        const note = await app.notes.find({ uuid: noteUUID });

        const exporter = new MarkdownExporter(note.name, await note.content());
        await exporter.initialize();

        exporter.toHTMLFile();
      },
    },
  },

  // --------------------------------------------------------------------------
  // https://www.amplenote.com/help/developing_amplenote_plugins#replaceText
  replaceText: {},

  // There are several other entry points available, check them out here: https://www.amplenote.com/help/developing_amplenote_plugins#Actions
  // You can delete any of the insertText/noteOptions/replaceText keys if you don't need them
};

export default plugin;
