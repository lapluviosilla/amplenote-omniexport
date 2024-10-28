import MarkdownIt from "markdown-it";
import { vi } from "vitest";

export const loadConflux = vi.fn();
export const loadEpubGenMemory = vi.fn();
export const loadHtmlDocx = vi.fn();
export const loadPdfMake = vi.fn();
export const loadVfsfonts = vi.fn();
export const loadMarkdownIt = vi.fn(async () => {
  return MarkdownIt;
});
