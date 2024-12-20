// tests/bulk_exporter.test.js
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

// Mock dependency_loader.js

import { mockAppWithContent, mockNote } from "./test-helpers";

import { escapeCSVPart, generateMarkdownHeader, parseISOString } from "./utilities";

const { BulkExporter } = await import("./bulk_exporter");
const MarkdownExporterModule = await import("./markdown_exporter");
vi.mock("./dependency_loader");
import ePubCover from "../images/ePubCover.png";
// import { BulkExporter } from "./bulk_exporter";

// Mock markdown_exporter.js

// vi.mock("./markdown_exporter", () => {
//   const markdownExporterMock = vi.fn(() => {
//     return {
//       initialize: vi.fn(),
//       toPDF: vi.fn().mockResolvedValue({ stream: vi.fn() }),
//       toDOCX: vi.fn().mockResolvedValue({ stream: vi.fn() }),
//       toEPUB: vi.fn().mockResolvedValue({ stream: vi.fn() }),
//       toLaTeX: vi.fn().mockReturnValue("LaTeX Content"),
//       toHTML: vi.fn().mockReturnValue("<p>HTML Content</p>"),
//       reset: vi.fn(),
//     };
//   });

//   // Attach the mock to a property for instance tracking
//   return {
//     MarkdownExporter: markdownExporterMock,
//   };
// });

// Mock streamSaver.js
vi.mock("./streamSaver");
import streamSaver from "./streamSaver";
// import { MarkdownExporter } from "./markdown_exporter";
import { setAppInterface } from "./api_singleton";
import { MarkdownExporter } from "./markdown_exporter";
import { AssetExporter } from "./asset_exporter";

// Mock utilities.js
vi.mock("./utilities");
// vi.mock("./markdown_exporter", { spy: true });

// Mock CSS and image imports

// Function to create a mock WritableStream that captures written data
const createMockWritableStream = () => {
  const chunks = [];
  const writable = new WritableStream({
    write(chunk) {
      chunks.push(chunk);
    },
    close() {},
    abort(err) {},
  });

  // Attach chunks for verification
  writable.chunks = chunks;
  return writable;
};

const createMarkdownExporter = vi.fn((...args) => {
  return new MarkdownExporter(...args);

  const newExporter = new MarkdownExporter(...args);
  exporterConstructorSpy = vi
    .spyOn(MarkdownExporterModule, "MarkdownExporter")
    .mockImplementation((...args) => {
      const instance = new OriginalMarkdownExporter(...args);

      // Dynamically spy on all instance methods
      Object.getOwnPropertyNames(OriginalMarkdownExporter.prototype).forEach((method) => {
        if (method !== "constructor") {
          vi.spyOn(instance, method);
        }
      });

      return instance;
    });
  return new MarkdownExporter(...args);
});

describe("BulkExporter Test Suite", () => {
  let exporter;
  let exporterConstructorSpy;
  let mockData;
  let mockWriter;
  let pipeToSpy;
  let app;
  let note;

  beforeAll(() => {});

  beforeEach(() => {
    // // Reset all mocks before each test
    // vi.restoreAllMocks();

    // Create mock app and notes
    ({ app, note } = mockAppWithContent('Content "1"', "Note 1", "uuid-1", ["tag1"]));
    const note2 = mockNote("Content\n2", 'Note "2"', "uuid-2", ["tag2"]);
    app._storedNotes().push(note2);

    // Spy on markdown exporter so we can access the instance
    // Preserve the original constructor
    // const OriginalMarkdownExporter = MarkdownExporterModule.MarkdownExporter;

    // Spy on the constructor

    const OriginalMarkdownExporter = MarkdownExporterModule.MarkdownExporter;
    exporterConstructorSpy = vi
      .spyOn(MarkdownExporterModule, "MarkdownExporter")
      .mockImplementation((...args) => {
        const instance = new OriginalMarkdownExporter(...args);

        // Dynamically spy on all instance methods
        Object.getOwnPropertyNames(OriginalMarkdownExporter.prototype).forEach((method) => {
          if (method !== "constructor") {
            vi.spyOn(instance, method);
          }
        });

        return instance;
      });

    // Instantiate BulkExporter with format 'csv'
    exporter = new BulkExporter(app, [note, note2], "csv", {
      progressCallback: vi.fn(),
    });

    // Mock streamSaver.createWriteStream to return a mock WritableStream
    mockWriter = createMockWritableStream();
    streamSaver.createWriteStream.mockReturnValue(mockWriter);

    // Spy on ReadableStream.prototype.pipeTo
    pipeToSpy = vi.spyOn(ReadableStream.prototype, "pipeTo");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------
  // Test Suite for exportCSV
  // -------------------------
  describe("BulkExporter - export as CSV", () => {
    it("should export notes as CSV with proper escaping", async () => {
      // Arrange
      await exporter.initialize();

      // Act
      await exporter.export();

      // Assert
      expect(streamSaver.createWriteStream).toHaveBeenCalledWith("export.csv", {
        useBlob: expect.any(Boolean),
      });

      // Verify that pipeTo was called with a WritableStream
      expect(pipeToSpy).toHaveBeenCalledTimes(1);
      const writableStreamArg = pipeToSpy.mock.calls[0][0];
      expect(writableStreamArg).toBeInstanceOf(WritableStream);

      // Access the writable stream and verify the written CSV data
      const writableInstance = writableStreamArg;
      const encodedChunks = writableInstance.chunks;
      const decoder = new TextDecoder();
      const actualCSV = encodedChunks.map((chunk) => decoder.decode(chunk)).join("");

      // Define expected CSV content
      const expectedHeader = "UUID,Title,Tags,Content\n";
      const expectedLine1 = `"uuid-1","Note 1","tag1","Content ""1"""\n`;
      const expectedLine2 = `"uuid-2","Note ""2""","tag2","Content\n2"\n`;

      expect(actualCSV).toBe(expectedHeader + expectedLine1 + expectedLine2);

      // Verify that progressCallback was called correctly
      expect(exporter.options.progressCallback).toHaveBeenCalledTimes(4);
      expect(exporter.options.progressCallback).toHaveBeenNthCalledWith(
        1,
        0,
        "Starting CSV Export of 2 notes"
      );
      expect(exporter.options.progressCallback).toHaveBeenNthCalledWith(2, 1, "Note 1");
      expect(exporter.options.progressCallback).toHaveBeenNthCalledWith(3, 2, 'Note "2"');
      expect(exporter.options.progressCallback).toHaveBeenNthCalledWith(4, 2, "Export Complete");
    });
  });

  // -------------------------
  // Test Suite for export various formats
  // -------------------------
  describe("BulkExporter - export various formats", () => {
    const formats = ["pdf", "docx", "epub", "latex", "html", "md"];

    formats.forEach((format) => {
      it(`should export notes as ${format.toUpperCase()}`, async () => {
        // Arrange
        const { app, note } = mockAppWithContent("Content", "Note", "uuid-1", ["tag1"]);
        const exporter = new BulkExporter(app, [note], format, {
          progressCallback: vi.fn(),
        });
        const { startConfluxStream } = await import("./utilities");

        let assetStream;
        const origStreamAssets = AssetExporter.prototype.streamLocalAssets;
        const streamSpy = vi
          .spyOn(AssetExporter.prototype, "streamLocalAssets")
          .mockImplementation(function (...args) {
            assetStream = origStreamAssets.bind(this).call(args);
            return assetStream;
          });

        // Act
        await exporter.export();

        // Assert
        const markdownExporterInstance =
          MarkdownExporterModule.MarkdownExporter.mock.results[0].value;
        // const markdownExporterInstance = exporterConstructorSpy.mock.instances[0];
        if (["pdf", "docx", "epub"].includes(format)) {
          expect(markdownExporterInstance[`to${format.toUpperCase()}`]).toHaveBeenCalled();
        } else if (format === "latex") {
          expect(markdownExporterInstance.toLaTeX).toHaveBeenCalled();
        } else if (format === "html") {
          expect(markdownExporterInstance.toHTML).toHaveBeenCalled();
        } else if (format === "md") {
          expect(markdownExporterInstance.reset).toHaveBeenCalled();
        }

        // Verify that write is called with correct file information
        if (format !== "csv") {
          const { writable } = startConfluxStream.mock.results[0].value;
          const writer = writable.getWriter();
          const extension = format === "latex" ? "tex" : format;
          expect(writer.write).toHaveBeenCalledWith(
            expect.objectContaining({
              name: expect.stringMatching(new RegExp(`^Note.*\\.${extension}$`)),
              lastModified: expect.any(Date),
              stream: expect.any(Function),
            })
          );
          expect(streamSpy).toHaveBeenCalled();
          expect(assetStream.pipeTo).toHaveBeenCalledWith(writable); // Should have written assets as well
          // expect(writer.close).toHaveBeenCalled();
        }

        // Verify that progressCallback is called correctly
        expect(exporter.options.progressCallback).toHaveBeenCalled();
      });
    });
  });

  // -------------------------
  // Test Suite for exportEpubNotebook
  // -------------------------
  describe("BulkExporter - exportEpubNotebook", () => {
    it("should export a single EPUB notebook with all notes", async () => {
      // Arrange
      const appNote = mockAppWithContent(
        "Content 1 ![](https://images.amplenote.com/image.png)",
        "Note 1",
        "uuid-1",
        ["tag1"]
      );
      const mockNote2 = mockNote("Content 2", "Note 2", "uuid-2", ["tag2"]);
      appNote.app._storedNotes().push(mockNote2);
      setAppInterface(appNote.app);
      const exporter = new BulkExporter(appNote.app, [appNote.note, mockNote2], "epub-single", {
        progressCallback: vi.fn(),
      });

      // Mock initialize
      await exporter.initialize();

      // Mock prompt for title
      appNote.app.prompt.mockResolvedValue("My EPUB Book");

      // Mock addTitleToCoverImage
      const { addTitleToCoverImage } = await import("./utilities");
      addTitleToCoverImage.mockResolvedValue(new Blob(["cover image"], { type: "image/png" }));

      // Mock EPub generation
      const { loadEpubGenMemory } = await import("./dependency_loader");
      const mockEPub = {
        genEpub: vi
          .fn()
          .mockResolvedValue(new Blob(["epub content"], { type: "application/epub+zip" })),
      };
      loadEpubGenMemory.mockResolvedValue({ EPub: vi.fn().mockReturnValue(mockEPub) });

      // Spy on saveAs
      // Mock getNoteContent

      // Act
      await exporter.export();

      // Assert
      expect(appNote.app.prompt).toHaveBeenCalledWith("EPub Options", {
        inputs: [{ label: "Book Title (will be embedded in cover)", type: "string" }],
      });
      expect(addTitleToCoverImage).toHaveBeenCalledWith(ePubCover, "My EPUB Book");
      expect(mockEPub.genEpub).toHaveBeenCalled();
      expect(appNote.app.saveFile).toHaveBeenCalledWith(expect.any(Blob), "My EPUB Book.epub");
      expect(exporter.options.progressCallback).toHaveBeenCalledTimes(5); // Starting, each note, complete
    });

    it("should handle user cancelling the EPUB export", async () => {
      // Arrange
      const mockNote = mockAppWithContent("Content", "Note", "uuid-1", ["tag1"]);
      const exporter = new BulkExporter(mockNote.app, [mockNote.note], "epub-single", {
        progressCallback: vi.fn(),
      });

      // Mock initialize
      await exporter.initialize();

      // Mock prompt to return null (user cancels)
      mockNote.app.prompt.mockResolvedValue(null);

      // Act
      await exporter.export();

      // Assert
      expect(app.saveFile).not.toHaveBeenCalled();
      expect(exporter.options.progressCallback).not.toHaveBeenCalledWith(
        expect.any(Number),
        "Export Complete"
      );
    });
  });

  // -------------------------
  // Test Suite for Error Handling
  // -------------------------
  describe("BulkExporter - Error Handling", () => {
    it("should handle errors during initialization gracefully", async () => {
      // Arrange
      const mockData = mockAppWithContent("Content", "Note", "uuid-1", []);
      const exporter = new BulkExporter(mockData.app, [mockData.note], "pdf");

      // Mock loadConflux to throw an error
      const { loadConflux } = await import("./dependency_loader");
      loadConflux.mockRejectedValue(new Error("Failed to load Conflux"));

      // Act & Assert
      await expect(exporter.initialize()).rejects.toThrow("Failed to load Conflux");
    });
  });
});
