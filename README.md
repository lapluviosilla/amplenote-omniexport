# OmniExport for Amplenote Plugin

A plugin that enables you to export your notes in a variety of formats.

**Watch the** [**Overview Video**](https://youtu.be/V3GB9fF98VI)

## **Features**

- **Supported Formats**: PDF, Word, ePub, Single File ePub, LaTeX, CSV, Markdown

  - **ePub**: Includes custom cover with note title. You can also bulk export your notes as a single epub book.

  - **GIF support**: Will auto-render gifs in your notes to still PNGs for formats that don't support GIF (PDF and LaTeX)

- **Bulk Export**: You can export your notes across different tags, name queries or even your whole notebook. Exports Images and Attachments!

  - _Warning_: This feature works best on the desktop app because the export can be streamed. On browsers it has to load all the exports into memory before downloading them, which could crash Amplenote. I am currently working with the Amplenote team to try and get the necessary plugin api support to make this work efficiently across all platforms.

- **Export Current Graph or Search**: Filter your graph or do a note search and then open the bulk export wizard, as easy as that.

- **Table Export**: You ever just want to export a single table as CSV? With this plugin you can select a part of your note containing a table and do just that.

- **Lazy Loaded Dependencies**: The plugin only loads the external libraries on demand so no need to worry about plugin bloat here.

## **Usage**

- **Bulk Export**

  - Use the Cmd/Ctrl-O Bulk Export menu to open the bulk export wizard.

  - You can query by name and tags, or export the whole notebook

  - The wizard also includes a shortcut button to export every note tagged with "export"

  - Choose whether to export attachments or not.

  - _Note:_ Mac OSX Archive Utility is very bug prone and sometimes refuses to open certain zip exports very randomly, especially epub exports. Please use a different archive utility if you get a "It is in an unsupported format" error. This is NOT an issue with the plugin or zip creation.

- **Export By Temporary Export Tag**

  - You can tag individual notes or groups of notes (through graph, autotagger plugin, etc) with a export tag (default: system/export) and then hit the "Export by Export Tag" button in the bulk exporter. _Note_: This will ignore the query and just export those notes.

  - The plugin will automatically remove the export tag from those notes after export unless disabled.

- **Export Current Graph or Search**

  - Search and filter in graph mode or note serach mode until you get the set of notes you want to export then Cmd/Ctrl-O Bulk Export and it will be prefiiled with your query.

- **Export As**

  - From the Note Menu you can export in to all the supported formats. This does not currently export attachments, for that you have to use the bulk exporter.

- **Table Export**: _Note_: Because of Amplenotes interface you must select a text block that contains a table to do a table export. If you just select the table itself it won't give you the plugin menu.

## **Roadmap**

- Export as Single PDF

- More export customization options, styling and fonts.

- More bulk export query options

- Export Interlinking

- Create your own fully fledged epub with interlinked chapters/notes

## **Author**

☕ If the plugin is helpful to you, you can [buy me a coffee](https://ko-fi.com/lapluviosilla)!

<br/>Check out my other amplenote plugin! [Dynamic Templater](https://www.amplenote.com/plugins/SjZGNPZBvRq42xpfD6u8CbHT)

**Published by**: lapluviosilla

**Date**: November 2nd, 2024

**Last Updated**: November 2nd, 2024

## **Feedback**

If you have any questions, issues, or feedback, please feel free to reach out!
