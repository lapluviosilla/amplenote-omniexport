import { getAppInterface } from "./api_singleton";
import {
  loadImageAsDataURL,
  proxifyAsset,
  loadImageAsBlob,
  loadAttachment,
  BrokenImage,
  isAttachmentURL,
  loadImage,
  escapeUrl,
} from "./utilities";

/**
 * A markdown it plugin to handle all our asset exporting including name caching, asset loading, and either base64 or local file reference path exporting
 * options:
 *   - imageStrategy: [(dataurl)|local|uniqueId|proxify|ignore|silent]
 *   - attachmentStrategy: [local|ignore|(silent)]
 *   - exportAttachments: boolean (false) -- Equivalent to setting attachmentStrategy to "local"
 * Usage:
 *
 */
export class AssetExporter {
  constructor(options = {}) {
    this.options = {
      ...{
        imageStrategy: "dataurl",
        attachmentStrategy: "silent",
        imageFolder: "images",
        attachmentFolder: "attachments",
        assetFilenamePrefix: null,
        exportAttachments: false,
        replaceBrokenImages: true,
        renderGifAsStill: false,
      },
      ...options,
    };
    if (this.options.exportAttachments) this.options.attachmentStrategy = "local";
    this.pathCache = [];
    this.urlCache = {};
    this.collectedImages = {}; // All embedded or proxified images { originalUrl: { src, filePath, uniqueId, type } }
    this.collectedAttachments = {}; // { originalHref: { href, filePath, uniqueId, type } }
    this.idCounters = {}; // For uniqueId strategy

    this.asset_plugin = this.asset_plugin.bind(this); // Bind the asset plugin so it can access this asset exporter
  }
  initialize() {}

  setAssetFilenamePrefix(prefix) {
    this.options.assetFilenamePrefix = prefix;
  }

  resetAssetFilenamePrefix() {
    this.options.assetFilenamePrefix = null;
  }

  setAssetStrategy(imageStrategy, attachmentStrategy) {
    this.options.imageStrategy = imageStrategy;
    this.options.attachmentStrategy = attachmentStrategy;
  }

  asset_plugin(md) {
    // Ensure the asyncRenderPlugin is added
    if (!md.renderAsync) {
      md.use(asyncRenderPlugin);
    }

    // If it doesn't have render with assets then install
    if (!md.renderWithAssets) {
      const _boundProcessAssets = this.processAssets.bind(this);
      md.renderWithAssets = function (src, env = {}) {
        return this.renderAsync(src, env, _boundProcessAssets);
      };
    }

    // Use a core ruler to collect assets during parsing
    md.core.ruler.push("collect_assets", (state) => {
      this._collectAssets(state.tokens, state.env);
    });
  }

  _collectAssets(tokens, env) {
    const self = this;

    function traverse(tokens, inHiddenAttachment) {
      let currentInHiddenAttachment = inHiddenAttachment;

      for (let idx = 0; idx < tokens.length; idx++) {
        const token = tokens[idx];

        // If we're in a hidden attachment, hide the token and continue
        if (currentInHiddenAttachment && token.type !== "link_close") {
          token.hidden = true;
          // Recursively process children tokens
          if (token.children && token.children.length > 0) {
            traverse(token.children, currentInHiddenAttachment);
          }
          continue;
        }

        if (token.type === "image") {
          if (self.options.imageStrategy === "silent") {
            token.hidden = true;
          } else {
            self._collectImageToken(token);
          }
        } else if (token.type === "link_open") {
          const href = token.attrGet("href");
          if (isAttachmentURL(href)) {
            if (self.options.attachmentStrategy === "silent") {
              currentInHiddenAttachment = true;
              token.hidden = true;
            } else {
              // Get the next token to extract the filename
              let filename = "attachment";
              let textToken = tokens[idx + 1];
              if (textToken && textToken.type === "text") {
                filename = textToken.content;
              }
              self._collectAttachmentToken(token, href, filename);
              // No need to collect all tokens
            }
          }
        } else if (token.type === "link_close") {
          if (currentInHiddenAttachment) {
            currentInHiddenAttachment = false;
            token.hidden = true;
          }
        }

        // Recursively process children tokens
        if (token.children && token.children.length > 0) {
          traverse(token.children, currentInHiddenAttachment);
        }
      }
    }

    traverse(tokens, false);
  }

  _collectImageToken(token) {
    const imgSrc = token.attrGet("src");
    const strategy = this.options.imageStrategy;

    if (strategy === "ignore") {
      return;
    }

    if (!this.collectedImages[imgSrc]) {
      this.collectedImages[imgSrc] = { tokens: [], type: "image", src: imgSrc };
    }
    this.collectedImages[imgSrc].tokens.push(token);
  }

  _collectAttachmentToken(linkToken, href, filename) {
    const strategy = this.options.attachmentStrategy;

    if (strategy === "ignore") {
      return;
    }

    if (!this.collectedAttachments[href]) {
      this.collectedAttachments[href] = {
        tokens: [],
        filenames: [],
        type: "attachment",
        src: href,
      };
    }
    // Store the linkToken and the filename
    this.collectedAttachments[href].tokens.push(linkToken);
    this.collectedAttachments[href].filenames.push(filename);
  }

  async processAssets(_tokens, _env) {
    // Process images and modify tokens
    await Promise.all(
      Object.keys(this.collectedImages).map(async (imgSrc) => {
        const tokensInfo = this.collectedImages[imgSrc];
        const strategy = this.options.imageStrategy;
        let newSrc = imgSrc;
        if (!this.collectedImages[imgSrc].processed) {
          // If this asset is not processed, then process it

          if (strategy === "dataurl") {
            let dataUrl = await loadImageAsDataURL(imgSrc, this.options.renderGifAsStill);
            if (!dataUrl && this.options.replaceBrokenImages) {
              dataUrl = BrokenImage;
            }
            newSrc = dataUrl || imgSrc;
            this.urlCache[imgSrc] = newSrc;
          } else if (strategy === "local") {
            const filePath = this._getUniqueFilePath(imgSrc, "image");
            this.urlCache[imgSrc] = escapeUrl(filePath);
            // Collect image info for later streaming
            this.collectedImages[imgSrc].filePath = filePath;
            this.collectedImages[imgSrc].type = "image";
          } else if (strategy === "uniqueId") {
            const uniqueId = this._getUniqueId("image");
            this.urlCache[imgSrc] = uniqueId;
            this.collectedImages[imgSrc].uniqueId = uniqueId;
            this.collectedImages[imgSrc].type = "image";
          } else if (strategy === "proxify") {
            let proxifiedUrl = proxifyAsset(imgSrc);
            if (!proxifiedUrl && this.options.replaceBrokenImages) {
              proxifiedUrl = BrokenImage;
            }
            newSrc = proxifiedUrl || imgSrc;
            this.urlCache[imgSrc] = newSrc;
          }
          this.collectedImages[imgSrc].strategy = strategy;
          this.collectedImages[imgSrc].processed = true; // Flag as processed asset
        }

        // Modify all new tokens associated with this imgSrc
        tokensInfo.tokens.forEach((token) => {
          if (token.meta && token.meta.assetProcessed) return; // We only care about new tokens that are unprocessed

          token.attrSet("src", this.urlCache[imgSrc]);

          // Handle width and alt text
          const imageNameParts = token.content.split("|");
          const width =
            imageNameParts.length > 1
              ? parseInt(imageNameParts[imageNameParts.length - 1], 10)
              : null;
          if (width) {
            token.attrSet("width", width);
            const imageName = imageNameParts.slice(0, imageNameParts.length - 1).join("|");
            token.content = token.children[0].content = imageName;
          }

          if (!token.meta) token.meta = {};
          token.meta.assetProcessed = true;
        });
      })
    );

    // Process attachments and modify tokens
    await Promise.all(
      Object.keys(this.collectedAttachments).map(async (href) => {
        const attachmentInfo = this.collectedAttachments[href];
        const strategy = this.options.attachmentStrategy;

        if (!attachmentInfo.processed) {
          if (strategy === "local") {
            // Use the filename collected
            let filename = attachmentInfo.filenames[0] || "attachment";
            const filePath = this._getUniqueFilePath(filename, "attachment");
            this.urlCache[href] = escapeUrl(filePath); // test with file
            attachmentInfo.filePath = filePath;
          } else if (strategy === "uniqueId") {
            const uniqueId = this._getUniqueId("attachment");
            this.urlCache[href] = uniqueId;
            attachmentInfo.filePath = uniqueId;
          }
          attachmentInfo.strategy = strategy;
          attachmentInfo.processed = true;
        }

        // Modify all link_open tokens associated with this href
        attachmentInfo.tokens.forEach((linkToken) => {
          if (linkToken.meta && linkToken.meta.assetProcessed) return;
          linkToken.attrSet("href", this.urlCache[href]);

          if (!linkToken.meta) linkToken.meta = {};
          linkToken.meta.assetProcessed = true;
        });
      })
    );
  }

  // Reusing code in getImages and getAttachments by reading from the stream functions
  async getLocalImages() {
    return this._collectFromStream(this.streamLocalImages());
  }

  async getLocalAttachments() {
    return this._collectFromStream(this.streamLocalAttachments());
  }

  async getLocalAssets() {
    return this._collectFromStream(this.streamLocalAssets());
  }

  async _collectFromStream(stream) {
    const assets = [];
    const reader = stream.getReader();
    let result;
    while (!(result = await reader.read()).done) {
      assets.push(result.value);
    }
    return assets;
  }

  /**
   * Get a readable stream of all the collected images for local saving
   * @returns {ReadableStream} of images
   */
  streamLocalImages() {
    const assetsIterator = Object.values(this.collectedImages)
      .filter((i) => i.strategy === "local")
      [Symbol.iterator]();
    return this._createAssetStreamFromIterator(assetsIterator);
  }

  /**
   * Get a readable stream of all the collected attachments for local saving
   * @returns {ReadableStream} of attachments
   */
  streamLocalAttachments() {
    const assetsIterator = Object.values(this.collectedAttachments)
      .filter((i) => i.strategy === "local")
      [Symbol.iterator]();
    return this._createAssetStreamFromIterator(assetsIterator);
  }

  /**
   * Get a readable stream of all collected assets for local saving
   * @returns {ReadableStream} of assets
   */
  streamLocalAssets() {
    const allAssets = [
      ...Object.values(this.collectedImages),
      ...Object.values(this.collectedAttachments),
    ];
    const assetsIterator = allAssets.filter((a) => a.strategy === "local")[Symbol.iterator]();
    return this._createAssetStreamFromIterator(assetsIterator);
  }

  // Used by stream generators to create a asset stream. Returns a ReadableStream that can be piped directly to conflux
  _createAssetStreamFromIterator(assetsIterator) {
    const self = this;
    return new ReadableStream({
      async pull(controller) {
        let result;
        do {
          // get next asset
          result = assetsIterator.next();
          if (result.done) {
            controller.close();
            return;
          }

          const assetInfo = result.value;
          const name = assetInfo.filePath || assetInfo.uniqueId;

          let response;
          // Load the asset
          if (assetInfo.type === "image") {
            response = await loadImage(assetInfo.src, self.options.renderGifAsStill);
            if (!response && self.options.replaceBrokenImages) {
              response = await fetch(BrokenImage);
            }
          } else if (assetInfo.type === "attachment") {
            response = await loadAttachment(assetInfo.src);
          }

          // If the asset was found, then queue it
          if (response) {
            const mimeType = response.headers.get("content-type");

            controller.enqueue({
              name,
              mimeType,
              blob: async () => await response.blob(),
              stream: () => response.body,
            });
            return; // Asset enqueued, exit pull
          } else {
            console.info("Could not find asset: " + name);
          }
        } while (true); // Continue until an asset is enqueued or stream is closed
      },
    });
  }
  // Helper methods that depend on the state of AssetExporter are kept inside the class
  _getUniqueFilePath(url, type) {
    const { assetFilenamePrefix, imageFolder, attachmentFolder } = this.options;
    let folder = type === "image" ? imageFolder : attachmentFolder;
    let filename = extractFilename(url);
    if (assetFilenamePrefix) {
      folder = `${folder}/${assetFilenamePrefix}`;
    }
    let filePath = `${folder}/${filename}`;

    // Ensure uniqueness
    let uniqueFilePath = filePath;
    let counter = 1;
    while (this.pathCache.includes(uniqueFilePath)) {
      uniqueFilePath = `${folder}/${addSuffixToFilename(filename, "-" + counter)}`;
      counter++;
    }
    this.pathCache.push(uniqueFilePath);
    return uniqueFilePath;
  }

  _getUniqueId(type) {
    if (!this.idCounters[type]) {
      this.idCounters[type] = 1;
    } else {
      this.idCounters[type]++;
    }
    return `${type}${this.idCounters[type]}`;
  }
}

// Utility functions moved outside the class
function extractFilename(urlOrName) {
  const match = urlOrName.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/);
  return match ? match[0] : urlOrName;
}

function addSuffixToFilename(filename, suffix) {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) {
    return filename + suffix;
  } else {
    return filename.substring(0, dotIndex) + suffix + filename.substring(dotIndex);
  }
}

// The generic asyncRenderPlugin
/**
 * This plugin allows you to do some asynchronous processing between the parse and render steps of markdown-it
 * Current limitations of markdown-it only allow you to do synchronous processing within the parse and render rules.
 * This is the only way to do some processing pre-render asynchronously.
 */
function asyncRenderPlugin(md) {
  /**
   * md.renderAsync(src, env, asyncCallback) -> Promise<String>
   * - src (String): source string
   * - env (Object): environment sandbox
   * - asyncCallback (Function): async function(tokens, env)
   *
   * Parses the markdown source, calls the asyncCallback with tokens and env,
   * waits for the promise to resolve, then renders the tokens.
   **/
  md.renderAsync = async function (src, env = {}, asyncCallback) {
    const tokens = md.parse(src, env);

    // Call the async callback with the tokens and env
    if (typeof asyncCallback === "function") {
      await asyncCallback(tokens, env);
    }

    return md.renderer.render(tokens, md.options, env);
  };
}
