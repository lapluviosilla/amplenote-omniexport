// __mocks__/utilities.js
import * as actualUtilities from "../utilities.js";
import { vi } from "vitest";

export const loadImageAsDataURL = vi.fn((imagePath) => {
  return actualUtilities.BrokenImage;
});
export const loadImageAsBlob = vi.fn((imageUrl) => {
  return new Blob(["image data"], { type: "image/png" });
});
export const startConfluxStream = vi.fn((fileName) => {
  let resolvePipePromise; // Declare the variable to hold the resolve function
  const pipePromise = new Promise((resolve) => {
    resolvePipePromise = resolve; // Assign the resolve function to a variable
  });

  // Mock return value for startConfluxStream
  return {
    pipePromise: pipePromise,
    writer: {
      write: vi.fn().mockResolvedValue(),
      close: vi.fn(() => {
        resolvePipePromise(); // Resolve the promise when close is called
      }),
    },
  };
});
export const addTitleToCoverImage = vi.fn((cover, title) => cover);

// Retain actual implementations for other functions
export const addNewlineBeforeBackslashAfterTable =
  actualUtilities.addNewlineBeforeBackslashAfterTable;
export const escapeBackslashNewlines = actualUtilities.escapeBackslashNewlines;
export const saveAs = actualUtilities.saveAs;
export const parseISOString = actualUtilities.parseISOString;
export const escapeCSVPart = actualUtilities.escapeCSVPart;
export const generateMarkdownHeader = actualUtilities.generateMarkdownHeader;
export const hasMarkdownTable = actualUtilities.hasMarkdownTable;

// If there are other utility functions, retain or mock them as needed
