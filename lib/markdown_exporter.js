import styles from "../styles/markdownHtml.css";
import {
  loadFileSaver,
  loadHtmlDocx,
  loadMarkdownIt,
  loadPdfMake,
  loadVfsfonts,
} from "./dependency_loader";
import tokensToPdfmake from "./markdown_pdf_converter";
import {
  loadImageAsBlob,
  loadImageAsDataURL,
  saveAs,
  addNewlineBeforeBackslashAfterTable,
  escapeBackslashNewlines,
  BrokenImage,
} from "./utilities";

// Lazy loaded dependencies
let markdownit;
let pdfMake;
let htmlDocx;

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

    // Set up custom renderer for LaTeX
    this.latexMd = markdownit({ html: true });
    this._setupLatexRenderer();
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

  async _loadEpubJs() {
    // await load
    // if (!window.ePub) {
    //   await this._loadScript("https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js");
    // }
  }

  async _ensureBaseDependenciesLoaded() {
    [markdownit] = await Promise.all([loadMarkdownIt()]);
  }

  _setupHTMLRenderer() {
    const rules = this.md.renderer.rules;

    const origImgRule = rules.image;

    // Override image renderer rule so we can intercept images and convert to local links or data urls
    // rules.image = (tokens, idx) => {
    //   const src = tokens[idx].attrGet("src");
    //   // If embedding images then download and convert to data url
    //   if(this._embedImages) {
    //     this.images.push(src);
    //     tokens[idx].attrSet("src", loadImageAsDataURL(src));
    //     origImgRule(tokens, idx);
    //   } else {

    //   }
    //   origImgRule(tokens, idx);
    // }
  }

  _setupLatexRenderer() {
    const rules = this.latexMd.renderer.rules;

    // Define custom rendering rules
    rules.heading_open = (tokens, idx) => {
      const level = tokens[idx].markup.length;
      const headingMap = {
        1: "\\section",
        2: "\\subsection",
        3: "\\subsubsection",
        4: "\\paragraph",
        5: "\\subparagraph",
        6: "\\textbf",
      };
      return `${headingMap[level]}{`;
    };
    rules.heading_close = () => "}\n";

    rules.paragraph_open = () => "";
    rules.paragraph_close = () => "\n\n";

    rules.em_open = () => "\\emph{";
    rules.em_close = () => "}";
    rules.strong_open = () => "\\textbf{";
    rules.strong_close = () => "}";

    rules.code_inline = (tokens, idx) => {
      const content = tokens[idx].content;
      return `\\texttt{${content}}`;
    };

    rules.fence = (tokens, idx) => {
      const content = tokens[idx].content;
      return `\\begin{lstlisting}\n${content}\\end{lstlisting}\n`;
    };

    rules.blockquote_open = () => "\\begin{quote}\n";
    rules.blockquote_close = () => "\\end{quote}\n";

    rules.bullet_list_open = () => "\\begin{itemize}\n";
    rules.bullet_list_close = () => "\\end{itemize}\n";

    rules.ordered_list_open = () => "\\begin{enumerate}\n";
    rules.ordered_list_close = () => "\\end{enumerate}\n";

    rules.list_item_open = () => "\\item ";
    rules.list_item_close = () => "\n";

    rules.link_open = (tokens, idx) => {
      const href = tokens[idx].attrGet("href");
      return `\\href{${href}}{`;
    };
    rules.link_close = () => "}";

    rules.image = (tokens, idx) => {
      const src = tokens[idx].attrGet("src");
      const alt = tokens[idx].content || "";
      return `\\includegraphics{${src}}`;
    };

    rules.hr = () => "\\hrule\n";

    // Table support
    rules.table_open = (tokens, idx, options, env, self) => {
      // Determine the number of columns
      let colCount = 0;
      for (let i = idx + 1; i < tokens.length; i++) {
        if (tokens[i].type === "tr_open") {
          for (let j = i + 1; j < tokens.length; j++) {
            if (tokens[j].type === "th_open" || tokens[j].type === "td_open") {
              colCount++;
            } else if (tokens[j].type === "tr_close") {
              break;
            }
          }
          break;
        }
      }
      env.tableColumnCount = colCount;
      const cols = "|" + "l|".repeat(colCount);
      return `\\begin{tabular}{${cols}}\n\\hline\n`;
    };

    rules.table_close = () => "\\end{tabular}\n";

    rules.thead_open = (tokens, idx, options, env, self) => {
      env.inHeader = true;
      return "";
    };

    rules.thead_close = (tokens, idx, options, env, self) => {
      env.inHeader = false;
      return "";
    };

    rules.tbody_open = () => "";
    rules.tbody_close = () => "";

    rules.tr_open = (tokens, idx, options, env, self) => {
      env.tableCellIndex = 0; // Reset cell index at the start of each row
      if (env.inHeader) {
        // Check if the header row is empty
        env.rowIsEmpty = true;
        for (let i = idx + 1; i < tokens.length; i++) {
          if (tokens[i].type === "tr_close") {
            break;
          } else if (tokens[i].type === "th_open") {
            // The content will be in the inline token after th_open
            if (
              tokens[i + 1] &&
              tokens[i + 1].type === "inline" &&
              tokens[i + 1].content.trim() !== ""
            ) {
              env.rowIsEmpty = false;
              break;
            }
          }
        }
      } else {
        env.rowIsEmpty = false;
      }
      return "";
    };

    rules.tr_close = (tokens, idx, options, env, self) => {
      if (env.inHeader && env.rowIsEmpty) {
        // Do not output \hline for empty header rows
        return "";
      } else {
        return "\\\\ \\hline\n";
      }
    };

    rules.th_open = (tokens, idx, options, env, self) => {
      if (env.rowIsEmpty) {
        // Do not output anything for empty header row cells
        return "";
      }
      const res = env.tableCellIndex > 0 ? " & " : "";
      env.tableCellIndex++;
      return res;
    };

    rules.th_close = () => "";

    rules.td_open = (tokens, idx, options, env, self) => {
      const res = env.tableCellIndex > 0 ? " & " : "";
      env.tableCellIndex++;
      return res;
    };

    rules.td_close = () => "";

    // Escape LaTeX special characters in text tokens
    const defaultTextRule =
      this.latexMd.renderer.rules.text || ((tokens, idx) => tokens[idx].content);
    rules.text = (tokens, idx) => {
      const content = tokens[idx].content;
      return content.replace(/([#\$%&~_^\\{}])/g, "\\$1");
    };

    // TODO: Implement mark styling
    rules.html = (tokens, idx) => {
      return "";
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
  \\usepackage{listings}
  \\lstset{breaklines=true}
  \\usepackage[normalem]{ulem} % For strikethrough text
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

  saveLaTeX(fileName = "output.tex") {
    const latexContent = this.toLaTeX();
    const blob = new Blob([latexContent], { type: "text/plain;charset=utf-8" });
    saveAs(blob, fileName);
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

  async toPDF(fileName = "output.pdf") {
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

  async toEPUB(fileName = "output.epub") {
    await this._loadEpubJs();
    const book = window.ePub({
      title: "Sample Book",
      author: "Author Name",
      content: [
        {
          title: "Content",
          data: this.htmlContent,
        },
      ],
    });

    const epubBlob = await book.generate("blob");
    saveAs(epubBlob, fileName);
  }

  async saveEPUB() {
    // Implement EPUB
  }

  // Export the first table as a CSV (used for selection export)
  toCSV() {
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

  saveCSV(fileName = "table.csv") {
    const blob = new Blob([toCSV()], { type: "text/csv;charset=utf-8" });
    saveAs(blob, fileName);
  }

  saveCSVIfTable(fileName = "table.csv") {
    const csv = this.toCSV();
    if (csv !== "") {
      saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), fileName);
    }
  }
}
