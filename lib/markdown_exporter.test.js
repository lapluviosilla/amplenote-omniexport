// markdown_exporter.test.js
import { vi, describe, it, beforeEach, expect } from "vitest";
import styles from "../styles/markdownHtml.css";

// Mock all external dependencies
// vi.mock("./dependency_loader");
vi.mock("./dependency_loader");
vi.mock("./streamSaver");
vi.mock("./utilities");
// vi.mock("./markdown_pdf_converter");
// vi.mock("./markdown_latex_renderer");

let MarkdownExporter; // = await import("./markdown_exporter");
let dependencyLoader; // = await import("./dependency_loader");
let utilities; // = await import("./utilities");
let setAppInterface; //from "./api_singleton";

// import * as utilities from "./utilities";
import { mockAppWithContent } from "./test-helpers";
import { MockWritableStream, MockWritableStreamDefaultWriter } from "./test/mock_writable_stream";

describe("MarkdownExporter", () => {
  let exporter;
  const sampleTitle = "Sample Title";
  const sampleMarkdown = "This is a **bold** paragraph.";
  const expectedBaseHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${sampleTitle}</title>
        <style></style>
      </head>
      <body>
        <p>This is a <strong>bold</strong> paragraph.</p>

      </body>
      </html>
    `;

  let app;

  beforeEach(async () => {
    // Clear all mocks before each test
    // vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.resetModules();
    ({ MarkdownExporter } = await import("./markdown_exporter"));
    dependencyLoader = await import("./dependency_loader");
    utilities = await import("./utilities");
    ({ setAppInterface } = await import("./api_singleton"));

    ({ app } = mockAppWithContent("Irrelevant Note"));
    setAppInterface(app);

    exporter = new MarkdownExporter(sampleTitle, sampleMarkdown);
    await exporter.initialize();
  });

  describe("Markdown Processing", () => {
    it("should preprocess markdown by adding newline before backslash after table and escaping backslashes", () => {
      const originalMarkdown = "Table content\n| Header |\n|--------|\n| Cell |\n\\";
      const preprocessedMarkdown = "Table content\n| Header |\n|--------|\n| Cell |\n\n";

      // utilities.addNewlineBeforeBackslashAfterTable.mockReturnValue('Table content\n| Header |\n|--------|\n| Cell |\n\\');
      // utilities.escapeBackslashNewlines.mockReturnValue(preprocessedMarkdown);

      exporter.reset("Title", originalMarkdown);

      expect(exporter.markdownText).toBe(preprocessedMarkdown);
      // expect(utilities.addNewlineBeforeBackslashAfterTable).toHaveBeenCalledWith(originalMarkdown);
      // expect(utilities.escapeBackslashNewlines).toHaveBeenCalledWith('Table content\n| Header |\n|--------|\n| Cell |\n\\');
    });
  });

  describe("HTML Export", () => {
    it("should generate HTML content correctly without fullDocument", async () => {
      // exporter.md.render.mockReturnValue("<p>This is a <strong>bold</strong> paragraph.</p>");
      exporter._removeEmptyTableHeaders = vi.fn();

      const html = await exporter.toHTML(false);

      // expect(exporter.md.render).toHaveBeenCalledWith(sampleMarkdown);
      expect(exporter._removeEmptyTableHeaders).toHaveBeenCalled();
      expect(html).toBe("<p>This is a <strong>bold</strong> paragraph.</p>\n");
    });

    it("should generate full HTML document when fullDocument is true", async () => {
      // exporter.md.render.mockReturnValue("<p>Content</p>");
      exporter._removeEmptyTableHeaders = vi.fn();

      const expectedHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${sampleTitle}</title>
        <style></style>
      </head>
      <body>
        <p>This is a <strong>bold</strong> paragraph.</p>

      </body>
      </html>
    `;

      // Mock styles import
      // vi.mock("../styles/markdownHtml.css", () => "/* mocked styles */", { virtual: true });

      const html = await exporter.toHTML(true);

      expect(html).toBe(expectedHTML);
    });

    it("should save HTML as a file", async () => {
      // exporter.toHTML.mockReturnValue("<p>HTML Content</p>");
      const fileName = "test.html";

      await exporter.saveHTML(fileName);

      const blob = new Blob([expectedBaseHTML], { type: "text/html;charset=utf-8" });
      expect(app.saveFile).toHaveBeenCalledWith(blob, fileName);
    });

    it("should parse image width", async () => {
      const markdown = "![imagename|200](data:image/png;base64,iVBOR)"; // Empty image 1px1px with width set to 200
      const markdownImageExporter = new MarkdownExporter("Note with Image", markdown);
      await markdownImageExporter.initialize();

      const output = await markdownImageExporter.toHTML(false); // Export as html to test if image changed
      expect(output).toBe(
        '<p><img src="data:image/png;base64,iVBOR" alt="imagename" width="200"></p>\n'
      );
    });
  });
  describe("Markdown Export", () => {
    it("should process and export markdown with assets", async () => {
      exporter.reset(
        "markdown",
        "![](https://images.amplenote.com/image.png) [attachment.pdf](attachment://12345)"
      );
      exporter.assetExporter.options.exportAttachments = true;
      const markdown = await exporter.toMarkdown();

      expect(markdown).toEqual(
        `![](images/image.png) [attachment.pdf](attachments/attachment.pdf)`
      );
    });
  });
  describe("LaTeX Export", () => {
    it("should generate LaTeX content correctly", async () => {
      const markdown = `This is a **bold** statement.
# H1
## \`H2\`
### H3
#### H4
##### H5
- ~~Bullet~~ <mark style="color: red; background-color: black">List</mark>
1. *Number* **List** <br>
---
> Block
> Quote
\`\`\`
Hello Code
\`\`\`
[Google](https://www.google.com)

|      |            |
| ---- | ---------- |
| name | OmniExport |

`;
      exporter.reset("LaTeX Title", markdown);

      // exporter.latexMd.render.mockReturnValue("\\textbf{bold} statement.");

      const expectedLaTeX = `
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{hyperref}
\\usepackage{graphicx}
\\usepackage{xcolor}
\\usepackage{ulem}
\\usepackage{soul}
\\usepackage{listings}
\\usepackage{emoji}
\\usepackage{tabularx}
\\lstset{
  breaklines=true,
  breakatwhitespace=true,
  columns=fullflexible,
  keywordstyle=color{blue},
  commentstyle=color{gray},
  stringstyle=color{orange},
}
\\begin{document}
  This is a \\textbf{bold} statement.

\\section{H1}
\\subsection{\\lstinline|H2|}
\\subsubsection{H3}
\\paragraph{H4}
\\subparagraph{H5}
\\begin{itemize}
\\item \\sout{Bullet} \\colorbox[HTML]{black}{\\textcolor[HTML]{red}{List}


\\end{itemize}
\\begin{enumerate}
\\item \\emph{Number} \\textbf{List} \\\\



\\end{enumerate}
\\hrule
\\begin{quote}
Block\\\\
Quote

\\end{quote}
\\begin{lstlisting}
Hello Code
\\end{lstlisting}
\\href{https://www.google.com}{Google}

\\begin{tabularx}{\\textwidth}{|X|X|}
\\hline
 &  \\\\\\hline
name & OmniExport \\\\\\hline
\\end{tabularx}

\\end{document}
  `;

      const latex = await exporter.toLaTeX();
      expect(latex).toBe(expectedLaTeX);
    });

    it("should save LaTeX as a file without images", async () => {
      // exporter.toLaTeX.mockReturnValue(
      //   "\\documentclass{article}\n\\begin{document}\nContent\n\\end{document}"
      // );
      // latexRenderer.processLaTeXForImages.mockResolvedValue({
      //   processedLaTeX: "\\documentclass{article}\n\\begin{document}\nContent\n\\end{document}",
      //   images: [],
      // });
      const mockWritableStream = new MockWritableStream();
      const mockWriter = new MockWritableStreamDefaultWriter(mockWritableStream);
      mockWritableStream.getWriter.mockReturnValue(mockWriter);
      utilities.startConfluxStream.mockResolvedValue({ writable: mockWritableStream });

      await exporter.saveLaTeX("test.tex");

      const blob = new Blob(
        ["\\documentclass{article}\n\\begin{document}\nContent\n\\end{document}"],
        { type: "text/plain;charset=utf-8" }
      );
      // expect(latexRenderer.processLaTeXForImages).toHaveBeenCalledWith(
      //   "\\documentclass{article}\n\\begin{document}\nContent\n\\end{document}"
      // );
      expect(app.saveFile).toHaveBeenCalledWith(blob, "test.tex");
    });

    it("should save LaTeX as a zip file with images", async () => {
      const markdown = "![](https://images.amplenote.com/someimage.jpg)";
      const images = [
        { filename: "image1.png", blob: new Blob(["image data"], { type: "image/png" }) },
      ];
      exporter.reset("image note", markdown);
      // latexRenderer.processLaTeXForImages.mockResolvedValue({ processedLaTeX, images });
      // const mockWriter = { write: mockWrite, close: mockClose, releaseLock: vi.fn() };
      const mockWritableStream = new MockWritableStream();
      const mockWriter = new MockWritableStreamDefaultWriter(mockWritableStream);
      mockWritableStream.getWriter.mockReturnValue(mockWriter);
      utilities.startConfluxStream.mockResolvedValue({ writable: mockWritableStream });

      // Spy on the ReadableStream's pipeTo method
      const pipeToSpy = vi.spyOn(globalThis.ReadableStream.prototype, "pipeTo");
      await exporter.saveLaTeX("test.tex");

      // expect(latexRenderer.processLaTeXForImages).toHaveBeenCalledWith(
      //   "\\documentclass{article}\n\\begin{document}\nContent\n\\end{document}"
      // );
      expect(utilities.startConfluxStream).toHaveBeenCalledWith("export.zip");
      expect(mockWriter.write).toHaveBeenCalledWith({
        name: "test.tex",
        stream: expect.any(Function),
      });
      expect(pipeToSpy).toHaveBeenCalledWith(mockWritableStream);
      // expect(mockWritableStream.write).toHaveBeenCalledWith({
      //   name: "images/someimage.jpg",
      //   stream: expect.any(Function),
      // });
      // expect(mockClose).toHaveBeenCalled();
    });
  });
  describe("DOCX Export", () => {
    it("should generate DOCX content correctly", async () => {
      // exporter.toHTML.mockReturnValue("<p>This is a <strong>bold</strong> paragraph.</p>");
      const mockBlob = new Blob(["DOCX content"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      dependencyLoader.loadHtmlDocx.mockResolvedValue({
        asBlob: vi.fn().mockResolvedValue(mockBlob),
      });

      const docx = await exporter.toDOCX();

      expect(dependencyLoader.loadHtmlDocx).toHaveBeenCalled();
      expect(docx).toBe(mockBlob);
    });

    it("should save DOCX as a file", async () => {
      const mockBlob = new Blob(["DOCX content"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      dependencyLoader.loadHtmlDocx.mockResolvedValue({
        asBlob: vi.fn().mockResolvedValue(mockBlob),
      });
      const fileName = "test.docx";

      await exporter.saveDOCX(fileName);

      // expect(exporter.toDOCX).toHaveBeenCalled();
      expect(app.saveFile).toHaveBeenCalledWith(expect.any(Blob), fileName);
    });
  });
  describe("PDF Export", () => {
    it("should generate PDF blob correctly without images", async () => {
      // Mock dependencies
      dependencyLoader.loadPdfMake.mockResolvedValue({
        createPdf: vi.fn().mockReturnValue({
          getBlob: (cb) => cb(new Blob(["PDF content"], { type: "application/pdf" })),
        }),
      });
      dependencyLoader.loadVfsfonts.mockResolvedValue();

      exporter.markdownText = "This is a **bold** statement.";
      const tokens = [
        { type: "paragraph_open" },
        { type: "inline", children: [{ type: "text", content: "This is a **bold** statement." }] },
        { type: "paragraph_close" },
      ];
      // exporter.md.parse.mockReturnValue(tokens);
      // tokensToPdfmake.mockReturnValue([
      //   {
      //     text: [{ text: "This is a " }, { text: "bold", bold: true }, { text: " statement." }],
      //   },
      // ]);
      utilities.loadImageAsDataURL.mockResolvedValue(null);

      const pdfBlob = await exporter.toPDF();

      expect(dependencyLoader.loadPdfMake).toHaveBeenCalled();
      expect(dependencyLoader.loadVfsfonts).toHaveBeenCalled();
      // expect(exporter.md.parse).toHaveBeenCalledWith(exporter.markdownText, {});
      // expect(tokensToPdfmake).toHaveBeenCalledWith(tokens, 500 - 40 - 40, {});
      expect(dependencyLoader.loadVfsfonts).toHaveBeenCalled();
      expect(utilities.loadImageAsDataURL).toHaveBeenCalledTimes(0);
      expect(pdfBlob).toEqual(new Blob(["PDF content"], { type: "application/pdf" }));
    });

    it("should generate PDF blob correctly with images", async () => {
      // vi.resetModules();
      // const { MarkdownExporter: FreshMarkdownExporter } = await import("./markdown_exporter");
      // exporter = new FreshMarkdownExporter(sampleTitle, sampleMarkdown);
      // await exporter.initialize();
      // Mock dependencies
      // const createPdfMock = vi.fn().mockReturnValue({
      //   getBlob: (cb) => cb(new Blob(["PDF with images"], { type: "application/pdf" })),
      // });
      const pdfMake = await dependencyLoader.loadPdfMake();
      // vi.spyOn(pdfMake, "createPdf").mockImplementation(createPdfMock);
      // dependencyLoader.loadPdfMake.mockResolvedValue({
      //   createPdf: createPdfMock,
      // });

      // exporter._loadJsPDF = vi.fn(async () => (pdfMake = await loadPdfMake()));

      exporter.reset("Image Markdown", "Here is an image: ![alt](https://example.com/image.png)");
      // const tokens = [
      //   { type: "paragraph_open" },
      //   {
      //     type: "inline",
      //     children: [
      //       { type: "text", content: "Here is an image: " },
      //       {
      //         type: "image",
      //         attrs: [["src", "https://example.com/image.png"]],
      //         content: "image.png|300",
      //       },
      //     ],
      //   },
      //   { type: "paragraph_close" },
      // ];
      // exporter.md.parse.mockReturnValue(tokens);
      // tokensToPdfmake.mockReturnValue([
      //   {
      //     text: [
      //       { text: "Here is an image: " },
      //       { image: "image_0", width: 300, alt: "Example Image" },
      //     ],
      //   },
      // ]);
      // utilities.loadImageAsDataURL.mockResolvedValue("data:image/png;base64,encodedImage");

      const pdfBlob = await exporter.toPDF();

      // expect(dependencyLoader.loadPdfMake).toHaveBeenCalled();
      // expect(dependencyLoader.loadVfsfonts).toHaveBeenCalled();
      // expect(exporter.md.parse).toHaveBeenCalledWith(exporter.markdownText, {});

      expect(pdfMake.createPdf).toHaveBeenCalledTimes(1);
      const pdfmakeDoc = pdfMake.createPdf.mock.calls[0][0];

      expect(pdfmakeDoc.images["image_0"]).toEqual(utilities.ValidImage);

      expect(utilities.loadImageAsDataURL).toHaveBeenCalledWith(
        "https://example.com/image.png",
        true
      );
      expect(pdfBlob).toEqual(new Blob(["PDF with images"], { type: "application/pdf" }));
    });

    it("should save PDF as a file", async () => {
      // exporter.toPDF.mockResolvedValue(new Blob(["PDF content"], { type: "application/pdf" }));
      const fileName = "test.pdf";

      await exporter.savePDF(fileName);

      // expect(exporter.toPDF).toHaveBeenCalled();
      expect(app.saveFile).toHaveBeenCalledWith(expect.any(Blob), fileName);
    });
  });
  describe("EPUB Export", () => {
    it("should generate EPUB blob correctly without images", async () => {
      dependencyLoader.loadEpubGenMemory.mockResolvedValue({
        EPub: vi.fn().mockImplementation(() => ({
          genEpub: vi
            .fn()
            .mockResolvedValue(new Blob(["EPUB content"], { type: "application/epub+zip" })),
        })),
      });
      utilities.addTitleToCoverImage.mockResolvedValue(
        new Blob(["Cover Image"], { type: "image/png" })
      );

      exporter.title = "EPUB Title";
      // exporter.toHTML.mockReturnValue("<p>EPUB Content</p>");

      const epubBlob = await exporter.toEPUB();

      expect(dependencyLoader.loadEpubGenMemory).toHaveBeenCalled();
      // expect(utilities.addTitleToCoverImage).toHaveBeenCalledWith(
      //   "path/to/ePubCover.png",
      //   "EPUB Title"
      // );
      const { EPub } = await dependencyLoader.loadEpubGenMemory.mock.results[0].value;
      expect(EPub).toHaveBeenCalledWith(
        {
          title: "EPUB Title",
          css: styles,
          cover: expect.any(File),
          ignoreFailedDownloads: true,
        },
        [
          {
            title: "EPUB Title",
            content: `<p>This is a <strong>bold</strong> paragraph.</p>
`,
          },
        ]
      );
      expect(epubBlob).toEqual(new Blob(["EPUB content"], { type: "application/epub+zip" }));
    });

    it("should save EPUB as a file", async () => {
      // exporter.toEPUB.mockResolvedValue(
      //   new Blob(["EPUB content"], { type: "application/epub+zip" })
      // );
      const fileName = "test.epub";

      await exporter.saveEPUB(fileName);

      // expect(exporter.toEPUB).toHaveBeenCalled();
      // This is actually a Blob in the browser context, but we have to use the local version for testing which returns a buffer
      expect(app.saveFile).toHaveBeenCalledWith(expect.any(Buffer), fileName);
    });
  });
  describe("CSV Export", () => {
    it("should generate CSV from a table correctly", async () => {
      // Mock HTML content with a table
      const htmlContent = `
        <table>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
          <tr>
            <td>Row 1 Col 1</td>
            <td>Row 1 Col 2</td>
          </tr>
          <tr>
            <td>Row 2 Col 1</td>
            <td>Row 2 Col 2</td>
          </tr>
        </table>
      `;
      exporter.htmlContent = htmlContent;

      const expectedCSV = "Header 1,Header 2\nRow 1 Col 1,Row 1 Col 2\nRow 2 Col 1,Row 2 Col 2\n";

      const csv = await exporter.tableToCSV();

      expect(csv).toBe(expectedCSV);
    });

    it("should return empty string if no table exists", async () => {
      exporter.htmlContent = "<p>No table here.</p>";

      const csv = await exporter.tableToCSV();

      expect(csv).toBe("");
    });

    it("should save CSV as a file", () => {
      const csvContent = "Header 1,Header 2\nRow 1 Col 1,Row 1 Col 2\n";
      exporter.toCSV = vi.fn().mockReturnValue(csvContent);
      const fileName = "test.csv";

      exporter.saveTableCSV(fileName);

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      expect(exporter.toCSV).toHaveBeenCalled();
      expect(app.saveFile).toHaveBeenCalledWith(blob, fileName);
    });

    it("should save CSV only if table exists", () => {
      exporter.toCSV = vi.fn().mockReturnValue("Header 1,Header 2\nRow 1 Col 1,Row 1 Col 2\n");
      const fileName = "test.csv";

      exporter.saveTableCSVIfTable(fileName);

      const blob = new Blob(["Header 1,Header 2\nRow 1 Col 1,Row 1 Col 2\n"], {
        type: "text/csv;charset=utf-8",
      });
      expect(exporter.toCSV).toHaveBeenCalled();
      expect(app.saveFile).toHaveBeenCalledWith(blob, fileName);
    });

    it("should not save CSV if no table exists", () => {
      exporter.toCSV = vi.fn().mockReturnValue("");
      const fileName = "test.csv";

      exporter.saveTableCSVIfTable(fileName);

      expect(exporter.toCSV).toHaveBeenCalled();
      expect(app.saveFile).not.toHaveBeenCalled();
    });
  });
  // describe("Multi Export", () => {
  // TODO: Feature to be implemented. Here is test case for later. Not needed for 1.0
  // it("should be able to export into multiple formats one after another", async () => {
  //   exporter.reset("Multi", "![Alt text](image.png) [attachment.pdf](attachment://12345)");
  //   const html = await exporter.toHTML();
  //   const latex = await exporter.toLaTeX();
  //   const pdf = await exporter.toPDF();
  //   const docx = await exporter.toDOCX();
  //   const assets = await exporter.assetExporter.getLocalAssets();
  //   expect(assets.length).toBe(2); // Normally would be one, since most formats can do base64, but latex can't so it needs to export as a local file.
  // });
  // });
});
