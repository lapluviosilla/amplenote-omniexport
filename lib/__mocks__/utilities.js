// __mocks__/utilities.js
// import * as actualUtilities from "../utilities";
const actualUtilities = await vi.importActual("../utilities");
import { vi } from "vitest";
import { MockWritableStream, MockWritableStreamDefaultWriter } from "../test/mock_writable_stream";

export const ValidImage = "data:image/png;base64,iVBORw0KGgo";
export const loadImageAsDataURL = vi.fn((imagePath) => {
  const base64Pattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
  if (base64Pattern.test(imagePath)) {
    return imagePath; // Return base64 as is
  }
  return ValidImage;
});
export const loadImage = vi.fn(async (imageUrl) => {
  return new Response(new Blob(["image data"]), { type: "image/png" });
});
export const loadImageAsBlob = vi.fn(async (imageUrl) => {
  return new Blob(["image data"], { type: "image/png" });
});
export const loadAttachmentAsBlob = vi.fn(async (url) => {
  return new Blob(["attachment data"], { type: "application/pdf" });
});
export const loadAttachment = vi.fn(async (url) => {
  return new Response(new Blob(["attachment data"], { type: "application/pdf" }));
});

export const startConfluxStream = vi.fn((fileName) => {
  let resolvePipePromise; // Declare the variable to hold the resolve function
  const pipePromise = new Promise((resolve) => {
    resolvePipePromise = resolve; // Assign the resolve function to a variable
  });

  const mockWritableStream = new MockWritableStream();
  const mockWriter = new MockWritableStreamDefaultWriter(mockWritableStream);
  mockWritableStream.getWriter.mockReturnValue(mockWriter);

  mockWritableStream.closed.then(resolvePipePromise);

  // Mock return value for startConfluxStream
  return {
    pipePromise: pipePromise,
    writable: mockWritableStream,
    // writer: {
    //   write: vi.fn().mockResolvedValue(),
    //   close: vi.fn(() => {
    //     resolvePipePromise(); // Resolve the promise when close is called
    //   }),
    // },
  };
});
export const addTitleToCoverImage = vi.fn((cover, title) => cover);
export const BrokenImage = actualUtilities.BrokenImage;

// Retain actual implementations for other functions
export const addNewlineBeforeBackslashAfterTable = vi.fn(
  actualUtilities.addNewlineBeforeBackslashAfterTable
);
export const escapeBackslashNewlines = vi.fn(actualUtilities.escapeBackslashNewlines);
export const saveAs = vi.fn(actualUtilities.saveAs);
export const parseISOString = vi.fn(actualUtilities.parseISOString);
export const escapeCSVPart = vi.fn(actualUtilities.escapeCSVPart);
export const generateMarkdownHeader = vi.fn(actualUtilities.generateMarkdownHeader);
export const hasMarkdownTable = vi.fn(actualUtilities.hasMarkdownTable);
export const proxifyImage = vi.fn(actualUtilities.proxifyImage);
export const proxifyAsset = vi.fn(actualUtilities.proxifyAsset);
export const isAttachmentURL = vi.fn(actualUtilities.isAttachmentURL);
export const isValidHttpUrl = vi.fn(actualUtilities.isValidHttpUrl);
export const escapeUrl = vi.fn(actualUtilities.escapeUrl);

// If there are other utility functions, retain or mock them as needed
