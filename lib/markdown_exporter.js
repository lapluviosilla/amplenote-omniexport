import styles from "../styles/markdownHtml.css";
import ePubCover from "../images/ePubCover.png";
import {
  loadConflux,
  loadEpubGenMemory,
  loadHtmlDocx,
  loadMarkdownIt,
  loadPdfMake,
  loadVfsfonts,
} from "./dependency_loader";
import tokensToPdfmake from "./markdown_pdf_converter";
import { processLaTeXForImages, setupLatexRenderingRules } from "./markdown_latex_renderer";
import streamSaver from "./streamSaver";
import {
  loadImageAsBlob,
  loadImageAsDataURL,
  saveAs,
  addNewlineBeforeBackslashAfterTable,
  escapeBackslashNewlines,
  BrokenImage,
  proxifyImage,
  addTitleToCoverImage,
  startConfluxStream,
} from "./utilities";

// Lazy loaded dependencies
let markdownit;
let pdfMake;
let htmlDocx;
let epubGen;
let confluxWriter;

export class MarkdownExporter {
  constructor(title, markdownText) {
    this.reset(title, markdownText);
  }

  async initialize() {
    await this._ensureBaseDependenciesLoaded();

    // Initialize markdown-it
    this.md = markdownit({
      html: true,
      linkify: true,
      typographer: true,
    });
    this._setupHTMLRenderer();

    // Set up custom renderer for LaTeX
    this.latexMd = markdownit({ html: true });
    setupLatexRenderingRules(this.latexMd.renderer.rules);
  }

  reset(title, markdownText) {
    this.title = title;
    this.markdownText = markdownText ? this._preprocessMarkdown(markdownText) : null;
    this.htmlContent = null;
    this.attachments = [];
    this.images = [];
    this._embedImages = false;
  }

  // Amplenote tables have a strange "\" line after tables which messes with markdown it parsing
  // Add an extra newline in between so it's treated as a true blank line and not a extension of the table
  // Also markdown it doesn't handle lines ending with "\" so change then to <br> tags to indicate a break.
  _preprocessMarkdown(markdown) {
    return escapeBackslashNewlines(addNewlineBeforeBackslashAfterTable(markdown));
  }

  async _loadJsPDF() {
    if (!pdfMake) pdfMake = await loadPdfMake();
    await loadVfsfonts();
  }

  async _loadHtmlDocx() {
    if (!htmlDocx) htmlDocx = await loadHtmlDocx();
  }

  async _loadEpubGen() {
    if (!epubGen) epubGen = await loadEpubGenMemory();
  }

  async _loadConflux() {
    if (!confluxWriter) {
      ({ Writer: confluxWriter } = await loadConflux());
    }
  }

  async _ensureBaseDependenciesLoaded() {
    [markdownit] = await Promise.all([loadMarkdownIt()]);
  }

  _setupHTMLRenderer() {
    const rules = this.md.renderer.rules;

    const origImgRule = rules.image;

    // Override image renderer rule so we can intercept images and proxify them
    rules.image = (tokens, idx, options, env, renderer) => {
      let src = tokens[idx].attrGet("src");
      // Try to proxify the image (if it's hosted on images.amplenote.com)
      src = proxifyImage(src) || src;
      tokens[idx].attrSet("src", src);
      return origImgRule(tokens, idx, options, env, renderer);
    };
  }

  // Render HTML
  _getHtmlContent() {
    if (!this.htmlContent) {
      this.htmlContent = this.md.render(this.markdownText);
      this._removeEmptyTableHeaders();
    }
    return this.htmlContent;
  }

  // Remove empty table headers from htmlContent
  _removeEmptyTableHeaders() {
    const parser = new DOMParser();
    const doc = parser.parseFromString(this.htmlContent, "text/html");
    const theads = doc.querySelectorAll("thead");
    theads.forEach((thead) => {
      if (!thead.textContent.trim()) {
        thead.remove();
      }
    });
    this.htmlContent = doc.body.innerHTML;
  }

  toMarkdown() {
    return this.markdownText;
  }

  // Export methods
  toHTML(fullDocument = true) {
    const html = this._getHtmlContent();
    if (!fullDocument) {
      return html;
    }

    // HTML template
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.title}</title>
        <style>${styles}</style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    return fullHtml;
  }

  saveHTML(fileName = "output.html") {
    const htmlContent = this.toHTML();
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    saveAs(blob, fileName);
  }

  toLaTeX() {
    // Generate the LaTeX body content
    const bodyContent = this.latexMd.render(this.markdownText);

    // Define the LaTeX preamble
    const preamble = `
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
    keywordstyle=\color{blue},
    commentstyle=\color{gray},
    stringstyle=\color{orange},
  }
  \\begin{document}
  `;

    // Define the document closing
    const documentClosing = `
  \\end{document}
  `;

    // Combine the preamble, body content, and closing
    const fullDocument = preamble + bodyContent + documentClosing;

    return fullDocument;
  }

  async saveLaTeX(fileName = "output.tex") {
    const latexContent = this.toLaTeX();

    const { processedLaTeX, images } = await processLaTeXForImages(latexContent);

    const blob = new Blob([processedLaTeX], { type: "text/plain;charset=utf-8" });

    if (images.length === 0) {
      // If no images then just download the LaTeX using app.saveFile
      saveAs(blob, fileName);
    } else {
      // Download as a zip with images
      const writer = startConfluxStream("export.zip");

      await writer.write({
        name: fileName,
        stream: () => blob.stream(),
      });

      for (const image of images) {
        await writer.write({
          name: "images/" + image.filename,
          stream: () => image.blob.stream(),
        });
      }
      writer.close();
    }
  }

  async toDOCX() {
    await this._loadHtmlDocx();
    const htmlContent = this.toHTML();

    // Process images - DOCX exporter requires encoded images
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const imgs = doc.querySelectorAll("img");
    for (const img of imgs) {
      const dataURL = await loadImageAsDataURL(img.src);
      if (dataURL) img.src = dataURL;
    }

    return htmlDocx.asBlob(doc.documentElement.outerHTML);
  }

  async saveDOCX(fileName = "output.docx") {
    const docxContent = await this.toDOCX();
    saveAs(docxContent, fileName);
  }

  async toPDF() {
    // Load jsPDF if not already loaded
    await this._loadJsPDF();

    const tokens = this.md.parse(this.markdownText, {});

    const images = {};
    const pageWidth = 595.28; // A4 page width in points (72 points per inch)
    const pageMargins = [40, 60, 40, 60]; // [left, top, right, bottom]
    const pageContentWidth = pageWidth - pageMargins[0] - pageMargins[2];
    const content = tokensToPdfmake(tokens, pageContentWidth, images);

    // Load all images as Base64 encoded URLs
    await Promise.all(
      Object.entries(images).map(async ([k, v]) => {
        const imageDataURL = await loadImageAsDataURL(v, true);
        if (imageDataURL) {
          images[k] = imageDataURL;
        } else {
          // Use a image load fail placeholder if the image was invalid
          images[k] = BrokenImage;
        }
      })
    );

    // Create pdfmake document definition
    const docDefinition = {
      pageSize: "A4",
      pageMargins: pageMargins,
      content: [
        { text: this.title, style: "h2" },
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 514, // TODO: Adjust based on page width
              y2: 0,
              lineWidth: 0.5,
              lineColor: "#F3F4F4",
            },
          ],
        },
        ...content,
      ],
      images: images,
      styles: {
        h1: {
          fontSize: 18.02,
          bold: true,
          margin: [0, 20, 0, 10],
        },
        h2: {
          fontSize: 15.76,
          bold: true,
          margin: [0, 10, 0, 5],
        },
        h3: {
          fontSize: 13.51,
          bold: true,
          margin: [0, 10, 0, 5],
        },
        quote: {
          italics: true,
          color: "gray",
          margin: [0, 10, 0, 10],
        },
        codeBlock: {
          // TODO: Implement fonts for code block
          // font: "Courier",
          fontSize: 10,
          margin: [0, 5, 0, 5],
          background: "#f0f0f0",
          fillColor: "111111",
          color: "#333333",
        },
        codeInline: {
          // font: "Courier",
          fontSize: 10,
          background: "#f0f0f0",
          color: "#333333",
        },
        listItem: {
          margin: [0, 5, 0, 5],
        },
        tableHeader: {
          bold: true,
          fillColor: "#eeeeee",
        },
      },
      // defaultStyle: {
      //   font: "Helvetica",
      //   fontSize: 12,
      // },
    };

    // Generate PDF and download it
    // Return a Promise that resolves with the result of the getBlob callback
    return new Promise((resolve, reject) => {
      pdfMake.createPdf(docDefinition).getBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(console.error("Failed to create PDF Blob"));
        }
      });
    });
  }

  async savePDF(fileName = "output.pdf") {
    const pdf = await this.toPDF();
    saveAs(pdf, fileName);
  }

  async toEPUB() {
    await this._loadEpubGen();

    const newCover = await addTitleToCoverImage(ePubCover, this.title);

    const book = new epubGen.EPub(
      {
        title: this.title,
        css: styles,
        cover: new File([newCover], "cover.png", { type: "image/png" }),
      },
      [
        {
          title: this.title,
          content: this.toHTML(false),
        },
      ]
    );
    const blob = await book.genEpub();
    return blob;
    // saveAs(book, fileName);
  }

  async saveEPUB(fileName = "output.epub") {
    // Implement EPUB
    const epub = await this.toEPUB();

    saveAs(epub, fileName);
  }

  // Export the first table as a CSV (used for selection export)
  tableToCSV() {
    // Implement CSV conversion as before, using this.md to parse the markdown
    const html = this._getHtmlContent();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const table = doc.querySelector("table");

    if (table) {
      let csvContent = "";
      const rows = table.querySelectorAll("tr");

      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll("th, td");
        const rowContent = Array.from(cells)
          .map((cell) => {
            // Escape double quotes by doubling them
            let cellText = cell.textContent.trim();
            if (cellText.includes('"') || cellText.includes(",") || cellText.includes("\n")) {
              cellText = '"' + cellText.replace(/"/g, '""') + '"';
            }
            return cellText;
          })
          .join(",");
        csvContent += rowContent + "\n";
      });

      return csvContent;
    }
    return "";
  }

  saveTableCSV(fileName = "table.csv") {
    const blob = new Blob([this.toCSV()], { type: "text/csv;charset=utf-8" });
    saveAs(blob, fileName);
  }

  saveTableCSVIfTable(fileName = "table.csv") {
    const csv = this.toCSV();
    if (csv !== "") {
      saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), fileName);
    }
  }
}
