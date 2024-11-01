import MarkdownIt from "markdown-it";
// import pdfMake from "../../node_modules/pdfmake/src/browser-extensions/pdfMake.js";
import { EPub } from "../../node_modules/epub-gen-memory/dist/lib/index";
import { vi } from "vitest";

export const loadEpubGenMemory = vi.fn(async () => ({ EPub: EPub }));
const htmlAsBlobMock = vi.fn(
  async () =>
    new Blob(["DOCX content"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
);
export const loadHtmlDocx = vi.fn(async () => {
  return { asBlob: htmlAsBlobMock };
});
const createPdfMock = vi.fn(() => {
  return { getBlob: (cb) => cb(new Blob(["PDF with images"], { type: "application/pdf" })) };
});

export const loadPdfMake = vi.fn(async () => {
  return {
    createPdf: createPdfMock,
  };
});
export const loadConflux = vi.fn(async () => {
  return { Writer: vi.fn() };
});
export const loadVfsfonts = vi.fn();
export const loadMarkdownIt = vi.fn(async () => {
  return MarkdownIt;
});
