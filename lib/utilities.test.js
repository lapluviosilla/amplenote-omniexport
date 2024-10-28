// tests/utilities.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startConfluxStream,
  BrokenImage,
  loadImageAsDataURL,
  loadImageAsBlob,
  addNewlineBeforeBackslashAfterTable,
  escapeBackslashNewlines,
  proxifyImage,
  addTitleToCoverImage,
  saveAs,
  hasMarkdownTable,
  generateMarkdownHeader,
  parseISOString,
  escapeCSVPart,
} from "./utilities";
vi.mock("./dependency_loader");
import * as dependencyLoader from "./dependency_loader";
import streamSaver from "./streamSaver.js";
import { getAppInterface } from "./api_singleton.js";
import { mockAppWithContent } from "./test-helpers.js";

describe("Utilities Module", () => {
  const app = mockAppWithContent("Irrelevant Content");
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
  });

  // ==================
  // Test loadImageAsBlob
  // ==================
  describe("loadImageAsBlob", () => {
    it("should fetch and return a Blob when response is ok and image", async () => {
      const mockBlob = new Blob(["image data"], { type: "image/png" });

      // Mock fetch to return a successful response with image content-type
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("image/png"),
        },
        blob: vi.fn().mockResolvedValue(mockBlob),
      });

      const url = "https://example.com/image.png";
      const result = await loadImageAsBlob(url);

      expect(fetch).toHaveBeenCalledWith(url, { mode: "cors" });
      expect(result).toBe(mockBlob);
    });

    it("should return null if fetch response is not ok", async () => {
      // Mock fetch to return a failed response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: {
          get: vi.fn(),
        },
        blob: vi.fn(),
      });

      const url = "https://example.com/image.png";
      const result = await loadImageAsBlob(url);

      expect(fetch).toHaveBeenCalledWith(url, { mode: "cors" });
      expect(result).toBeNull();
    });

    it("should return null if content-type is not image", async () => {
      // Mock fetch to return a response with non-image content-type
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("text/html"),
        },
        blob: vi.fn(),
      });

      const url = "https://example.com/not-an-image";
      const result = await loadImageAsBlob(url);

      expect(fetch).toHaveBeenCalledWith(url, { mode: "cors" });
      expect(result).toBeNull();
    });

    it("should return null if fetch throws an error", async () => {
      // Mock fetch to throw an error
      global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

      const url = "https://example.com/image.png";
      const result = await loadImageAsBlob(url);

      expect(fetch).toHaveBeenCalledWith(url, { mode: "cors" });
      expect(result).toBeNull();
    });
  });

  // ==================
  // Test loadImageAsDataURL
  // ==================
  describe("loadImageAsDataURL", () => {
    it("should convert Blob to data URL", async () => {
      const mockBlob = new Blob(["image data"], { type: "image/png" });
      const mockDataURL = "data:image/png;base64,aW1hZ2UgZGF0YQ==";

      // Mock loadImageAsBlob to return mockBlob
      // vi.spyOn(global, "loadImageAsBlob").mockResolvedValue(mockBlob);

      // Mock FileReader
      // const mockFileReader = {
      //   readAsDataURL: vi.fn(),
      //   onloadend: null,
      //   onerror: null,
      //   result: mockDataURL,
      // };
      // global.FileReader = vi.fn(() => mockFileReader);
      global.fetch = vi.fn();
      // Mock fetch to return mockBlob when called with the specific URL
      global.fetch.mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("image/png"),
        },
        blob: vi.fn().mockResolvedValue(mockBlob),
      });

      const url = "https://example.com/image.png";
      const promise = loadImageAsDataURL(url);

      // Simulate FileReader onloadend
      // mockFileReader.onloadend();
      const result = await promise;

      // expect(loadImageAsBlob).toHaveBeenCalledWith(url);
      // expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockBlob);
      expect(result).toBe(mockDataURL);
    });

    it("should reject if image loading fails", async () => {
      // Mock loadImageAsBlob to return a Blob
      const mockBlob = new Blob(["image data"], { type: "image/png" });
      global.fetch = vi.fn();
      // Mock fetch to return mockBlob when called with the specific URL
      global.fetch.mockResolvedValue({
        ok: false,
      });

      const url = "https://example.com/image.png";
      const promise = loadImageAsDataURL(url);

      // Simulate FileReader onerror
      // mockFileReader.onerror(new Error("FileReader Error"));
      await expect(await promise).toBe(null);
    });
  });

  // ==================
  // Test addNewlineBeforeBackslashAfterTable
  // ==================
  describe("addNewlineBeforeBackslashAfterTable", () => {
    it("should add newline before backslash after table when pattern matches", () => {
      const markdown = `
| Header |
|--------|
| Cell |
\\
`;
      const expected = `
| Header |
|--------|
| Cell |

\\
`;
      const result = addNewlineBeforeBackslashAfterTable(markdown);
      expect(result).toBe(expected);
    });

    it("should not modify markdown if pattern does not match", () => {
      const markdown = `
Some text without a table and backslash.
\\
`;
      const expected = `
Some text without a table and backslash.
\\
`;
      const result = addNewlineBeforeBackslashAfterTable(markdown);
      expect(result).toBe(expected);
    });
  });

  // ==================
  // Test escapeBackslashNewlines
  // ==================
  describe("escapeBackslashNewlines", () => {
    it("should replace backslash at the end of lines with newline", () => {
      const markdown = `
Line one\\
Line two\\
Line three
`;
      const expected = `
Line one

Line two

Line three
`;
      const result = escapeBackslashNewlines(markdown);
      expect(result).toBe(expected);
    });

    it("should not modify lines without backslashes", () => {
      const markdown = `
Line one
Line two
Line three
`;
      const expected = `
Line one
Line two
Line three
`;
      const result = escapeBackslashNewlines(markdown);
      expect(result).toBe(expected);
    });
  });

  // ==================
  // Test proxifyImage
  // ==================
  describe("proxifyImage", () => {
    it("should return proxy URL for images.amplenote.com", () => {
      const url = "https://images.amplenote.com/image.png";
      const expectedProxy =
        "https://plugins.amplenote.com/cors-proxy?apiurl=https%3A%2F%2Fimages.amplenote.com%2Fimage.png";
      const result = proxifyImage(url);
      expect(result).toBe(expectedProxy);
    });

    it("should return original URL for other domains", () => {
      const url = "https://example.com/image.png";
      const result = proxifyImage(url);
      expect(result).toBe(url);
    });

    it("should return BrokenImage for invalid URLs", () => {
      const url = "invalid-url";
      const result = proxifyImage(url);
      expect(result).toBe(BrokenImage);
    });

    it("should return BrokenImage for unsupported protocols", () => {
      const url = "ftp://example.com/image.png";
      const result = proxifyImage(url);
      expect(result).toBe(BrokenImage);
    });
  });

  // ==================
  // Test generateMarkdownHeader
  // ==================
  describe("generateMarkdownHeader", () => {
    it("should generate markdown header with tags when tags are present", () => {
      const data = {
        name: "Sample Note",
        uuid: "1234-5678",
        created: "2023-10-25T12:34:56Z",
        updated: "2023-10-26T12:34:56Z",
        tags: ["tag1", "tag2"],
      };

      const expected = `---
title: 'Sample Note'
uuid: 1234-5678
created: '2023-10-25T12:34:56Z'
updated: '2023-10-26T12:34:56Z'
tags:
  - tag1
  - tag2
---`;
      const result = generateMarkdownHeader(data);
      expect(result).toBe(expected);
    });

    it("should generate markdown header without tags when tags are absent", () => {
      const data = {
        name: "Sample Note",
        uuid: "1234-5678",
        created: "2023-10-25T12:34:56Z",
        updated: "2023-10-26T12:34:56Z",
        tags: [],
      };

      const expected = `---
title: 'Sample Note'
uuid: 1234-5678
created: '2023-10-25T12:34:56Z'
updated: '2023-10-26T12:34:56Z'
---`;
      const result = generateMarkdownHeader(data);
      expect(result).toBe(expected);
    });
  });

  // ==================
  // Test parseISOString
  // ==================
  describe("parseISOString", () => {
    it("should correctly parse a valid ISO string", () => {
      const isoString = "2023-10-25T12:34:56.789Z";
      const date = parseISOString(isoString);
      expect(date.toISOString()).toBe(isoString);
    });

    it("should return Invalid Date for an invalid ISO string", () => {
      const isoString = "invalid-iso-string";
      const date = parseISOString(isoString);
      expect(date.toString()).toBe("Invalid Date");
    });
  });

  // ==================
  // Test escapeCSVPart
  // ==================
  describe("escapeCSVPart", () => {
    it("should escape quotes by doubling them and wrap the string in quotes", () => {
      const input = 'He said, "Hello World"';
      const expected = '"He said, ""Hello World"""';
      const result = escapeCSVPart(input);
      expect(result).toBe(expected);
    });

    it("should wrap empty string in quotes", () => {
      const input = "";
      const expected = '""';
      const result = escapeCSVPart(input);
      expect(result).toBe(expected);
    });

    it("should handle strings without quotes", () => {
      const input = "Simple text";
      const expected = '"Simple text"';
      const result = escapeCSVPart(input);
      expect(result).toBe(expected);
    });

    it("should handle strings with multiple quotes", () => {
      const input = 'She said, "Hello", and then "Goodbye"';
      const expected = '"She said, ""Hello"", and then ""Goodbye"""';
      const result = escapeCSVPart(input);
      expect(result).toBe(expected);
    });
  });

  // ==================
  // Test startConfluxStream
  // ==================
  describe("startConfluxStream", () => {
    it("should handle environments without WritableStream and pipeTo", async () => {
      const mockWriter = {
        write: vi.fn(),
        close: vi.fn(),
      };
      const mockFileStream = {
        getWriter: vi.fn().mockReturnValue(mockWriter),
      };
      const mockStreamSaver = {
        createWriteStream: vi.fn().mockReturnValue(mockFileStream),
      };
      // Mock navigator.userAgent
      Object.defineProperty(global.navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        writable: true,
      });

      // Mock window.WritableStream and readable.pipeTo to be undefined
      global.WritableStream = undefined;
      dependencyLoader.loadConflux.mockResolvedValue({
        Writer: class {
          constructor() {
            this.readable = {
              pipeTo: undefined,
              getReader: vi.fn().mockReturnValue({
                read: vi.fn().mockResolvedValue({ done: true }),
              }),
            };
            this.writable = {
              getWriter: vi.fn().mockReturnValue(mockWriter),
            };
          }
        },
      });

      // Replace the actual streamSaver with mockStreamSaver
      vi.spyOn(streamSaver, "createWriteStream").mockImplementation(
        mockStreamSaver.createWriteStream
      );

      const { writer, pipePromise } = await startConfluxStream();

      expect(dependencyLoader.loadConflux).toHaveBeenCalled();
      expect(mockStreamSaver.createWriteStream).toHaveBeenCalledWith("export.zip", {
        useBlob: true,
      });
      expect(writer).toBe(mockWriter);
      expect(pipePromise).toBeUndefined();
    });
  });
});
