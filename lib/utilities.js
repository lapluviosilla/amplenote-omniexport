/**
 * A helper function that loads an image through the amplenote CORS proxy and
 * encodes it as a Base64 String (for use in export documents)
 * @param {String} url The url of the image to be loaded
 * @returns Base64 encoded image
 */
export async function loadImageAsDataURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Important for cross-origin images

    img.onload = function () {
      // Create a canvas to draw the image
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the image onto the canvas
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // Get the data URL of the image
      const dataURL = canvas.toDataURL("image/png");
      resolve(dataURL);
    };

    img.onerror = function () {
      reject(new Error(`Failed to load image: ${url}`));
    };

    // Use the CORS proxy to fetch the image
    const proxyURL = new URL("https://plugins.amplenote.com/cors-proxy");
    proxyURL.searchParams.set("apiurl", url);

    img.src = proxyURL.toString();
  });
}
