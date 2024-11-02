/** The config file for your plugin
 * The version and sourceRepo parameters are optional, they will be output in your plugin
 * setting is an array of all your Settings, but you can remove the key if your plugin doesn't have any settings.
 */
export default {
  name: "OmniExport",
  description: "A plugin that enables you to export your notes in a variety of formats.",
  icon: "output",
  version: "1.0.0",
  sourceRepo: "https://github.com/lapluviosilla/amplenote-omniexport", // This is optional and can be removed
  instructions: `Use the Cmd/Ctrl-O Bulk Export menu to open the bulk export wizard. Use the Note option menu to export as various formats.
View the [README on Github](https://github.com/lapluviosilla/amplenote-omniexport/blob/main/README.md) for detailed usage instructions
- **Supported Formats**: PDF, Word, ePub, Single File ePub, LaTeX, CSV, Markdown

  - **ePub**: Includes custom cover with note title. You can also bulk export your notes as a single epub book.

  - **GIF support**: Will auto-render gifs in your notes to still PNGs for formats that don't support GIF (PDF and LaTeX)

- **Bulk Export**: You can export your notes across different tags, name queries or even your whole notebook. Exports Images and Attachments!

  - _Warning_: This feature works best on the desktop app because the export can be streamed. On browsers it has to load all the exports into memory before downloading them, which could crash Amplenote. I am currently working with the Amplenote team to try and get the necessary plugin api support to make this work efficiently across all platforms.

- **Export Current Graph or Search**: Filter your graph or do a note search and then open the bulk export wizard, as easy as that.

- **Table Export**: You ever just want to export a single table as CSV? With this plugin you can select a part of your note containing a table and do just that.

- **Lazy Loaded Dependencies**: The plugin only loads the external libraries on demand so no need to worry about plugin bloat here.`,
  setting: [
    "Export Tag",
    "Keep Export Tag after Export? (set to true to disable removal of the tag)",
  ],
};
