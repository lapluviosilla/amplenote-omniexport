import { getAppInterface } from "./api_singleton";

// ================
// Image Handling
// ================

/** A base64 encoded broken image icon */
export const BrokenImage =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAAXNSR0IArs4c6QAAA5NJREFUeF7tnU1S4zAQheWTDZwEqmCRW8DcIguogpOQOZkHFbgmY2y3XnfL+vFjk0Va/dzvk9qJbJwh8K+oA0NRdYoHAig8CQiAAAo7UFieK4AACjtQWJ4rgAAKO1BYniuAAAo7UFieK6B1APePp5sQws04hl/xtXA9e8lfhiH8eXs5P1sFTSvg/vH0PI7hyXoQLY8fhvDbAkINgOb/mzYWCCoANP/nmtVCUAG4eziNLbeNXMf+eV64fXs5X5D8MADO/nV7NasABnD3cPo40KcdZDLH2Mv76/kWGaQBwPaz4fD76xnyFAqOulL/Rw8AmS01xHrXTwAgVQIADfMOJwBvR8F8BAAa5h1OAN6OgvkIADTMO5wAvB0F8xEAaJh3OAF4OwrmIwDQMO9wAvB2FMxHAKBh3uEE4O0omO9QAL7vuAjoVSbQ09XwJf3DAIjFf97qEi/+BM2lPiuENf1DALgufjJyTwhb+t0DWCp+TwiS/rQq11YYekGqqgsyW8XvASFFX2ptzQJAis/RjhD9LQhNAtAU7wlBo99NC7IU7wHBor8EoakV4FG8BYKH/hxCMwA8i9dA8NS/htAEgBzFIxBy6E8QqgeQs/gUCDn1I4TiALZMQIuPuWJR0pef6xZQWr84gLW9G4350yacZewEx5IDGVsFgDkEpIDWAVYDYDKytRZibWFVAZD2Tebvlz6JpuhXvxuKmq7ZZENbWsoxpZgf83QJILX4ayM9ISD63QFAip/PZA8IqH5XANDil1qJBYJGvxsAmuLXerkGgla/CwDa4rdOpggEi37zACzFS59mUiBY9asHEAtc27uxFi8BiO9LF9Wt9xhVDyB+E1wyYQ/zt/Z9vPSbADCfiV7Fp6yAJQie+s0AmCDEV+uyR4yff1nz1m8KgNa4mscRQGE6BEAA2w9rQvfDC/sJy3MFwJb5DiAAXz/hbAQAW+Y7gAB8/YSzEQBsme8AAvD1E85GALBlvgMIwNdPOBsBwJb5DiAAXz/hbNUDgCvqbAC6FaP5N1U+unh90uR/dDEf3r3u/i4P706586CzrpJcDtp+YmK4BcVBXAU/mWhmvxoAIfwPQGu+CQAhfEGwmG8GMM2D75Z0uJ+xij/YYL3jQ3UOSD4rMVB0gABEi/IGEEBef8XsBCBalDeAAPL6K2YnANGivAEEkNdfMTsBiBblDSCAvP6K2QlAtChvAAHk9VfMTgCiRXkD/gLMqV2OlLhc6wAAAABJRU5ErkJggg==";

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
 * Asynchronously loads an image from a given URL as a Blob.
 * Uses a CORS proxy for Amplenote images and fetches others directly.
 * Returns null if the URL is invalid or if the fetch operation fails.
 *
 * @param {string} url - The URL of the image to load.
 * @returns {Promise<Blob|null>} - A promise that resolves to the image Blob or null.
 */
export async function loadImageAsBlob(url) {
  try {
    const fetchURL = proxifyImage(url);

    if (!fetchURL) return null;

    // Fetch the image (either directly or through the proxy)
    const response = await fetch(fetchURL, { mode: "cors" });

    if (!response.ok) {
      console.warn(
        `Bulk Export - Failed to fetch image: ${response.status} ${response.statusText}`
      );
      return null;
    }

    // Ensure the response is of type image
    const contentType = response.headers.get("Content-Type");
    if (!contentType || !contentType.startsWith("image/")) {
      console.warn(`Bulk Export - URL does not point to a valid image: ${url}`);
      return null;
    }

    // Return the response as a Blob
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.warn(`Bulk Export - Failed to load image: ${error.message}`);
    return null;
  }
}

/**
 * Converts a dataURL into an HTMLImageElement.
 * @param {String} dataURL - The image dataURLL.
 * @returns {Promise<HTMLImageElement>} - A Promise that resolves with the Image object.
 */
function loadImageFromDataURL(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error("Failed to load image from Blob."));
    };

    img.src = dataURL;
  });
}
export function proxifyImage(url) {
  // Validate the URL
  let parsedURL;
  try {
    parsedURL = new URL(url);
  } catch (e) {
    console.warn(`Bulk Export - Invalid URL provided: ${url}`);
    return BrokenImage;
  }

  // Ensure the URL uses HTTP or HTTPS protocol
  if (!["http:", "https:"].includes(parsedURL.protocol)) {
    console.warn(`Unsupported URL protocol (${parsedURL.protocol}): ${url}`);
    return BrokenImage;
  }

  // Check if the hostname is exactly "images.amplenote.com"
  if (parsedURL.hostname === "images.amplenote.com") {
    // If the URL is from images.amplenote.com, use the CORS proxy
    const proxyURL = new URL("https://plugins.amplenote.com/cors-proxy");
    proxyURL.searchParams.set("apiurl", url);
    return proxyURL.toString();
  } else {
    return url;
  }
}

// ============
// Cover Handling
// ============

/**
 * Promisifies the canvas.toBlob method.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {string} type - The MIME type of the image (e.g., 'image/png').
 * @param {number} [quality] - The image quality (for image/jpeg or image/webp).
 * @returns {Promise<Blob>} - A Promise that resolves with the Blob.
 */
function canvasToBlobAsync(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas is empty or conversion failed."));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Splits text into lines that fit within a given width.
 * @param {CanvasRenderingContext2D} ctx - The canvas 2D context.
 * @param {string} text - The text to wrap.
 * @param {number} maxWidth - The maximum width for each line.
 * @returns {string[]} - An array of text lines.
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (let word of words) {
    const testLine = currentLine + word + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && currentLine !== "") {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine.trim());
  return lines;
}

// Function to overlay text within the bounding box
function overlayText(ctx, boundingBox, text) {
  const { x, y, width, height } = boundingBox;

  const fontFamily = '"Segoe UI", "Helvetica Neue", "Helvetica", "Arial", sans-serif';

  // Set text properties
  // Start with a large font size and decrease until text fits
  let fontSize = 200; // Starting font size
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `${fontSize}px ${fontFamily}`;

  let lines = wrapText(ctx, text, width - 40); // 20px padding on each side
  // Adjust font size to fit within the bounding box height
  while (lines.length * (fontSize * 1.2) > height && fontSize > 10) {
    fontSize -= 2;
    ctx.font = `${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, text, width - 40);
  }

  // Calculate the starting y position to vertically center the text
  const totalTextHeight = lines.length * (fontSize * 1.2);
  let currentY = y + (height - totalTextHeight) / 2;

  // Optional: Add a semi-transparent background for better readability
  const textWidth = width;
  const textHeight = totalTextHeight;
  ctx.fillStyle = "rgb(49, 58, 71)";
  ctx.fillRect(x, y, width, height);

  // Set text color back to white
  ctx.fillStyle = "white";

  // Draw each line of text
  for (let line of lines) {
    ctx.fillText(line, x + width / 2, currentY);
    currentY += fontSize * 1.2; // Line height
  }
}

// Function to add title to cover image
export async function addTitleToCoverImage(img, titleText) {
  const image = await loadImageFromDataURL(img);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Set canvas dimensions to match the image
  canvas.width = 1600;
  canvas.height = 2600;

  // Draw the original image onto the canvas
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Define the bounding box for the title
  const boundingBox = {
    x: 285, // X position
    y: 1548, // Y position
    width: 1030, // Width of the box
    height: 800, // Height of the box
  };

  // Overlay the title text within the bounding box
  if (titleText) overlayText(ctx, boundingBox, titleText);

  // Export the modified image as a Blob and resolve the Promise

  const modifiedBlob = await canvasToBlobAsync(canvas, "image/png");

  return modifiedBlob;
}

/**
 * Usage example:
 * const blob = await loadImageAsBlob('https://example.com/image.png');
 * // You can then use this blob, for example, to create an object URL:
 * const objectURL = URL.createObjectURL(blob);
 */

// Internal wrapper function for app.saveFile API call
export async function saveAs(blob, fileName) {
  const app = getAppInterface();
  return app.saveFile(blob, fileName);
}

/** ------------------
 * Markdown Preprocessing
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

// -------

/** Helper function to generate markdown header for export */
export function generateMarkdownHeader(data) {
  const { name, uuid, created, updated, tags } = data;

  // Conditionally format tags if they are present and not empty
  const formattedTags =
    tags && tags.length > 0 ? `tags:\n${tags.map((tag) => `  - ${tag}`).join("\n")}\n` : "";

  return `---
title: '${name}'
uuid: ${uuid}
created: '${created}'
updated: '${updated}'
${formattedTags}---`;
}

// -------
// Other utilities
/**
 * parse ISO string for parsing updated/created at timestamps
 * @param {String} iso string
 * @returns Date
 */
export function parseISOString(s) {
  var b = s.split(/\D+/);
  return new Date(Date.UTC(b[0], --b[1], b[2], b[3], b[4], b[5], b[6]));
}

export function escapeCSVPart(s) {
  const val = (s && s.replaceAll(/\"/g, '""')) || "";
  return '"' + val + '"';
}
