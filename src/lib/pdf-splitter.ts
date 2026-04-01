import { PDFDocument } from "pdf-lib";

export async function splitPdfPages(
  base64: string,
  startPage: number, // 0-indexed
  endPage: number // 0-indexed, inclusive
): Promise<string> {
  const srcBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const srcDoc = await PDFDocument.load(srcBytes);
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(
    srcDoc,
    Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)
  );
  pages.forEach((p) => newDoc.addPage(p));
  const bytes = await newDoc.save();
  return btoa(String.fromCharCode(...bytes));
}

export async function getPdfPageCount(base64: string): Promise<number> {
  const srcBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const doc = await PDFDocument.load(srcBytes);
  return doc.getPageCount();
}
