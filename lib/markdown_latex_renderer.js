//  Function that
export function setupLatexRenderingRules(rules) {
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
}
