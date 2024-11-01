import { loadImageAsBlob } from "./utilities";

export function setupLatexRenderingRules(rules) {
  // Note: Ensure that the following LaTeX packages are included in the preamble:
  // \usepackage{hyperref}
  // \usepackage{graphicx}
  // \usepackage{xcolor}
  // \usepackage{ulem}
  // \usepackage{soul}
  // \usepackage{listings}
  // \lstset{breaklines=true, breakatwhitespace=true, columns=fullflexible}

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

  // Support for strikethrough
  rules.s_open = () => "\\sout{";
  rules.s_close = () => "}";

  // Code inline with proper escaping using \lstinline
  rules.code_inline = (tokens, idx) => {
    const content = unescapeLatex(tokens[idx].content);
    const delimiter = getSafeDelimiter(content);
    return `\\lstinline${delimiter}${content}${delimiter}`;
  };

  // Code blocks with word wrap, no language specified
  rules.fence = (tokens, idx) => {
    const content = tokens[idx].content;
    // No need to escape content in lstlisting
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
    return `\\href{${escapeLatex(href)}}{`;
  };
  rules.link_close = () => "}";

  rules.image = (tokens, idx) => {
    const token = tokens[idx];

    // Extract src and alt attributes
    const srcAttr = token.attrs.find((attr) => attr[0] === "src");
    const src = srcAttr ? srcAttr[1] : "";
    const altAttr = token.attrs.find((attr) => attr[0] === "alt");
    const alt = altAttr ? altAttr[1] : "";
    const titleAttr = token.attrs.find((attr) => attr[0] === "title");
    const title = titleAttr ? titleAttr[1] : "";

    // Split the image name by '|' to extract width if specified
    const imageNameParts = token.content.split("|");
    const imageName = imageNameParts[0].trim();
    const origWidthPx = imageNameParts.length > 1 ? parseInt(imageNameParts[1], 10) : 250; // Default to 250px

    // Convert pixel width to cm
    const widthCm = pixelsToCm(origWidthPx).toFixed(2); // Rounded to two decimal places

    // Initialize options array for \includegraphics
    let options = [`width=${widthCm}cm`];

    // Convert options array to LaTeX options string
    const optionsStr = options.length ? `[${options.join(",")}]` : "";

    // Handle captions if title is provided
    if (title) {
      // Use figure environment for images with captions
      return `
\\begin{figure}[h]
  \\centering
  \\includegraphics${optionsStr}{${src}}
  \\caption{${escapeLatex(title)}}
  \\label{fig:${escapeLatex(alt || "image")}}
\\end{figure}
`;
    } else {
      // For images without captions, just include the graphic
      return `\\includegraphics${optionsStr}{${src}}\n`;
    }
  };
  // Handle hard line breaks
  rules.hardbreak = () => "\\\\\n";
  rules.softbreak = () => "\\\\\n";

  // Handle HTML inline elements
  rules.html_inline = (tokens, idx) => {
    const content = tokens[idx].content.trim();

    // Filter out HTML comments
    if (content.startsWith("<!--") && content.endsWith("-->")) {
      return ""; // Skip comments
    }

    // Support for <br> tags
    if (content === "<br>" || content === "<br/>") {
      return "\\\\\n";
    }

    // Support for <mark> tags with style attributes
    if (content.startsWith("<mark")) {
      // Extract style attributes
      const styleMatch = content.match(/style="([^"]*)"/);
      let bgColor = "";
      let textColor = "";
      if (styleMatch) {
        const style = styleMatch[1];
        const styles = style.split(";").map((s) => s.trim());
        styles.forEach((s) => {
          const [key, value] = s.split(":").map((kv) => kv.trim());
          if (key === "background-color") {
            bgColor = value;
          }
          if (key === "color") {
            textColor = value;
          }
        });
      }

      // Convert CSS colors to LaTeX colors
      function cssColorToLatexColor(cssColor) {
        cssColor = cssColor.replace("#", "");
        return cssColor;
      }

      let latex = "";
      if (bgColor) {
        const latexBgColor = cssColorToLatexColor(bgColor);
        latex += `\\colorbox[HTML]{${latexBgColor}}{`;
      }
      if (textColor) {
        const latexTextColor = cssColorToLatexColor(textColor);
        latex += `\\textcolor[HTML]{${latexTextColor}}{`;
      }
      if (!bgColor && !textColor) {
        latex += "\\hl{";
      }
      tokens[idx].markStyleStack = { bgColor, textColor };
      return latex;
    }

    if (content === "</mark>") {
      let latex = "";
      const prevToken = tokens[idx - 1];
      const markStyleStack = prevToken && prevToken.markStyleStack;
      if (markStyleStack) {
        if (markStyleStack.textColor) {
          latex += "}";
        }
        if (markStyleStack.bgColor) {
          latex += "}";
        }
      } else {
        latex += "}";
      }
      return latex;
    }

    // Ignore other HTML inline content
    return "";
  };

  // Process text content to handle HTML entities, emojis, etc.
  rules.text = (tokens, idx) => {
    let content = tokens[idx].content;
    content = unescapeLatex(content); // Remove preescaped LaTeX characters like "\["
    content = unescapeHtmlEntities(content);
    content = escapeLatex(content);
    // Emojis and other Unicode characters are handled by LaTeX with utf8 input encoding
    return content;
  };

  rules.hr = () => "\\hrule\n";

  // Table support with fixes, using tabularx to prevent overflow
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
    const cols = "|" + "X|".repeat(colCount);
    return `\\begin{tabularx}{\\textwidth}{${cols}}\n\\hline\n`;
  };

  rules.table_close = () => "\\end{tabularx}\n";

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
    return "";
  };

  rules.tr_close = (tokens, idx, options, env, self) => {
    return " \\\\\\hline\n";
  };

  rules.th_open = (tokens, idx, options, env, self) => {
    return "";
  };

  rules.th_close = (tokens, idx, options, env, self) => {
    env.tableCellIndex++;
    if (env.tableCellIndex < env.tableColumnCount) {
      return " & ";
    } else {
      return "";
    }
  };

  rules.td_open = (tokens, idx, options, env, self) => {
    return "";
  };

  rules.td_close = (tokens, idx, options, env, self) => {
    env.tableCellIndex++;
    if (env.tableCellIndex < env.tableColumnCount) {
      return " & ";
    } else {
      return "";
    }
  };
}

function escapeLatex(text) {
  const replacements = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    $: "\\$",
    "&": "\\&",
    "%": "\\%",
    "#": "\\#",
    _: "\\_",
    "^": "\\^{}",
    "~": "\\~{}",
  };
  return text.replace(/([\\{}$&%#_^~])/g, (match) => replacements[match]);
}

// Function to unescape specific LaTeX characters that are preescaped
function unescapeLatex(text) {
  // Remove backslashes before [ and ]
  return text.replace(/\\([\[\]\|])/g, "$1");
}

function unescapeHtmlEntities(text) {
  const entities = {
    "&quot;": '"',
    "&amp;": "\\&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    // Add other entities as needed
  };
  return text.replace(/&[a-z]+;/g, (match) => entities[match] || match);
}

function getSafeDelimiter(content) {
  const delimiters = ["|", "/", "@", "%", "#", "!", "~", "=", "+", "-", "*", ":", ";", "?"];
  for (const delim of delimiters) {
    if (!content.includes(delim)) {
      return delim;
    }
  }
  // Default to '|' if all delimiters are present
  return "|";
}

// Function to convert pixels to centimeters (assuming 96 DPI)
function pixelsToCm(pixels) {
  return (pixels * 2.54) / 96;
}

/**
 * OUT OF DATE
 * Processes LaTeX content to handle images by:
 * 1. Identifying all \includegraphics commands with URLs.
 * 2. Replacing each URL with a unique local file path.
 * 3. Collecting image URLs and their corresponding unique filenames.
 * 4. Fetching all images as Blobs after the replacement loop.
 *
 * @param {string} latexContent - The original LaTeX content.
 * @returns {Object} - An object containing the processed LaTeX and an array of image objects with Blobs.
 */
// export async function processLaTeXForImages(latexContent, prefix = null) {
//   // Regular expression to find \includegraphics commands with URLs
//   const includeGraphicsRegex = /\\includegraphics(?:\[[^\]]*\])?{([^}]+)}/g;

//   const nameCache = new Map(); // To track and prevent duplicate filenames
//   const images = []; // To store image URLs and their unique filenames

//   let processedLaTeX = latexContent;
//   let match;

//   // Iterate through all matches of \includegraphics in the LaTeX content
//   while ((match = includeGraphicsRegex.exec(latexContent)) !== null) {
//     const imagePath = match[1].trim();

//     // Check if the imagePath is a URL
//     if (/^https?:\/\//i.test(imagePath)) {
//       const pathSegments = imagePath.split("/");
//       const lastSegment = pathSegments[pathSegments.length - 1];
//       const [originalFilename] = lastSegment.split("?"); // Remove query parameters if any

//       // Determine a unique filename using the nameCache
//       let uniqueFilename;

//       if (!nameCache.has(originalFilename)) {
//         nameCache.set(originalFilename, 1);
//         uniqueFilename = originalFilename;
//       } else {
//         const count = nameCache.get(originalFilename);
//         nameCache.set(originalFilename, count + 1);

//         const extensionIndex = originalFilename.lastIndexOf(".");
//         if (extensionIndex !== -1) {
//           const name = originalFilename.substring(0, extensionIndex);
//           const extension = originalFilename.substring(extensionIndex);
//           uniqueFilename = `${name}_${count}${extension}`;
//         } else {
//           // If there's no extension, simply append the counter
//           uniqueFilename = `${originalFilename}_${count}`;
//         }
//       }
//       if (prefix) uniqueFilename = prefix + uniqueFilename;

//       // Define the local path for the image within the ZIP (e.g., images/image.jpg)
//       const localImagePath = `images/${uniqueFilename}`;

//       // Extract the optional parameters (e.g., [width=9.02cm])
//       const fullMatch = match[0]; // The entire \includegraphics command
//       const optionsMatch = fullMatch.match(/\\includegraphics(\[[^\]]*\])?{[^}]+}/);
//       const optionsStr = optionsMatch && optionsMatch[1] ? optionsMatch[1] : "";

//       // Construct the replacement \includegraphics command
//       const replacement = `\\includegraphics${optionsStr}{${localImagePath}}`;

//       // Replace the original \includegraphics command with the new one
//       processedLaTeX = processedLaTeX.replace(fullMatch, replacement);

//       // Add the image details to the images array for later fetching
//       images.push({ url: imagePath, filename: uniqueFilename });
//     }
//   }

//   // After the replacement loop, fetch all images as Blobs
//   const imageFetchPromises = images.map(async (image) => {
//     const blob = await loadImageAsBlob(image.url);
//     if (blob) {
//       return { ...image, blob };
//     } else {
//       console.warn(`Failed to load image: ${image.url}`);
//       // Optionally, handle failed image fetches (e.g., assign a placeholder Blob or null)
//       return { ...image, blob: null };
//     }
//   });

//   // Await all image fetch operations
//   const imagesWithBlobs = await Promise.all(imageFetchPromises);

//   return { outLatex: processedLaTeX, images: imagesWithBlobs };
// }
