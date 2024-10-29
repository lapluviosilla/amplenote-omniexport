import { setAppInterface } from "./api_singleton";
import { BulkExporter } from "./bulk_exporter";
import { MarkdownExporter } from "./markdown_exporter";
import { generateMarkdownHeader, hasMarkdownTable, parseISOString } from "./utilities";
import exportProgress from "../templates/exportProgress.html";

async function createProgressNoteAndEmbed(app) {
  const noteNameDate = new Date().toISOString().slice(0, 16).replace(/-/g, "/").replace("T", " ");
  const noteHandle = await app.notes.create("Bulk Export on " + noteNameDate);
  const embedHTML = `<object data="plugin://${app.context.pluginUUID}" data-aspect-ratio="1.2" />`;

  await noteHandle.insertContent(embedHTML);
  app.navigate(await noteHandle.url());
}

// const plugin._exportStatus = {
//   completed: 0,
//   total: 0,
//   active: false,
//   log: [],
//   logBuffer: [],
// };

// --------------------------------------------------------------------------------------
const plugin = {
  _exportStatus: {
    completed: 0,
    total: 0,
    active: false,
    log: [],
    logBuffer: [],
  },
  // --------------------------------------------------------------------------------------
  constants: {
    DEFAULT_EXPORT_TAG: "system/export",
    SETTING_DISABLE_EXPORT_TAG_REMOVAL:
      "Keep Export Tag after Export? (set to true to disable removal of the tag)",
    EXPORT_OPTIONS: [
      { label: "Microsoft Word (*.docx)", value: "docx" },
      { label: "PDF (*.pdf)", value: "pdf" },
      { label: "Web Page (*.html)", value: "html" },
      { label: "ePub (*.epub)", value: "epub" },
      { label: "LaTeX (*.tex)", value: "latex" },
      { label: "Markdown (*.md)", value: "md" },
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
    if (args.length > 0 && args[0] === "deleteNote") {
      if (app.context.noteUUID) {
        const success = await app.deleteNote({ uuid: app.context.noteUUID });
        app.navigate("https://www.amplenote.com/notes");
        return success;
      }
      return false;
    }

    if (args.length > 0 && args[0] === "saveLog") {
      if (app.context.noteUUID)
        app.replaceNoteContent({ uuid: app.context.noteUUID }, plugin._exportStatus.log.join("\n"));
      return;
    }

    // Provide Current Progress, Completed, Total, and New Logs
    const response = {
      completed: plugin._exportStatus.completed,
      total: plugin._exportStatus.total,
      logs: plugin._exportStatus.logBuffer.slice(), // Send a copy of the buffer
    };

    // Clear the log buffer after sending
    plugin._exportStatus.logBuffer = [];

    return response;
  },

  // Exporter Wizard
  appOption: {
    "Bulk Export": {
      check(app) {
        return !plugin._exportStatus.active;
      },
      async run(app) {
        setAppInterface(app);

        let parsedUrl;
        let urlGroup = null;
        let urlQuery = null;
        let urlTag = null;
        let urlUpdatedAfterDays = null;
        let urlUpdatedAfterEnd = null;
        let dateFilterStart = null;
        let dateFilterEnd = null;

        try {
          parsedUrl = new URL(app.context.url);
          urlGroup = parsedUrl.searchParams.get("group");
          urlQuery = parsedUrl.searchParams.get("query");
          urlTag = parsedUrl.searchParams.get("tag");
          urlUpdatedAfterDays = parsedUrl.searchParams.get("updatedAfterDays");
          urlUpdatedAfterEnd = parsedUrl.searchParams.get("updatedAfterEnd");

          if (urlUpdatedAfterDays) {
            const dateFilterEndEpoch = urlUpdatedAfterEnd || Date.now() / 1000;
            dateFilterEnd = new Date(dateFilterEndEpoch * 1000);
            dateFilterStart = new Date((dateFilterEndEpoch - 86400 * urlUpdatedAfterDays) * 1000); // 86,400 is a day in epoch time
          }
        } catch (error) {
          // Log the error for debugging purposes
          console.warn("Invalid URL provided:", app.context.url);
          // Variables remain null
        }

        let promptName = "Bulk Export Wizard";

        if (dateFilterStart) {
          const startDateStr = dateFilterStart.toDateString().slice(4, 10);
          const endDateStr = dateFilterEnd.toDateString().slice(4, 10);
          promptName +=
            "\n* Filtering notes between " +
            startDateStr +
            " and " +
            endDateStr +
            " because of graph filter.";
        }

        if (navigator.userAgent.indexOf("Electron") < 0) {
          promptName +=
            "\n\nWarning: Due to limitations of the plugin api and browser restrictions this works best on the desktop app." +
            "\nUsing this in the browser could consume too much memory and crash amplenote." +
            "\nIf you would like to use this on browser then please upvote the plugin and petition amplenote for the plugin api support.";
        }

        const [query, tag, group, exportAs, includeAttachments, action] = await app.prompt(
          promptName,
          {
            inputs: [
              {
                label: "Name Search (not a full-text content search)",
                type: "string",
                value: urlQuery || "",
              },
              { label: "Tags", type: "tags", value: urlTag || "" },
              { label: "Group", type: "string", value: urlGroup || "" },
              {
                label: "Export As (required)",
                type: "select",
                options: plugin.constants.BULK_EXPORT_OPTIONS,
              },
              { label: "Include Attachments?", type: "checkbox", value: true },
            ],
            actions: [
              {
                label: "Export Whole Notebook (warning: this could take a while)",
                icon: "cloud_download",
                value: "full-export",
              },
              {
                label:
                  "Export By Export Tag (" +
                  (app.settings["Export Tag"] || plugin.constants.DEFAULT_EXPORT_TAG) +
                  ")",
                icon: "book",
                value: "export-by-tag",
              },
            ],
          }
        );
        if (!action || exportAs === null) {
          // Export Cancelled
          return;
        }

        const filterParams = {
          ...(query ? { query } : {}),
          ...(group ? { group } : {}),
          ...(tag ? { tag } : {}),
        };

        let noteList;
        if (action === "full-export") {
          // Whole notebook Bulk Export
          noteList = await app.notes.filter();
        } else if (action === "export-by-tag") {
          noteList = await app.notes.filter({
            tag: app.settings["Export Tag"] || plugin.constants.DEFAULT_EXPORT_TAG,
          });
        } else if (action === -1) {
          // Submit Query Export
          noteList = await app.notes.filter(filterParams);

          // If Graph Date Filter - post filter
          if (dateFilterStart) {
            // Only select notes that fall between the updated filter
            noteList = noteList.filter((n) => {
              const updatedDate = parseISOString(n.updated);
              return updatedDate >= dateFilterStart && updatedDate <= dateFilterEnd;
            });
          }
        }

        if (!noteList || noteList.length === 0) {
          app.alert("No notes found with that query!");
          return;
        }

        plugin._exportStatus.completed = 0;
        plugin._exportStatus.total = noteList.length;
        plugin._exportStatus.log = [];
        plugin._exportStatus.logBuffer = [];
        plugin._exportStatus.active = true;

        try {
          await createProgressNoteAndEmbed(app);

          function progressCallback(completed, logMessage) {
            plugin._exportStatus.completed = completed;
            if (logMessage) {
              plugin._exportStatus.log.push(logMessage);
              plugin._exportStatus.logBuffer.push(logMessage);
            }
          }

          const exporter = new BulkExporter(app, noteList, exportAs, {
            progressCallback,
            includeAttachments,
          });
          await exporter.initialize();
          await exporter.export();
          plugin._exportStatus.active = false;
        } catch (error) {
          app.alert("Export failed: " + error);
          plugin._exportStatus.active = false;
        }

        // If we exported by export tag and tag removal isn't disabled
        if (
          action === "export-by-tag" &&
          app.settings[plugin.constants.SETTING_DISABLE_EXPORT_TAG_REMOVAL] !== "true"
        ) {
          // Then remove the export tag from all the exported notes
          for (const taggedNote of noteList) {
            taggedNote.removeTag(app.settings["Export Tag"] || plugin.constants.DEFAULT_EXPORT_TAG);
          }
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
            case "csv":
          }
        }
      },
    },
    "Export as PDF": {
      run: async function (app, noteUUID) {
        setAppInterface(app);
        const note = await app.notes.find({ uuid: noteUUID });

        if (note) {
          const exporter = new MarkdownExporter(note.name, await note.content());
          await exporter.initialize();

          exporter.savePDF(note.name + ".pdf");
        }
      },
    },
    "Export as DOCX": {
      run: async function (app, noteUUID) {
        setAppInterface(app);
        const note = await app.notes.find({ uuid: noteUUID });
        if (note) {
          const exporter = new MarkdownExporter(note.name, await note.content());
          await exporter.initialize();

          exporter.saveDOCX(note.name + ".docx");
        }
      },
    },
  },

  // --------------------------------------------------------------------------
  // Used for exporting tables
  replaceText: {
    "Export Table as CSV": {
      check(app, text) {
        return hasMarkdownTable(app.context.selectionContent);
      },
      async run(app, text) {
        setAppInterface(app);
        const exporter = new MarkdownExporter("Table", app.context.selectionContent);
        await exporter.initialize();

        exporter.saveTableCSVIfTable();
        return false;
      },
    },
  },

  // There are several other entry points available, check them out here: https://www.amplenote.com/help/developing_amplenote_plugins#Actions
  // You can delete any of the insertText/noteOptions/replaceText keys if you don't need them
};

export default plugin;
