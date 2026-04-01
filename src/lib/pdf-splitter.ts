import { PDFDocument } from "pdf-lib";

// 安全なbase64→Uint8Array変換（大きなファイル対応）
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// 安全なUint8Array→base64変換（大きなファイル対応）
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function getPdfPageCount(base64: string): Promise<number> {
  try {
    const bytes = base64ToUint8Array(base64);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch (e) {
    console.error("getPdfPageCount error:", e);
    return 0;
  }
}

export async function splitPdfPages(
  base64: string,
  startPage: number,
  endPage: number
): Promise<string> {
  const srcBytes = base64ToUint8Array(base64);
  const srcDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  const safeEnd = Math.min(endPage, totalPages - 1);
  const pageIndices = Array.from(
    { length: safeEnd - startPage + 1 },
    (_, i) => startPage + i
  );

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach((p) => newDoc.addPage(p));

  const newBytes = await newDoc.save();
  return uint8ArrayToBase64(newBytes);
}
