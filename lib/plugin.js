import { setAppInterface } from "./api_singleton";
import { BulkExporter } from "./bulk_exporter";
import { MarkdownExporter } from "./markdown_exporter";
import { generateMarkdownHeader, hasMarkdownTable } from "./utilities";

// --------------------------------------------------------------------------------------
const plugin = {
  // --------------------------------------------------------------------------------------
  constants: {
    EXPORT_OPTIONS: [
      { label: "Microsoft Word (*.docx)", value: "docx" },
      { label: "PDF", value: "pdf" },
      { label: "Web Page (*.html)", value: "html" },
      { label: "ePub", value: "epub" },
      { label: "LaTeX (*.tex)", value: "latex" },
      { label: "Markdown (*.md)", value: "md" },
    ],
  },

  renderEmbed(app, ...args) {
    return `
    ${args}
    <iframe src="https://jimmywarting.github.io/StreamSaver.js/mitm.html?version=2.0.0"></iframe>
    `;
  },

  // Exporter Wizard
  appOption: {
    "Check CSP": {
      run(app) {
        const insertEmbedAction = app.insertNoteContent(
          { uuid: app.context.noteUUID },
          `<object data="plugin://${app.context.pluginUUID}?embed=math&tags=hello,perro" data-aspect-ratio="2" />
Hello
<object data="plugin://${app.context.pluginUUID}?embed=fart&tags=Hi" data-aspect-ratio="2" />`
        );
      },
    },
    "Bulk Export": {
      async run(app) {
        setAppInterface(app);
        const parsedUrl = new URL(app.context.url);

        const urlGroup = parsedUrl.searchParams.get("group");
        const urlQuery = parsedUrl.searchParams.get("query");
        const urlTag = parsedUrl.searchParams.get("tag");

        const [query, tag, exportAs, action] = await app.prompt("Bulk Export Wizard", {
          inputs: [
            {
              label: "Name Search (not a full-text content search)",
              type: "string",
              value: urlQuery || "",
            },
            { label: "Tags", type: "tags", value: urlTag },
            { label: "Export As", type: "select", options: plugin.constants.EXPORT_OPTIONS },
          ],
          actions: [
            {
              label:
                "Export Whole Notebook (warning: this will be slow and may crash your amplenote)",
              icon: "cloud_download",
              value: "full-export",
            },
            {
              label: "Export By Export Tag (" + (app.settings["Export Tag"] || "export") + ")",
              icon: "book",
              value: "export-by-tag",
            },
          ],
        });

        debugger;

        const filterParams = {
          ...(query ? { query } : {}),
          ...(tag ? { tag } : {}),
        };

        if (!action) {
          // Export Cancelled
          return;
        }

        let noteList;
        if (action === "full-export") {
          // Whole notebook Bulk Export
          noteList = await app.notes.filter();
        } else if (action === "export-by-tag") {
          noteList = await app.notes.filter({ tag: "export" });
        } else if (action === -1) {
          // Submit Query Export
          noteList = await app.notes.filter(filterParams);
        }

        if (!noteList || noteList.length === 0) {
          app.alert("No notes found with that query!");
          return;
        }

        const exporter = new BulkExporter(app, noteList, exportAs);
        await exporter.initialize();
        await exporter.export();
        console.log("Done");
      },
    },
    // Unfortunately we can't do this because the API doesn't do full-text search like the amplenote search interface does
    // "Export Current Search": {
    //   check(app) {
    //     const parsedUrl = new URL(app.context.url);
    //     const hasSearch =
    //       parsedUrl.searchParams.get("query") ||
    //       parsedUrl.searchParams.get("group") ||
    //       parsedUrl.searchParams.get("tag");
    //     return hasSearch && parsedUrl.pathname.match(/\/notes\/[A-z0-9-]+/);
    //   },
    //   async run(app) {
    //     const parsedUrl = new URL(app.context.url);

    //     const group = parsedUrl.searchParams.get("group");
    //     const query = parsedUrl.searchParams.get("query");
    //     const tag = parsedUrl.searchParams.get("tag");

    //     debugger;
    //     if (group || query || tag) {
    //       const filterParams = {
    //         ...(group ? { group } : {}),
    //         ...(query ? { query } : {}),
    //         ...(tag ? { tag } : {}),
    //       };
    //       const resultNotes = await app.filterNotes(filterParams);
    //       await app.alert(resultNotes.map((note) => note.name).join(" AND "));
    //     }
    //     // const insertEmbedAction = app.insertNoteContent({uuid: app.context.noteUUID}, `<object data="plugin://${ app.context.pluginUUID }" data-aspect-ratio="2" />`);
    //   },
    // },
  },

  // --------------------------------------------------------------------------
  // https://www.amplenote.com/help/developing_amplenote_plugins#noteOption
  noteOption: {
    "Export as...": {
      check(app, noteUUID) {
        return "Export as...";
      },
      async run(app, noteUUID) {
        setAppInterface(app);
        const [format, action] = await app.prompt("Export Options", {
          inputs: [
            {
              type: "select",
              options: plugin.constants.EXPORT_OPTIONS,
            },
          ],
          actions: [{ icon: "file_download", label: "Export", value: "export" }],
        });
        if (action === "export" || action === -1) {
          const note = await app.notes.find({ uuid: noteUUID });

          const exporter = new MarkdownExporter(note.name, await note.content());
          await exporter.initialize();

          switch (format) {
            case "docx":
              exporter.saveDOCX(note.name + ".docx");
              break;
            case "pdf":
              exporter.savePDF(note.name + ".pdf");
              break;
            case "html":
              exporter.saveHTML(note.name + ".html");
              break;
            case "epub":
              exporter.saveEPUB(note.name + ".epub");
              break;
            case "latex":
              exporter.saveLaTeX(note.name + ".tex");
              break;
            case "md":
              const markdown = exporter.toMarkdown();
              const header = generateMarkdownHeader(note);
              const output = header + "\n\n" + markdown;
              const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
              app.saveFile(blob, note.name + ".md");
              break;
          }
        }
      },
    },
    "Export as PDF": {
      run: async function (app, noteUUID) {
        setAppInterface(app);
        const note = await app.notes.find({ uuid: noteUUID });

        const exporter = new MarkdownExporter(note.name, await note.content());
        await exporter.initialize();

        exporter.savePDF(note.name + ".pdf");
      },
    },
    "Export as DOCX": {
      run: async function (app, noteUUID) {
        setAppInterface(app);
        const note = await app.notes.find({ uuid: noteUUID });

        const exporter = new MarkdownExporter(note.name, await note.content());
        await exporter.initialize();

        exporter.saveDOCX(note.name + ".docx");
      },
    },
  },

  // --------------------------------------------------------------------------
  // Used for exporting tables
  replaceText: {
    "Export Table as CSV": {
      check(app, text) {
        console.log("Checking: " + app.context.selectionContent);
        return hasMarkdownTable(app.context.selectionContent);
      },
      async run(app, text) {
        setAppInterface(app);
        const exporter = new MarkdownExporter("Table", app.context.selectionContent);
        await exporter.initialize();

        exporter.saveCSVIfTable();
        return false;
      },
    },
  },

  // There are several other entry points available, check them out here: https://www.amplenote.com/help/developing_amplenote_plugins#Actions
  // You can delete any of the insertText/noteOptions/replaceText keys if you don't need them
};

export default plugin;
