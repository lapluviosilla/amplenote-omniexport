// Pdfmake is the best option for us
// It gets almost everything right. Inline images are a bit clunky, and also cause a list to miss the header
function tokensToPdfmake(tokens, pageContentWidth, images = {}) {
  const content = [];
  let tokenIndex = 0;
  // const nestedTokens = nestTokens(tokens);

  while (tokenIndex < tokens.length) {
    const token = tokens[tokenIndex];

    switch (token.type) {
      case "heading_open":
        {
          const level = parseInt(token.tag.substring(1), 10);
          tokenIndex++;
          const inlineToken = tokens[tokenIndex];
          const text = processInlineTokens(inlineToken.children, pageContentWidth, images);
          content.push({
            text: text,
            style: level > 3 ? "h3" : token.tag,
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
            paragraphContent = processInlineTokens(inlineToken.children, pageContentWidth, images);
            tokenIndex++; // Move past 'inline'
          } else {
            // Process any other tokens inside the paragraph
            const paragraphTokens = [];
            while (tokens[tokenIndex].type !== "paragraph_close") {
              paragraphTokens.push(tokens[tokenIndex]);
              tokenIndex++;
            }
            paragraphContent = tokensToPdfmake(paragraphTokens, pageContentWidth, images);
          }
          // Group content into columns if images are present
          const paragraphElement = groupInlineContent(paragraphContent);
          paragraphElement.forEach((el) => content.push(el));
          // content.push({
          //   ...paragraphElement,
          //   margin: [0, 5, 0, 5],
          // });
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
              const listItemContent = tokensToPdfmake(listItemTokens, pageContentWidth, images);

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

          const blockquoteContent = tokensToPdfmake(blockquoteTokens, pageContentWidth, images);
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
          const inlineContent = processInlineTokens(token.children, pageContentWidth, images);
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

          const tableContent = processTableTokens(tableTokens, pageContentWidth, images);
          content.push(tableContent);
        }
        break;

      default:
        tokenIndex++;
        break;
    }
  }

  return content;
}

/**
 * Transforms a flat array of Markdown-It tokens into a nested structure.
 *
 * @param {Array<Object>} tokens - The flat array of Markdown-It tokens.
 * @returns {Array<Object>} - The nested array of tokens.
 * @throws {Error} - If there are unmatched _close tokens or unclosed _open tokens.
 */
function nestTokens(tokens) {
  const root = []; // Root level tokens
  const stack = []; // Stack to manage nesting

  tokens.forEach((token, index) => {
    if (token.type.endsWith("_open")) {
      // Create a new token without the '_open' suffix and initialize children
      const newToken = { ...token };
      newToken.type = newToken.type.replace(/_open$/, "");
      newToken.children = [];

      // Attach to the current parent if exists, else to root
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(newToken);
      } else {
        root.push(newToken);
      }

      // Push the new token onto the stack
      stack.push(newToken);
    } else if (token.type.endsWith("_close")) {
      const type = token.type.replace(/_close$/, "");

      if (stack.length === 0) {
        throw new Error(`Unexpected closing token "${token.type}" at index ${index}`);
      }

      const last = stack.pop();

      if (last.type !== type) {
        throw new Error(
          `Token mismatch: expected closing for "${last.type}", but found "${token.type}" at index ${index}`
        );
      }
      // _close tokens are not added to the nested structure
    } else {
      // Regular tokens are added to the current parent or root
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(token);
      } else {
        root.push(token);
      }
    }
  });

  if (stack.length !== 0) {
    const unclosed = stack.map((t) => t.type).join(", ");
    throw new Error(`Some tokens were not closed: ${unclosed}`);
  }

  return root;
}

// Helper function to process table tokens
function processTableTokens(tokens, pageContentWidth, images) {
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
                  const text = processInlineTokens(inlineToken.children, pageContentWidth, images);
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
                  const text = processInlineTokens(inlineToken.children, pageContentWidth, images);
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

function processInlineTokens(inlineTokens, pageContentWidth, images) {
  const content = [];

  let currentStyles = {};
  let link = null;

  inlineTokens.forEach((token) => {
    switch (token.type) {
      case "text":
        {
          // Remove backslashes used for empty lines. pdfdmake expects at least a space to insert a paragraph
          const sanitizedText = token.content === "\\" ? " " : token.content;
          const textChunk = { text: sanitizedText };
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

      case "s_open":
        currentStyles.decoration = "lineThrough";
        break;

      case "s_close":
        delete currentStyles.decoration;
        break;

      case "link_open":
        link = token.attrs.find((attr) => attr[0] === "href")[1];
        break;

      case "link_close":
        link = null;
        break;

      case "html_inline":
        // process mark/open and close here
        const parser = new DOMParser();
        const parsedHtml = parser.parseFromString(token.content, "text/html");
        const markElement = parsedHtml.querySelector("mark");

        // We only support mark elements
        if (markElement) {
          // Handle <mark> tag with styles
          const style = markElement.getAttribute("style");
          if (style) {
            style.split(";").forEach((attr) => {
              const [key, value] = attr.split(":").map((str) => str.trim());
              if (key === "background-color") {
                currentStyles.background = value;
              } else if (key === "color") {
                currentStyles.color = value;
              }
            });
          }
        } else if (token.content.includes("</mark>")) {
          // Handle closing </mark> tag
          delete currentStyles.background;
          delete currentStyles.color;
        }
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
          const imageNameParts = token.content.split("|");

          // Extract the image width from the name "name|width", or default to 250px
          const origWidth =
            imageNameParts.length > 1
              ? parseInt(imageNameParts[imageNameParts.length - 1], 10)
              : 250;
          const width = origWidth > pageContentWidth ? pageContentWidth : origWidth;

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
            width: width, // Adjust as needed
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

function groupInlineContent(inlineContent, pageContentWidth) {
  const groupedContent = [];

  // Determine if we need to render the paragraph with inline-block for the image, or we can collapse it to one text group.
  const hasImage = inlineContent.some((element) => element.image);

  if (!hasImage) {
    // No images, return as text
    if (inlineContent.length > 1) {
      return [{ text: inlineContent }];
    } else {
      return [inlineContent];
    }
  } else if (inlineContent.length === 1) {
    // If only one element and it is an image, then just return the image.
    return [inlineContent];
  }

  // When images and text are present, group content into columns
  let columnGroups = [];
  let currentGroup = [];
  const pushGroup = function () {
    // Add it as an array if more than one text element, otherwise just add the element directly
    currentGroup.length === 1
      ? columnGroups.push(currentGroup[0])
      : columnGroups.push({ text: currentGroup });
    currentGroup = [];
  };
  inlineContent.forEach((element) => {
    if (element.image) {
      if (currentGroup.length > 0) {
        // Push the group
        pushGroup();
      }
      // Images are their own column
      columnGroups.push(element);
    } else {
      currentGroup.push(element);
    }
  });

  // Add any remaining text elements
  if (currentGroup.length > 0) {
    pushGroup();
  }

  // TODO: Determine wrapping and max image size

  // Assign text widths -- * for last, auto for rest
  columnGroups.forEach((group, idx) => {
    if (group.text) {
      const isLast = idx === columnGroups.length - 1;
      group.width = isLast ? "*" : "auto";
    }
  });

  // Build columns
  return [{ columns: columnGroups }];
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
