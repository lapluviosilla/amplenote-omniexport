// __mocks__/utilities.js
import * as actualUtilities from "../utilities.js";
import { vi } from "vitest";

export const loadImageAsDataURL = vi.fn((imagePath) => {
  return actualUtilities.BrokenImage;
});
export const loadImageAsBlob = vi.fn((imageUrl) => {
  return new Blob(["image data"], { type: "image/png" });
});
export const startConfluxStream = vi.fn();
export const addTitleToCoverImage = vi.fn((cover, title) => cover);

// Retain actual implementations for other functions
export const addNewlineBeforeBackslashAfterTable =
  actualUtilities.addNewlineBeforeBackslashAfterTable;
export const escapeBackslashNewlines = actualUtilities.escapeBackslashNewlines;
export const saveAs = actualUtilities.saveAs;

// If there are other utility functions, retain or mock them as needed
