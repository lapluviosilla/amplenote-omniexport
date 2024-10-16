import styles from "../styles/markdownHtml.css";

export class MarkdownExporter {
  constructor(markdownText) {
    this.markdownText = markdownText;
    this.htmlContent = "";
  }

  async initialize() {
    await this._ensureBaseDependenciesLoaded();

    // Initialize markdown-it
    this.md = window.markdownit({
      html: true,
      linkify: true,
      typographer: true,
    });

    // Render HTML content
    this.htmlContent = this.md.render(this.markdownText);

    // Remove empty table headers
    this._removeEmptyTableHeaders();

    // Set up custom renderer for LaTeX
    this.latexMd = window.markdownit();
    this._setupLatexRenderer();
  }

  async _loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        // Script already loaded
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.setAttribute("type", "text/javascript");
      script.setAttribute("src", url);
      script.addEventListener("load", () => {
        resolve(true);
      });
      script.addEventListener("error", () => {
        reject(new Error(`Failed to load script: ${url}`));
      });
      document.body.appendChild(script);
    });
  }

  async _loadMarkdownIt() {
    await this._loadScript("https://cdn.jsdelivr.net/npm/markdown-it/dist/markdown-it.min.js");
  }

  async _loadFileSaver() {
    await this._loadScript("https://cdn.jsdelivr.net/npm/file-saver/dist/FileSaver.min.js");
  }

  async _loadJsPDF() {
    if (!window.jspdf) {
      await this._loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }
  }

  async _loadHtmlDocx() {
    if (!window.htmlDocx) {
      await this._loadScript("https://cdn.jsdelivr.net/npm/html-docx-js/dist/html-docx.js");
    }
  }

  async _loadEpubJs() {
    if (!window.ePub) {
      await this._loadScript("https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js");
    }
  }

  async _ensureBaseDependenciesLoaded() {
    await Promise.all([this._loadMarkdownIt(), this._loadFileSaver()]);
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
      return `\\begin{verbatim}\n${content}\\end{verbatim}\n`;
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

  // Export methods
  toHTML(fullDocument = true) {
    if (!fullDocument) {
      return this.htmlContent;
    }

    // HTML template
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Markdown Export</title>
        <style>${styles}</style>
      </head>
      <body>
        ${this.htmlContent}
      </body>
      </html>
    `;

    return fullHtml;
  }

  toHTMLFile(fileName = "output.html") {
    const htmlContent = this.toHTML();
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    window.saveAs(blob, fileName);
  }

  async toDOCX(fileName = "output.docx") {
    await this._loadHtmlDocx();
    const docxContent = window.htmlDocx.asBlob(this.htmlContent);
    window.saveAs(docxContent, fileName);
  }

  async toPDF(fileName = "output.pdf") {
    await this._loadJsPDF();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });

    const fullHtml = this.toHTML(true);
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullHtml, "text/html");
    const bodyText = doc.body.innerText;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(bodyText, 20, 30, {
      maxWidth: 550,
    });

    pdf.save(fileName);
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
    window.saveAs(epubBlob, fileName);
  }

  toLaTeX() {
    // Generate the LaTeX body content
    const bodyContent = this.latexMd.render(this.markdownText);

    // Define the LaTeX preamble
    const preamble = `
  \documentclass{article}
  \usepackage[utf8]{inputenc}
  \usepackage[T1]{fontenc}
  \usepackage{hyperref}
  \usepackage{graphicx}
  \usepackage{verbatim}
  \usepackage[normalem]{ulem} % For strikethrough text
  \begin{document}
  `;

    // Define the document closing
    const documentClosing = `
  \end{document}
  `;

    // Combine the preamble, body content, and closing
    const fullDocument = preamble + bodyContent + documentClosing;

    return fullDocument;
  }

  toLaTeXFile(fileName = "output.tex") {
    const latexContent = this.toLaTeX();
    const blob = new Blob([latexContent], { type: "text/plain;charset=utf-8" });
    window.saveAs(blob, fileName);
  }

  toCSV() {
    // Implement CSV conversion as before, using this.md to parse the markdown
  }
}
