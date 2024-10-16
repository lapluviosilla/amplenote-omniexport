function tokensToPdfmake(tokens, images = {}) {
  const content = [];
  let tokenIndex = 0;

  while (tokenIndex < tokens.length) {
    const token = tokens[tokenIndex];

    switch (token.type) {
      case "heading_open":
        {
          const level = parseInt(token.tag.substring(1), 10);
          tokenIndex++;
          const inlineToken = tokens[tokenIndex];
          const text = processInlineTokens(inlineToken.children, images);
          content.push({
            text: text,
            style: level === 1 ? "header" : "subheader",
          });
          // Skip heading_close
          tokenIndex++;
        }
        break;

      case "paragraph_open":
        {
          tokenIndex++;
          const inlineToken = tokens[tokenIndex];
          let paragraphContent;
          if (inlineToken.type === "inline") {
            paragraphContent = processInlineTokens(inlineToken.children, images);
            tokenIndex++; // Move past 'inline'
          } else {
            // Process any other tokens inside the paragraph
            const paragraphTokens = [];
            while (tokens[tokenIndex].type !== "paragraph_close") {
              paragraphTokens.push(tokens[tokenIndex]);
              tokenIndex++;
            }
            paragraphContent = tokensToPdfmake(paragraphTokens);
          }
          content.push({
            text: paragraphContent,
            margin: [0, 5, 0, 5],
          });
          // Skip paragraph_close
          tokenIndex++;
        }
        break;

      case "bullet_list_open":
      case "ordered_list_open":
        {
          const listType = token.type === "bullet_list_open" ? "ul" : "ol";
          const items = [];
          tokenIndex++; // Move past 'list_open'

          let listNesting = 1;

          while (listNesting > 0 && tokenIndex < tokens.length) {
            const currentToken = tokens[tokenIndex];

            if (
              currentToken.type === "bullet_list_open" ||
              currentToken.type === "ordered_list_open"
            ) {
              listNesting++;
            } else if (
              currentToken.type === "bullet_list_close" ||
              currentToken.type === "ordered_list_close"
            ) {
              listNesting--;
              if (listNesting === 0) {
                tokenIndex++; // Move past the matching 'list_close'
                break;
              }
            }

            if (currentToken.type === "list_item_open") {
              // Process list item
              const listItemTokens = [];
              let listItemNesting = 1;
              tokenIndex++; // Move past 'list_item_open'

              while (listItemNesting > 0 && tokenIndex < tokens.length) {
                const listItemToken = tokens[tokenIndex];

                if (listItemToken.type === "list_item_open") {
                  listItemNesting++;
                } else if (listItemToken.type === "list_item_close") {
                  listItemNesting--;
                  if (listItemNesting === 0) {
                    tokenIndex++; // Move past 'list_item_close'
                    break;
                  }
                }
                listItemTokens.push(listItemToken);
                tokenIndex++;
              }

              // Process the list item tokens recursively
              const listItemContent = tokensToPdfmake(listItemTokens);

              // Add the list item content to the items array
              if (listItemContent.length === 1) {
                items.push(listItemContent[0]);
              } else {
                items.push({ stack: listItemContent });
              }
            } else {
              tokenIndex++;
            }
          }

          // Add the list to the content
          content.push({
            [listType]: items,
            style: "listItem",
          });
        }
        break;

      case "blockquote_open":
        {
          const blockquoteTokens = [];
          tokenIndex++; // Move past 'blockquote_open'
          let blockquoteNesting = 1;

          while (blockquoteNesting > 0 && tokenIndex < tokens.length) {
            const currentToken = tokens[tokenIndex];

            if (currentToken.type === "blockquote_open") {
              blockquoteNesting++;
            } else if (currentToken.type === "blockquote_close") {
              blockquoteNesting--;
              if (blockquoteNesting === 0) {
                tokenIndex++; // Move past 'blockquote_close'
                break;
              }
            }

            blockquoteTokens.push(currentToken);
            tokenIndex++;
          }

          const blockquoteContent = tokensToPdfmake(blockquoteTokens);
          content.push({
            stack: blockquoteContent,
            style: "quote",
          });
        }
        break;

      case "code_block":
      case "fence":
        {
          const codeText = token.content;
          content.push(createCodeBlock(codeText));
          tokenIndex++;
        }
        break;

      case "hr":
        {
          content.push({
            canvas: [
              {
                type: "line",
                x1: 0,
                y1: 0,
                x2: 515, // Adjust based on page width
                y2: 0,
                lineWidth: 1,
                lineColor: "#000000",
              },
            ],
            margin: [0, 10, 0, 10],
          });
          tokenIndex++;
        }
        break;

      case "inline":
        {
          const inlineContent = processInlineTokens(token.children, images);
          content.push({
            text: inlineContent,
            margin: [0, 5, 0, 5],
          });
          tokenIndex++;
        }
        break;

      case "table_open":
        {
          // Process table tokens
          const tableTokens = [];
          let tableNesting = 1;
          tokenIndex++; // Move past 'table_open'

          while (tableNesting > 0 && tokenIndex < tokens.length) {
            const currentToken = tokens[tokenIndex];

            if (currentToken.type === "table_open") {
              tableNesting++;
            } else if (currentToken.type === "table_close") {
              tableNesting--;
              if (tableNesting === 0) {
                tokenIndex++; // Move past 'table_close'
                break;
              }
            }
            tableTokens.push(currentToken);
            tokenIndex++;
          }

          const tableContent = processTableTokens(tableTokens, images);
          content.push(tableContent);
        }
        break;

      default:
        tokenIndex++;
        break;
    }
  }

  return { content, images };
}

// Helper function to process table tokens
function processTableTokens(tokens, images) {
  const body = [];
  let tokenIndex = 0;
  let headers = [];
  let aligns = [];

  while (tokenIndex < tokens.length) {
    const token = tokens[tokenIndex];

    switch (token.type) {
      case "thead_open":
        {
          tokenIndex++; // Move past 'thead_open'
          const headerRow = [];

          while (tokens[tokenIndex].type !== "thead_close") {
            if (tokens[tokenIndex].type === "tr_open") {
              tokenIndex++; // Move past 'tr_open'
              while (tokens[tokenIndex].type !== "tr_close") {
                if (tokens[tokenIndex].type === "th_open") {
                  // Get alignment if needed
                  const align = token.attrs && token.attrs[0] ? token.attrs[0][1] : "left";
                  aligns.push(align);

                  tokenIndex++; // Move past 'th_open'
                  const inlineToken = tokens[tokenIndex];
                  const text = processInlineTokens(inlineToken.children, images);
                  headerRow.push({ text: text, style: "tableHeader", alignment: align });
                  tokenIndex++; // Move past 'inline'
                  tokenIndex++; // Move past 'th_close'
                } else {
                  tokenIndex++;
                }
              }
              tokenIndex++; // Move past 'tr_close'
            } else {
              tokenIndex++;
            }
          }

          headers = headerRow;
          body.push(headers);
          tokenIndex++; // Move past 'thead_close'
        }
        break;

      case "tbody_open":
        {
          tokenIndex++; // Move past 'tbody_open'
          while (tokens[tokenIndex].type !== "tbody_close") {
            if (tokens[tokenIndex].type === "tr_open") {
              tokenIndex++; // Move past 'tr_open'
              const row = [];
              let columnIndex = 0;

              while (tokens[tokenIndex].type !== "tr_close") {
                if (tokens[tokenIndex].type === "td_open") {
                  // Get alignment from headers if available
                  const align = aligns[columnIndex] || "left";
                  tokenIndex++; // Move past 'td_open'
                  const inlineToken = tokens[tokenIndex];
                  const text = processInlineTokens(inlineToken.children, images);
                  row.push({ text: text, alignment: align });
                  tokenIndex++; // Move past 'inline'
                  tokenIndex++; // Move past 'td_close'
                  columnIndex++;
                } else {
                  tokenIndex++;
                }
              }

              body.push(row);
              tokenIndex++; // Move past 'tr_close'
            } else {
              tokenIndex++;
            }
          }
          tokenIndex++; // Move past 'tbody_close'
        }
        break;

      default:
        tokenIndex++;
        break;
    }
  }

  return {
    table: {
      headerRows: headers.length > 0 ? 1 : 0,
      widths: Array(headers.length).fill("*"),
      body: body,
    },
    layout: "lightHorizontalLines",
    margin: [0, 5, 0, 15],
  };
}

function processInlineTokens(inlineTokens, images) {
  const content = [];

  let currentStyles = {};
  let link = null;

  inlineTokens.forEach((token) => {
    switch (token.type) {
      case "text":
        {
          const textChunk = { text: token.content };
          if (Object.keys(currentStyles).length > 0) {
            Object.assign(textChunk, currentStyles);
          }
          if (link) {
            textChunk.link = link;
            textChunk.color = "blue";
            textChunk.decoration = "underline";
          }
          content.push(textChunk);
        }
        break;

      case "strong_open":
        currentStyles.bold = true;
        break;

      case "strong_close":
        delete currentStyles.bold;
        break;

      case "em_open":
        currentStyles.italics = true;
        break;

      case "em_close":
        delete currentStyles.italics;
        break;

      case "link_open":
        link = token.attrs.find((attr) => attr[0] === "href")[1];
        break;

      case "link_close":
        link = null;
        break;

      case "code_inline":
        {
          const codeChunk = { text: token.content, style: "codeInline" };
          content.push(codeChunk);
        }
        break;

      case "image":
        {
          const src = token.attrs.find((attr) => attr[0] === "src")[1];
          const altAttr = token.attrs.find((attr) => attr[0] === "alt");
          const alt = altAttr ? altAttr[1] : "";

          // Generate a unique key for the image
          let imageKey = Object.keys(images).find((key) => images[key] === src);

          // If the image URL is new, add it to the images dictionary
          if (!imageKey) {
            imageKey = `image_${Object.keys(images).length}`;
            images[imageKey] = src;
          }

          // Reference the image by its key in the content
          content.push({
            image: imageKey,
            width: 200, // Adjust as needed
            alt,
          });
        }
        break;

      case "hardbreak":
        {
          // In pdfmake, a hard line break can be represented by adding a '\n' in the text.
          // We ensure that the line break maintains the current styles.
          content.push({ text: "\n", ...currentStyles });
        }
        break;

      default:
        break;
    }
  });

  return content;
}

// Helper function defined earlier
function createCodeBlock(text) {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            text: text,
            margin: [10, 10, 10, 10],
            fontSize: 11,
          },
        ],
      ],
    },
    layout: {
      fillColor: "#f0f0f0",
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 20],
  };
}

export default tokensToPdfmake;
