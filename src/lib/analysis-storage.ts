export interface AnalysisRecord {
  id: string;
  createdAt: string;
  fileName: string;
  analysisType: string;
  analysisLabel: string;
  content: string;
  tags: string[];
  folder: string;
  title?: string;
  updatedAt?: string;
  originalContent?: string;
}

const STORAGE_KEY = "dermapdf_analysis_stock";

export function saveAnalysis(
  record: Omit<AnalysisRecord, "id" | "createdAt">
): AnalysisRecord {
  const records = loadAllAnalyses();
  const newRecord: AnalysisRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  records.unshift(newRecord);
  const trimmed = records.slice(0, 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  window.dispatchEvent(new Event("analysisStockUpdated"));
  return newRecord;
}

export function loadAllAnalyses(): AnalysisRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function updateAnalysisTitle(id: string, title: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    records[idx].title = title;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("analysisStockUpdated"));
  }
}

export function updateAnalysisContent(id: string, content: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    if (!records[idx].originalContent) {
      records[idx].originalContent = records[idx].content;
    }
    records[idx].content = content;
    records[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("analysisStockUpdated"));
  }
}

export function revertAnalysisContent(id: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1 && records[idx].originalContent) {
    records[idx].content = records[idx].originalContent!;
    delete records[idx].originalContent;
    delete records[idx].updatedAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("analysisStockUpdated"));
  }
}

export function getDisplayTitle(record: AnalysisRecord): string {
  return record.title || record.fileName;
}

export function deleteAnalysis(id: string): void {
  const records = loadAllAnalyses().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("analysisStockUpdated"));
}

export function renameFolder(oldName: string, newName: string): void {
  const records = loadAllAnalyses();
  records.forEach((r) => {
    if (r.folder === oldName) r.folder = newName;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("analysisStockUpdated"));
}

export function deleteFolder(folderName: string): void {
  const records = loadAllAnalyses();
  records.forEach((r) => {
    if (r.folder === folderName) r.folder = "";
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("analysisStockUpdated"));
}

export function clearAllAnalyses(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportAnalysesAsJSON(): void {
  const data = loadAllAnalyses();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dermapdf_analyses_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function updateAnalysisTags(id: string, tags: string[], folder: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    records[idx].tags = tags;
    records[idx].folder = folder;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("analysisStockUpdated"));
  }
}

export function getAllFolders(): string[] {
  const records = loadAllAnalyses();
  const folders = new Set(records.map((r) => r.folder).filter(Boolean));
  return Array.from(folders);
}

export function getAllTags(): string[] {
  const records = loadAllAnalyses();
  const tags = new Set(records.flatMap((r) => r.tags || []));
  return Array.from(tags);
}

export function getAllTagsSorted(): string[] {
  const records = loadAllAnalyses();
  const tags = new Set(records.flatMap((r) => r.tags || []));
  return Array.from(tags).sort((a, b) =>
    a.localeCompare(b, "ja", { sensitivity: "base" })
  );
}

export function getTagsWithCount(): { tag: string; count: number }[] {
  const records = loadAllAnalyses();
  const countMap = new Map<string, number>();
  records.forEach((r) => {
    (r.tags || []).forEach((tag) => {
      countMap.set(tag, (countMap.get(tag) || 0) + 1);
    });
  });
  return Array.from(countMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag, "ja", { sensitivity: "base" }));
}

export function exportSingleAnalysisAsMarkdown(record: AnalysisRecord): void {
  const dateStr = new Date(record.createdAt).toLocaleString("ja-JP");
  const dateFileStr = new Date(record.createdAt).toISOString().split("T")[0];

  const md = `# ${record.title || record.fileName}

## 基本情報
- **ファイル名**: ${record.fileName}
- **分析タイプ**: ${record.analysisLabel}
- **保存日時**: ${dateStr}
${record.folder ? "- **フォルダ**: " + record.folder : ""}
${record.tags?.length ? "- **タグ**: " + record.tags.join(", ") : ""}

---

## 分析内容

${record.content}

---

## AIへの引き継ぎプロンプト例

\`\`\`
このファイルはDermaPDF Proで分析した「${record.analysisLabel}」の結果です。
この内容をもとに、さらに詳しい分析や活用方法を提案してください。
\`\`\`

---
*Generated by DermaPDF Pro | ${dateStr}*
`;

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (record.title || record.fileName)
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\w\u3040-\u9fff]/g, "_");
  a.download = `dermapdf_${safeName}_${dateFileStr}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAnalysesAsText(): void {
  const data = loadAllAnalyses();
  const text = data
    .map(
      (r) =>
        `【${r.analysisLabel}】${r.fileName}\n${new Date(r.createdAt).toLocaleString("ja-JP")}\n${"─".repeat(40)}\n${r.content}\n`
    )
    .join("\n\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dermapdf_analyses_${new Date().toISOString().split("T")[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAnalysesAsDocx(): Promise<void> {
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import("docx");
  const records = loadAllAnalyses();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  children.push(
    new Paragraph({ text: "DermaPDF Pro 分析ストック", heading: HeadingLevel.TITLE })
  );
  children.push(
    new Paragraph({ text: `エクスポート日時: ${new Date().toLocaleString("ja-JP")}` })
  );
  children.push(new Paragraph({ text: "" }));

  records.forEach((r, i) => {
    children.push(
      new Paragraph({ text: `${i + 1}. ${r.title || r.fileName}`, heading: HeadingLevel.HEADING_1 })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "分析タイプ: ", bold: true }),
          new TextRun({ text: r.analysisLabel }),
        ],
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "保存日時: ", bold: true }),
          new TextRun({ text: new Date(r.createdAt).toLocaleString("ja-JP") }),
        ],
      })
    );
    if (r.folder) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "フォルダ: ", bold: true }),
            new TextRun({ text: r.folder }),
          ],
        })
      );
    }
    if (r.tags?.length) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "タグ: ", bold: true }),
            new TextRun({ text: r.tags.join(", ") }),
          ],
        })
      );
    }
    children.push(new Paragraph({ text: "" }));

    r.content.split("\n").forEach((line) => {
      children.push(new Paragraph({ text: line || " " }));
    });

    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: "─".repeat(40) }));
    children.push(new Paragraph({ text: "" }));
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = new Blob([await Packer.toBlob(doc)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dermapdf_analyses_${new Date().toISOString().split("T")[0]}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAnalysesAsPdf(): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const records = loadAllAnalyses();

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const lineHeight = 16;
  const fontSize = 10;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addText = (text: string, isBold = false, size = fontSize) => {
    const f = isBold ? boldFont : font;
    const maxWidth = pageWidth - margin * 2;
    const words = text.split("");
    let line = "";
    for (const char of words) {
      const testLine = line + char;
      const width = f.widthOfTextAtSize(testLine, size);
      if (width > maxWidth && line.length > 0) {
        if (y < margin + lineHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, font: f, size, color: rgb(0, 0, 0) });
        y -= lineHeight;
        line = char;
      } else {
        line = testLine;
      }
    }
    if (line) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, font: f, size, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
  };

  addText("DermaPDF Pro Analysis Stock", true, 16);
  y -= 8;
  addText(`Export: ${new Date().toLocaleString("ja-JP")}`);
  y -= 16;

  records.forEach((r, i) => {
    addText(`${i + 1}. ${r.title || r.fileName}`, true, 12);
    addText(`Type: ${r.analysisLabel}`);
    addText(`Date: ${new Date(r.createdAt).toLocaleString("ja-JP")}`);
    if (r.folder) addText(`Folder: ${r.folder}`);
    if (r.tags?.length) addText(`Tags: ${r.tags.join(", ")}`);
    y -= 8;
    r.content.split("\n").forEach((line) => addText(line || " "));
    y -= 8;
    addText("-".repeat(50));
    y -= 8;
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dermapdf_analyses_${new Date().toISOString().split("T")[0]}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
