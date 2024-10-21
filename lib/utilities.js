/**
 * A helper function that loads an image through the amplenote CORS proxy and
 * encodes it as a Base64 String (for use in export documents).
 *
 * If the 'returnGifAsStillImage' flag is true, animated GIFs are rendered as still images (only the first frame).
 *
 * @param {String} url The url of the image to be loaded
 * @param {Boolean} returnGifAsStillImage If true, convert GIF to a still image
 * @returns Base64 encoded image
 */
export async function loadImageAsDataURL(url, returnGifAsStillImage = false) {
  try {
    const blob = await loadImageAsBlob(url);
    if (!blob) return null;

    // If the Blob is a GIF and we want a still image, handle it differently
    if (returnGifAsStillImage && blob.type === "image/gif") {
      // Create an image element to draw the first frame of the GIF
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);

          // Convert the canvas to a data URL (base64 encoding of a still image)
          const dataURL = canvas.toDataURL("image/png");
          resolve(dataURL);
        };

        img.onerror = () => {
          reject(new Error(`Failed to load image: ${url}`));
        };

        img.src = URL.createObjectURL(blob);
      });
    } else {
      // Otherwise, read the Blob as a data URL normally
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onloadend = () => {
          resolve(reader.result); // Base64-encoded data URL
        };
        reader.onerror = reject;

        // Convert the Blob to a data URL (base64 encoding)
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    console.warn(`Failed to load image: ${error.message}`);
    return null;
  }
}

/**
 * A helper function that loads on image through amplenote CORS proxy and
 * returns it as a Blob
 * @param {String} url The url of the image to be loaded
 * @returns Blob
 */

export async function loadImageAsBlob(url) {
  try {
    // Use the CORS proxy to fetch the image
    const proxyURL = new URL("https://plugins.amplenote.com/cors-proxy");
    proxyURL.searchParams.set("apiurl", url);

    // Fetch the image through the CORS proxy
    const response = await fetch(proxyURL.toString());
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${response.statusText}`);
      return null;
    }

    // Return the response as a Blob
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.warn(`Failed to load image: ${error.message}`);
    return null;
  }
}
/**
 * Usage example:
 * const blob = await loadImageAsBlob('https://example.com/image.png');
 * // You can then use this blob, for example, to create an object URL:
 * const objectURL = URL.createObjectURL(blob);
 */

/**
 * Does this text contain a markdown table?
 * @param {string} markdown text
 * @returns boolean
 */
export function hasMarkdownTable(text) {
  // Regex to match a fully formed markdown table
  const tableRegex = /\|(?:[^\n|]*\|)+\n\|(?:[\s\-:]*\|)+\n(\|(?:[^\n|]*\|)+\n)*/g;

  // Check if text matches the markdown table regex
  return tableRegex.test(text);
}

/** ------------------
 * Markdown Preprocessing
 */

/**
 * Amplenote Markdown has a weird artifact where Tables can have a "\" line immediately after them which messes with markdown it parsing.
 * Adds an extra newline between markdown tables and trailing "\" lines,
 * but only if the "\" line follows an empty line after the table.
 * @param {string} markdown - The markdown text.
 * @returns {string} - The modified markdown text with an extra newline added when necessary.
 */
export function addNewlineBeforeBackslashAfterTable(markdown) {
  // Regex to match a markdown table followed by \n, another \n, and a line containing only "\"
  const tableWithBackslashPattern =
    /(\|(?:[^\n|]*\|)+\n\|(?:[\s\-:]*\|)+\n(?:\|(?:[^\n|]*\|)+\n)*)\\\n/g;

  // Replace the match by adding another newline between the table and "\"
  return markdown.replace(tableWithBackslashPattern, "$1\n\\\n");
}

/**
 * Converts "\" on its own line into a break tag in the markdown text.
 * @param {string} markdown - The markdown text.
 * @returns {string} - The modified markdown text with "\\" converted to "\" on their own line.
 */
export function escapeBackslashNewlines(markdown) {
  // Regex to match lines that consist solely of "\\" (potentially surrounded by whitespace)
  const doubleBackslashLinePattern = /\\{1}$/gm;

  // Replace lines with ending "\" by a single "\".
  return markdown.replace(doubleBackslashLinePattern, "<br>");
}
