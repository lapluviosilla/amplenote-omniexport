import { setAppInterface } from "./api_singleton";
import { BulkExporter } from "./bulk_exporter";
import { MarkdownExporter } from "./markdown_exporter";
import { generateMarkdownHeader, hasMarkdownTable } from "./utilities";
import exportProgress from "../templates/exportProgress.html";

async function createProgressNoteAndEmbed(app) {
  const noteNameDate = new Date().toISOString().slice(0, 16).replace(/-/g, "/").replace("T", " ");
  const noteHandle = await app.notes.create("Bulk Export on " + noteNameDate);
  const embedHTML = `<object data="plugin://${app.context.pluginUUID}" data-aspect-ratio="1.2" />`;

  await noteHandle.insertContent(embedHTML);
  app.navigate(await noteHandle.url());
}

const _exportStatus = {
  completed: 0,
  total: 0,
  active: false,
  log: [],
  logBuffer: [],
};

// --------------------------------------------------------------------------------------
const plugin = {
  // --------------------------------------------------------------------------------------
  constants: {
    EXPORT_OPTIONS: [
      { label: "Microsoft Word (*.docx)", value: "docx" },
      { label: "PDF (*.pdf)", value: "pdf" },
      { label: "Web Page (*.html)", value: "html" },
      { label: "ePub (*.epub)", value: "epub" },
      { label: "LaTeX (*.tex)", value: "latex" },
      { label: "Markdown (*.md)", value: "md" },
      { label: "CSV (*.csv)", value: "csv" },
    ],
    BULK_EXPORT_OPTIONS: [
      { label: "Microsoft Word (*.docx)", value: "docx" },
      { label: "PDF (*.pdf)", value: "pdf" },
      { label: "Web Page (*.html)", value: "html" },
      { label: "ePub (*.epub)", value: "epub" },
      { label: "ePub Single Book (*.epub)", value: "epub-single" },
      { label: "LaTeX (*.tex)", value: "latex" },
      { label: "Markdown (*.md)", value: "md" },
      { label: "CSV (*.csv)", value: "csv" },
    ],
  },

  renderEmbed(app, ...args) {
    return exportProgress;
  },

  async onEmbedCall(app, ...args) {
    // Handle Delete Note Request
    debugger;
    if (args.length > 0 && args[0] === "deleteNote") {
      if (app.context.noteUUID) {
        const success = await app.deleteNote({ uuid: app.context.noteUUID });
        app.navigate("https://www.amplenote.com/notes");
        return success;
      }
      return false;
    }

    if (args.length > 0 && args[0] === "saveLog") {
      app.replaceNoteContent({ uuid: app.context.noteUUID }, _exportStatus.log.join("\n"));
      return;
    }

    // Provide Current Progress, Completed, Total, and New Logs
    const response = {
      completed: _exportStatus.completed,
      total: _exportStatus.total,
      logs: _exportStatus.logBuffer.slice(), // Send a copy of the buffer
    };

    // Clear the log buffer after sending
    _exportStatus.logBuffer = [];

    return response;
  },

  // Exporter Wizard
  appOption: {
    "Bulk Export": {
      check(app) {
        return !_exportStatus.active;
      },
      async run(app) {
        setAppInterface(app);

        let parsedUrl;
        let urlGroup = null;
        let urlQuery = null;
        let urlTag = null;

        try {
          parsedUrl = new URL(app.context.url);
          urlGroup = parsedUrl.searchParams.get("group");
          urlQuery = parsedUrl.searchParams.get("query");
          urlTag = parsedUrl.searchParams.get("tag");
        } catch (error) {
          // Log the error for debugging purposes
          console.warn("Invalid URL provided:", app.context.url);
          // Variables remain null
        }

        let promptName = "Bulk Export Wizard";

        if (navigator.userAgent.indexOf("Electron") < 0) {
          promptName +=
            "\nWarning: Due to limitations of the plugin api and browser restrictions this works best on the desktop app." +
            "\nUsing this in the browser could consume too much memory and crash amplenote." +
            "\nIf you would like to use this on browser then please upvote the plugin and petition amplenote for the plugin api support.";
        }

        const [query, tag, exportAs, action] = await app.prompt(promptName, {
          inputs: [
            {
              label: "Name Search (not a full-text content search)",
              type: "string",
              value: urlQuery || "",
            },
            { label: "Tags", type: "tags", value: urlTag || "" },
            {
              label: "Export As (required)",
              type: "select",
              options: plugin.constants.BULK_EXPORT_OPTIONS,
            },
          ],
          actions: [
            {
              label: "Export Whole Notebook (warning: this could take a while)",
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

        if (!action || exportAs === null) {
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

        _exportStatus.completed = 0;
        _exportStatus.total = noteList.length;
        _exportStatus.log = [];
        _exportStatus.logBuffer = [];
        _exportStatus.active = true;

        try {
          await createProgressNoteAndEmbed(app);

          function progressCallback(completed, logMessage) {
            _exportStatus.completed = completed;
            if (logMessage) {
              _exportStatus.log.push(logMessage);
              _exportStatus.logBuffer.push(logMessage);
            }
          }

          const exporter = new BulkExporter(app, noteList, exportAs, { progressCallback });
          await exporter.initialize();
          await exporter.export();
          _exportStatus.active = false;
        } catch (error) {
          app.alert("Export failed: " + error);
          _exportStatus.active = false;
        }
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
        const format = await app.prompt("Export Options", {
          inputs: [
            {
              type: "select",
              options: plugin.constants.EXPORT_OPTIONS,
            },
          ],
        });
        if (format) {
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
