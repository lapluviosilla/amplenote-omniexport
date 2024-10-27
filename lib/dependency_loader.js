// moduleLoader.js
// Create a Map to store module states
const moduleCache = new Map();

/**
 * Loads a UMD module by inserting a script tag into the document.
 * Caches the loaded module and handles concurrent loading requests.
 *
 * @param {string} url - The CDN URL of the UMD module.
 * @param {string} exportName - The global variable name exposed by the UMD module.
 * @returns {Promise<any>} - A promise that resolves to the loaded module.
 */
export async function loadUMDModule(url, exportName) {
  // Check if the module is already in the cache
  if (moduleCache.has(url)) {
    const cached = moduleCache.get(url);
    if (cached.module) {
      // Module already loaded
      return cached.module;
    }
    if (cached.promise) {
      // Module is currently loading
      return cached.promise;
    }
  }

  // Create a promise to load the module
  const promise = new Promise((resolve, reject) => {
    // Create the script element
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.async = true;

    // Handle successful loading
    script.onload = () => {
      // Check if the module is available on the global scope
      const exportParts = exportName.split(".");
      let module = window[exportParts.shift()];
      exportParts.forEach((part) => {
        module = module ? module[part] : null;
      });
      if (module) {
        // Cache the loaded module
        moduleCache.set(url, { module, promise: null });
        resolve(module);
      } else {
        // Module not found after script load
        reject(new Error(`Module "${exportName}" not found on window after loading ${url}`));
      }
    };

    // Handle loading errors
    script.onerror = () => {
      // Remove from cache on error
      moduleCache.delete(url);
      reject(new Error(`Failed to load script: ${url}`));
    };

    // Append the script to the document to start loading
    document.body.appendChild(script);
  });

  // Cache the loading promise
  moduleCache.set(url, { module: null, promise });

  return promise;
}

/**
 * Loads the 'markdown-it' UMD module.
 * @returns {Promise<any>} - A promise that resolves to the 'markdownit' global object.
 */
export function loadMarkdownIt() {
  const url = "https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js";
  const exportName = "markdownit"; // The global variable exposed by 'markdown-it'
  return loadUMDModule(url, exportName);
}

/**
 * Loads the 'StreamSaver' UMD module.
 */
export function loadStreamSaver() {
  const url = "https://cdn.jsdelivr.net/npm/streamsaver@2.0.6/StreamSaver.min.js";
  const exportName = "streamSaver"; // The global variable exposed by 'streamSaver'
  return loadUMDModule(url, exportName);
}

// File Saver
// export function loadFileSaver() {
//   const url = "https://cdn.jsdelivr.net/npm/file-saver/dist/FileSaver.min.js";
//   const exportName = "saveAs";
//   return loadUMDModule(url, exportName);
// }

export function loadPdfMake() {
  const url = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.4/pdfmake.min.js";
  const exportName = "pdfMake";
  return loadUMDModule(url, exportName);
}

export function loadVfsfonts() {
  const url = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.4/vfs_fonts.js";
  const exportName = "pdfMake.vfs";
  return loadUMDModule(url, exportName);
}

export function loadHtmlDocx() {
  const url = "https://cdn.jsdelivr.net/npm/html-docx-js/dist/html-docx.js";
  const exportName = "htmlDocx";
  return loadUMDModule(url, exportName);
}

export function loadEpubGenMemory() {
  const url = "https://unpkg.com/epub-gen-memory@1.1.2/dist/bundle.min.js";
  const exportName = "epubGen";
  return loadUMDModule(url, exportName);
}

export function loadConflux() {
  const url = "https://cdn.jsdelivr.net/npm/@transcend-io/conflux@4.1/dist/conflux.umd.min.js";
  const exportName = "conflux";
  return loadUMDModule(url, exportName);
}

// export function loadPonyfillWebstreams() {
//   const url = "https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js";
//   const exportName = "WebStreamsPolyfill";
//   return loadUMDModule(url, exportName);
// }

// export function loadNativeFileSystemAdapter() {
//   const url = "https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js";
//   const exportName = "WebStreamsPolyfill";
//   return loadUMDModule(url, exportName);
// }
