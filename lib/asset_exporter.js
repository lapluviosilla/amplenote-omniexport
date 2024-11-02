import { getAppInterface } from "./api_singleton";
import { asyncRenderPlugin } from "./markdown_it_async_render_plugin";
import {
  loadImageAsDataURL,
  proxifyAsset,
  loadAttachment,
  BrokenImage,
  isAttachmentURL,
  loadImage,
  escapeUrl,
  gifBlobToStillImage,
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
        exportAttachments: null, // This setting overrides the attachment strategy, so even if a file type sets strategy to "local" if this is false we will ignore it
        replaceBrokenImages: true,
        renderGifAsStill: false,
      },
      ...options,
    };
    if (this.options.exportAttachments) this.options.attachmentStrategy = "local"; // Initially set attachment strategy to local if exporting
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

  /** Used for setting the current or default attachment strategy per export type */
  setAssetStrategy(imageStrategy, attachmentStrategy) {
    this.options.imageStrategy = imageStrategy;
    this.options.attachmentStrategy = attachmentStrategy;
  }

  /**
   * Inject the asset exporter as a plugin into the markdown it instance
   * We have to do this step to be able to capture the markdown assets as we render
   * @param {*} md MarkdownIt instance
   */
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

  /** Internal function called during the parsing stage where we collect all the image and attachment tokens */
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
            if (
              self.options.exportAttachments === false ||
              self.options.attachmentStrategy === "silent"
            ) {
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

  /** Internal function to record an image token */
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

  /** Internal function to record an attachment token */
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

  /**
   * In the async step between markdown parsing and rendering we do all the asset processing (but not downloading)
   * Based of asset strategies figure out what to change file paths to and which assets to include or ignore
   * Can also be called directly if token processing is done by hand instead of using a renderer
   */
  async processAssets(_tokens, _env) {
    // Process images and modify tokens
    await Promise.all(
      Object.keys(this.collectedImages).map(async (imgSrc) => {
        const tokensInfo = this.collectedImages[imgSrc];
        const strategy = this.options.imageStrategy;
        let newSrc = imgSrc;
        if (!this.collectedImages[imgSrc].processed) {
          // If this asset is not processed, then process it

          // Set file path and other info based on current image strategy
          if (strategy === "dataurl") {
            let dataUrl = await loadImageAsDataURL(imgSrc, this.options.renderGifAsStill);
            if (!dataUrl && this.options.replaceBrokenImages) {
              dataUrl = BrokenImage;
            }
            newSrc = dataUrl || imgSrc;
            this.urlCache[imgSrc] = newSrc;
          } else if (strategy === "local") {
            let newSrc = imgSrc;
            const fileNameParts = newSrc.split(".");
            if (this.options.renderGifAsStill && fileNameParts.pop() === "gif") {
              // If gif rendering as still go ahead and change path name to png
              fileNameParts.push("png");
              newSrc = fileNameParts.join(".");
            }
            const filePath = this._getUniqueFilePath(newSrc, "image");
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

        // Modify all new tokens associated with this imgSrc and set file paths appropriately
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

  /**
   * Call if you just need the images without streaming
   * @returns {Array[Object]} all the loaded local images
   */
  async getLocalImages() {
    return this._collectFromStream(this.streamLocalImages());
  }

  /**
   * Call if you just need the attachments without streaming
   * @returns {Array[Object]} all the loaded local attachments
   */
  async getLocalAttachments() {
    return this._collectFromStream(this.streamLocalAttachments());
  }

  /**
   * Call if you just need the assets(images & attachments)
   * @returns {Array[Object]} all the loaded local assets
   */
  async getLocalAssets() {
    return this._collectFromStream(this.streamLocalAssets());
  }

  /** Internal function to turn stream to array */
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
        // the reader wants more assets
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
            response = await loadImage(assetInfo.src);

            // If it's a gif and we're rendering as still then process it into a still image
            if (
              response &&
              response.headers.get("content-type") === "image/gif" &&
              self.options.renderGifAsStill
            ) {
              const blob = await response.blob();
              const stillImageBlob = await gifBlobToStillImage(blob);
              response = new Response(stillImageBlob, {
                headers: { "Content-Type": "image/png" },
              });
            }
            // If we want placeholder images for broken images then replace it
            if (!response && self.options.replaceBrokenImages) {
              response = await fetch(BrokenImage);
            }
          } else if (assetInfo.type === "attachment") {
            // Load the attachment
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
  /** Generates a unique filepath / filename for the asset */
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

  /** Generates a unique id for the uniqueid strategy */
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
