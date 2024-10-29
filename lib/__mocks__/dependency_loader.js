import MarkdownIt from "markdown-it";
import pdfMake from "../../node_modules/pdfmake/src/browser-extensions/pdfMake.js";
import { EPub } from "../../node_modules/epub-gen-memory/dist/lib/index";
import { vi } from "vitest";

export const loadEpubGenMemory = vi.fn().mockResolvedValue({ EPub: EPub });
export const loadHtmlDocx = vi.fn();
export const loadPdfMake = vi.fn(async () => {
  return pdfMake;
});
export const loadConflux = vi.fn(async () => {
  return { Writer: vi.fn() };
});
export const loadVfsfonts = vi.fn();
export const loadMarkdownIt = vi.fn(async () => {
  return MarkdownIt;
});
