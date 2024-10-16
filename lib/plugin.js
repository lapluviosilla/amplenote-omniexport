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
    Export: {
      // check: async function (app, noteUUID) {
      //   const noteContent = await app.getNoteContent({ uuid: noteUUID });

      //   // This note option is ONLY shown when the note contains the word "cool"
      //   return /cool/i.test(noteContent.toLowerCase());
      // },
      run: async function (app, noteUUID) {
        const noteContent = await app.getNoteContent({ uuid: noteUUID });

        const exporter = new MarkdownExporter(noteContent);
        await exporter.initialize();

        // Or to get LaTeX content:
        const latexContent = exporter.toPDF();
        // console.log(latexContent);

        // Prompt user to select a file location using File System Access API if available
        if (false) {
          try {
            const fileHandle = await window.showSaveFilePicker({
              suggestedName: "note_export.tex",
              types: [
                {
                  description: "LaTeX File",
                  accept: { "application/x-latex": [".tex"] },
                },
              ],
            });

            // Create a writable stream and write the LaTeX content
            const writableStream = await fileHandle.createWritable();
            await writableStream.write(latexContent);
            await writableStream.close();

            alert("File saved successfully!");
          } catch (err) {
            console.error("Error saving file:", err);
          }
        } else {
          // Fallback to creating a Blob and link if File System Access API is not available
          // const blob = new Blob([latexContent], { type: "application/x-latex" });
          // const url = URL.createObjectURL(blob);
          // // Create a link to download the file
          // const link = document.createElement("a");
          // link.href = url;
          // link.download = "note_export.tex";
          // link.click();
          // // Clean up the object URL
          // setTimeout(() => {
          //   URL.revokeObjectURL(url);
          // }, 100);
        }
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
