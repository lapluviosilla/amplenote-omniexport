import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AssetExporter } from "./asset_exporter";
import { loadMarkdownIt } from "./dependency_loader";

import {
  BrokenImage,
  loadImage,
  loadImageAsDataURL,
  loadAttachment,
  proxifyAsset,
} from "./utilities";

vi.mock("./dependency_loader");
vi.mock("./utilities");

const markdownit = await loadMarkdownIt();

describe("AssetExporter", () => {
  let md;
  let assetExporter;

  beforeEach(() => {
    // Load markdown-it instance
    md = markdownit({
      html: true,
      linkify: true,
      typographer: true,
    });

    // Create an instance of AssetExporter with default options
    assetExporter = new AssetExporter();

    // Use the assetExporter plugin
    md.use(assetExporter.asset_plugin);
    // assetExporter.asset_plugin(md);
  });

  afterEach(() => {
    // Reset all mocks before each test
    // vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("should process images with dataurl strategy", async () => {
    // Arrange
    const src = "![Alt text](image.png)";
    const mockDataUrl = "data:image/png;base64,FAKE_BASE64_DATA";

    loadImageAsDataURL.mockResolvedValue(mockDataUrl);

    // Act
    const result = await md.renderWithAssets(src, {});

    // Assert
    expect(loadImageAsDataURL).toHaveBeenCalledWith("image.png", false);
    expect(result).toContain(`<img src="${mockDataUrl}" alt="Alt text">`);
  });

  it("should process images with local strategy", async () => {
    // Arrange
    assetExporter.options.imageStrategy = "local";
    const src = "![Alt text](image.png)";

    // Act
    const result = await md.renderWithAssets(src, {});

    // Assert

    const images = await assetExporter.getLocalImages();

    expect(loadImage).toHaveBeenCalledWith("image.png", false);
    expect(result).toContain(`<img src="images/image.png" alt="Alt text">`);
    expect(images.length).toBe(1);
    expect(images[0].name).toBe("images/image.png");
    expect(images[0].stream()).toBeInstanceOf(ReadableStream);
    expect((await images[0].blob()).constructor.name).toEqual("Blob");
  });

  it("should process images with uniqueId strategy", async () => {
    // Arrange
    assetExporter.options.imageStrategy = "uniqueId";
    const src = "![Alt text](image.png)";

    // Act
    const result = await md.renderWithAssets(src, {});

    const images = await assetExporter.getLocalImages();

    // Assert
    // TODO: Re-enable after we due true single pdf unique id export
    // expect(loadImage).toHaveBeenCalledWith("image.png", false);
    expect(result).toContain(`<img src="image1" alt="Alt text">`);

    // expect(images.length).toBe(1);
    // expect(images[0].name).toBe("image1");
    // expect((await images[0].blob()).constructor.name).toEqual("Blob");
  });

  it("should process attachments with local strategy", async () => {
    // Arrange
    assetExporter.options.attachmentStrategy = "local";
    const src = "[file.pdf](attachment://uniqueid)";
    const mockBlob = new Blob(["fake attachment data"], { type: "application/pdf" });

    loadAttachment.mockResolvedValue(new Response([mockBlob]));

    // Act
    const result = await md.renderWithAssets(src, {});

    const attachments = await assetExporter.getLocalAttachments();

    // Assert
    expect(loadAttachment).toHaveBeenCalledWith("attachment://uniqueid");
    expect(result).toContain(`<p><a href="attachments/file.pdf">file.pdf</a></p>`);

    expect(attachments.length).toBe(1);
    expect(attachments[0].name).toBe("attachments/file.pdf");
    expect((await attachments[0].blob()).constructor.name).toEqual("Blob");
  });

  it("should process attachments with uniqueId strategy", async () => {
    // Arrange
    assetExporter.options.attachmentStrategy = "uniqueId";
    const src = "[File.pdf](attachment://1482djfi)";
    const mockBlob = new Blob(["fake attachment data"], { type: "application/pdf" });

    loadAttachment.mockResolvedValue(new Response([mockBlob]));

    // Act
    const result = await md.renderWithAssets(src, {});

    await assetExporter.getLocalAttachments();

    // Assert
    // TODO: Re-enable after we have true single PDF unique id export
    // expect(loadAttachment).toHaveBeenCalledWith("attachment://1482djfi");
    expect(result).toContain(`<a href="attachment1">File.pdf</a>`);

    const attachments = await assetExporter.getLocalAttachments();
    // expect(attachments.length).toBe(1);
    // expect(attachments[0].name).toBe("attachment1");
    // expect((await attachments[0].blob()).constructor.name).toEqual("Blob");
  });

  it("should handle missing images with replaceBrokenImages set to true", async () => {
    // Arrange
    assetExporter.options.replaceBrokenImages = true;
    const src = "![Alt text](missing-image.png)";

    loadImageAsDataURL.mockResolvedValue(null); // Simulate missing image

    // Act
    const result = await md.renderWithAssets(src, {});

    // Assert
    expect(loadImageAsDataURL).toHaveBeenCalledWith("missing-image.png", false);
    expect(result).toContain(`<img src="${BrokenImage}" alt="Alt text">`);
  });

  it("should handle missing images with replaceBrokenImages set to false", async () => {
    // Arrange
    assetExporter.options.replaceBrokenImages = false;
    const src = "![Alt text](missing-image.png)";

    loadImageAsDataURL.mockResolvedValue(null); // Simulate missing image

    // Act
    const result = await md.renderWithAssets(src, {});

    // Assert
    expect(loadImageAsDataURL).toHaveBeenCalledWith("missing-image.png", false);
    expect(result).toContain(`<img src="missing-image.png" alt="Alt text">`);
  });

  it("should skip missing attachments", async () => {
    // Arrange
    assetExporter.options.attachmentStrategy = "local";
    const src = "[missing.pdf](attachment://38295-ijfe)";

    loadAttachment.mockResolvedValue(null); // Simulate missing attachment

    // Act
    const result = await md.renderWithAssets(src, {});
    await assetExporter.getLocalAttachments();

    // Assert
    expect(loadAttachment).toHaveBeenCalledWith("attachment://38295-ijfe");
    expect(result).toContain(`<p><a href="attachments/missing.pdf">missing.pdf</a></p>`);

    const attachments = await assetExporter.getLocalAttachments();
    expect(attachments.length).toBe(0); // Attachment was not added due to missing blob
  });

  it("should remove images with silent strategy", async () => {
    // Arrange
    assetExporter.options.imageStrategy = "silent";
    const src = "![Alt text](image.png)";

    // Act
    const result = await md.renderWithAssets(src, {});

    // Assert
    expect(result).not.toContain(`<img`);
  });

  it("should remove attachments with silent strategy", async () => {
    // Arrange
    assetExporter.options.attachmentStrategy = "silent";
    const src = "[Attachment](attachment://file.pdf)";

    // Act
    const result = await md.renderWithAssets(src, {});

    // Assert
    expect(result).not.toContain(`<a`);
  });

  it("should proxify images with proxify strategy", async () => {
    // Arrange
    assetExporter.options.imageStrategy = "proxify";
    const src = "![Alt text](image.png)";

    // Mock proxifyAsset function
    proxifyAsset.mockReturnValue("https://proxy.example.com/image.png");

    // Act
    const result = await md.renderWithAssets(src, {});

    // Assert
    expect(proxifyAsset).toHaveBeenCalledWith("image.png");
    expect(result).toContain(`<img src="https://proxy.example.com/image.png" alt="Alt text">`);
  });

  it("should handle multiple images with the same src", async () => {
    // Arrange
    const src = `
![Image1](image.png)

![Image2](image.png)
    `;

    const mockDataUrl = "data:image/png;base64,FAKE_BASE64_DATA";
    loadImageAsDataURL.mockResolvedValue(mockDataUrl);

    // Act
    const result = await md.renderWithAssets(src, {});

    await assetExporter.getLocalImages();

    // Assert
    expect(loadImageAsDataURL).toHaveBeenCalledTimes(1); // Should only process once
    expect(result).toContain(`<img src="${mockDataUrl}" alt="Image1">`);
    expect(result).toContain(`<img src="${mockDataUrl}" alt="Image2">`);
  });

  it("should process image width and alt text correctly", async () => {
    // Arrange
    const src = "![Alt text|300](image.png)";
    const mockDataUrl = "data:image/png;base64,FAKE_BASE64_DATA";
    loadImageAsDataURL.mockResolvedValue(mockDataUrl);

    // Act
    const result = await md.renderWithAssets(src, {});

    // Assert
    expect(result).toContain(`<img src="${mockDataUrl}" alt="Alt text" width="300">`);
  });

  it("should handle asset prefixes", async () => {
    const src = `
![Alt text](image.png)
[file.pdf](attachment://uniqueid)
    `;
    const result = await md.renderWithAssets(src, {});
  });
  it("should skip non attachment links", async () => {
    const src = `[Google](https://google.com/logo.png)`;

    const result = await md.renderWithAssets(src, {});
    // const result = await md.renderAsync(src, {}, async (tokens, env) => {
    //   await assetExporter.processAssets(tokens, env);
    // });

    const attachments = await assetExporter.getLocalAttachments();

    expect(attachments).toEqual([]);
    expect(result).toContain(`<p><a href="https://google.com/logo.png">Google</a></p>`);
    expect(loadAttachment).toHaveBeenCalledTimes(0);
  });
  it("should only stream local assets", async () => {
    const src = `![Alt text](image.png) [attachment.pdf](attachment://12345)`;

    assetExporter.setAssetStrategy("dataurl", "local"); // only attachments as local
    const result = await md.renderWithAssets(src);
    // const result = await md.renderAsync(src, {}, async (tokens, env) => {
    //   await assetExporter.processAssets(tokens, env);
    // });

    const assets = await assetExporter.getLocalAssets();

    expect(assets.length).toEqual(1);
    expect(assets[0].name).toBe("attachments/attachment.pdf");
    expect(loadImageAsDataURL).toHaveBeenCalledTimes(1);
    expect(loadAttachment).toHaveBeenCalledTimes(1);
  });
  it("can render gifs as stills for local export", async () => {
    const src = "![Animated Image](test.gif)";
    assetExporter.setAssetStrategy("local", "local");
    assetExporter.options.renderGifAsStill = true;
    // window.URL.createObjectURL = v.fn();

    await md.renderWithAssets(src);

    const images = await assetExporter.getLocalImages();
    expect(images.length).toBe(1);
    expect(images[0].name).toEqual("images/test.png");
    expect(images[0].mimeType).toEqual("image/png");
  });
  it("can be bound to multiple markdown exporters and collect assets across them", async () => {
    const src = "![Image1](image.png)";
    const src2 = "![Image 1.5](image.png) ![Image2](image2.png)";

    assetExporter.options.imageStrategy = "local";

    const md2 = markdownit({
      html: true,
      linkify: true,
      typographer: true,
    });
    md2.use(assetExporter.asset_plugin);

    await md.renderWithAssets(src);
    const result = await md2.renderWithAssets(src2);

    const images = await assetExporter.getLocalImages();

    expect(images.length).toBe(2); // Since Image1.5 was a duplicate of Image1 it'll use the same asset
    expect(images[0].name).toBe("images/image.png");
    expect(images[1].name).toBe("images/image2.png");

    // It should use the asset from the first markdown, but the alt from this second markdown
    expect(result).toEqual(
      `<p><img src="images/image.png" alt="Image 1.5"> <img src="images/image2.png" alt="Image2"></p>\n`
    );
  });
});
