import { markdownToPlainText } from "@/lib/markdown-plain";

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
  // 校正前（原文）。校正後本文(content)はクリーンに保ちつつ原文を紐づけ保持する。
  proofreadBefore?: string;
  locked?: boolean;
  favorite?: boolean;
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

export function toggleLock(id: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    records[idx].locked = !records[idx].locked;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("analysisStockUpdated"));
  }
}

export function toggleFavorite(id: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    records[idx].favorite = !records[idx].favorite;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("analysisStockUpdated"));
  }
}

const LOCK_PASSWORD_KEY = "dermapdf_lock_password";

export function setDeletePassword(password: string): void {
  const hash = btoa(encodeURIComponent(password + "_dermapdf_salt"));
  localStorage.setItem(LOCK_PASSWORD_KEY, hash);
}

export function verifyDeletePassword(password: string): boolean {
  const stored = localStorage.getItem(LOCK_PASSWORD_KEY);
  if (!stored) return true;
  const hash = btoa(encodeURIComponent(password + "_dermapdf_salt"));
  return stored === hash;
}

export function hasDeletePassword(): boolean {
  return !!localStorage.getItem(LOCK_PASSWORD_KEY);
}

export function removeDeletePassword(): void {
  localStorage.removeItem(LOCK_PASSWORD_KEY);
}

export function duplicateAnalysis(id: string): AnalysisRecord | null {
  const records = loadAllAnalyses();
  const original = records.find((r) => r.id === id);
  if (!original) return null;

  const duplicated: AnalysisRecord = {
    ...original,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: (original.title || original.fileName) + " (コピー)",
    locked: false,
    updatedAt: undefined,
    originalContent: undefined,
  };

  records.splice(records.findIndex((r) => r.id === id) + 1, 0, duplicated);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
  window.dispatchEvent(new Event("analysisStockUpdated"));
  return duplicated;
}

export function bulkToggleLock(ids: string[], locked: boolean): void {
  const records = loadAllAnalyses();
  records.forEach((r) => {
    if (ids.includes(r.id)) r.locked = locked;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("analysisStockUpdated"));
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

// フォルダパスユーティリティ
export function getParentFolder(folderPath: string): string {
  const parts = folderPath.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

export function getFolderName(folderPath: string): string {
  const parts = folderPath.split("/");
  return parts[parts.length - 1];
}

export function getFolderDepth(folderPath: string): number {
  if (!folderPath) return 0;
  return folderPath.split("/").length - 1;
}

export interface FolderNode {
  path: string;
  name: string;
  count: number;
  totalCount: number;
  children: FolderNode[];
  isCustom: boolean;
}

const DEFAULT_FOLDERS_LIST = ["人材育成", "採用", "マニュアル", "リスク管理", "等級・評価", "経営戦略", "その他"];

export function buildFolderTree(
  records: AnalysisRecord[],
  customFolders: string[]
): FolderNode[] {
  const allPaths = new Set<string>();
  records.forEach((r) => {
    if (r.folder) {
      const parts = r.folder.split("/");
      parts.forEach((_, i) => {
        allPaths.add(parts.slice(0, i + 1).join("/"));
      });
    }
  });
  customFolders.forEach((f) => {
    const parts = f.split("/");
    parts.forEach((_, i) => {
      allPaths.add(parts.slice(0, i + 1).join("/"));
    });
  });

  const countMap: Record<string, number> = {};
  records.forEach((r) => {
    if (r.folder) countMap[r.folder] = (countMap[r.folder] || 0) + 1;
  });

  const buildNode = (path: string): FolderNode => {
    const children = Array.from(allPaths)
      .filter((p) => {
        const parts = p.split("/");
        const pathParts = path.split("/");
        return parts.length === pathParts.length + 1 && p.startsWith(path + "/");
      })
      .sort((a, b) => a.localeCompare(b, "ja"))
      .map(buildNode);

    const directCount = countMap[path] || 0;
    const totalCount = directCount + children.reduce((s, c) => s + c.totalCount, 0);

    return {
      path,
      name: getFolderName(path),
      count: directCount,
      totalCount,
      children,
      isCustom: !DEFAULT_FOLDERS_LIST.includes(path.split("/")[0]),
    };
  };

  const rootPaths = Array.from(allPaths)
    .filter((p) => !p.includes("/"))
    .sort((a, b) => {
      const aIdx = DEFAULT_FOLDERS_LIST.indexOf(a);
      const bIdx = DEFAULT_FOLDERS_LIST.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b, "ja");
    });
  return rootPaths.map(buildNode);
}

export interface FlatFolder {
  path: string;
  displayName: string;
  depth: number;
}

export function getFlatFolderList(tree: FolderNode[]): FlatFolder[] {
  const result: FlatFolder[] = [];
  const walk = (nodes: FolderNode[], depth: number) => {
    for (const node of nodes) {
      const prefix = depth > 0 ? "　".repeat(depth - 1) + "└ " : "";
      result.push({ path: node.path, displayName: prefix + node.name, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);
  return result;
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
  const safeLabel = record.analysisLabel.replace(/[^\w\u3040-\u9fff]/g, "_");
  a.download = `dermapdf_${safeName}_${safeLabel}_${dateFileStr}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// 単一カードを .pdf でダウンロード。画面表示と同じMarkdownレンダリングで全内容を
// 整形（見出し・太字・箇条書き）し、コンテンツ高に応じて複数ページに分割する。
export async function exportSingleAnalysisAsPdf(record: AnalysisRecord): Promise<void> {
  const { exportMarkdownAsPdf } = await import("@/lib/markdown-export");
  const title = record.title || record.fileName;
  const dateStr = new Date(record.createdAt).toLocaleString("ja-JP");
  const metaLines = [
    `分析タイプ: ${record.analysisLabel}`,
    `保存日時: ${dateStr}`,
    ...(record.folder ? [`フォルダ: ${record.folder}`] : []),
    ...(record.tags?.length ? [`タグ: ${record.tags.join(", ")}`] : []),
  ];
  const safeName = title.replace(/[^\w぀-鿿]/g, "_").slice(0, 30);
  const safeLabel = record.analysisLabel.replace(/[^\w぀-鿿]/g, "_");
  const fileName = `dermapdf_${safeName}_${safeLabel}_${new Date().toISOString().split("T")[0]}.pdf`;
  await exportMarkdownAsPdf({
    title,
    metaLines,
    markdown: record.content,
    fileName,
  });
}

// 単一カードを .docx でダウンロード。Markdownの見出し・太字・箇条書き・表を
// Wordの実体スタイルへマッピングした、編集可能なテキスト＋スタイルの文書を生成する。
export async function exportSingleAnalysisAsWord(record: AnalysisRecord): Promise<void> {
  const { exportMarkdownAsDocx } = await import("@/lib/markdown-docx");
  const title = record.title || record.fileName;
  const dateStr = new Date(record.createdAt).toLocaleString("ja-JP");
  const metaLines = [
    `分析タイプ: ${record.analysisLabel}`,
    `保存日時: ${dateStr}`,
    ...(record.folder ? [`フォルダ: ${record.folder}`] : []),
    ...(record.tags?.length ? [`タグ: ${record.tags.join(", ")}`] : []),
  ];
  const safeName = title.replace(/[^\w぀-鿿]/g, "_").slice(0, 30);
  const safeLabel = record.analysisLabel.replace(/[^\w぀-鿿]/g, "_");
  const fileName = `dermapdf_${safeName}_${safeLabel}_${new Date().toISOString().split("T")[0]}.docx`;
  await exportMarkdownAsDocx({
    title,
    metaLines,
    markdown: record.content,
    fileName,
  });
}

export function exportAnalysesAsText(): void {
  const data = loadAllAnalyses();
  const text = data
    .map(
      (r) =>
        `【${r.analysisLabel}】${r.fileName}\n${new Date(r.createdAt).toLocaleString("ja-JP")}\n${"─".repeat(40)}\n${markdownToPlainText(r.content)}\n`
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

// 全分析を1つの .pdf でエクスポート。各カードを画面と同じMarkdownレンダリングで
// 整形して連結し、コンテンツ高に応じて複数ページへ分割する。
export async function exportAnalysesAsPdf(): Promise<void> {
  const { exportMarkdownAsPdf } = await import("@/lib/markdown-export");
  const records = loadAllAnalyses();
  const markdown =
    records
      .map((r) => {
        const dateStr = new Date(r.createdAt).toLocaleString("ja-JP");
        return `# ${r.title || r.fileName}\n\n**分析タイプ**: ${r.analysisLabel} ／ **保存日時**: ${dateStr}${
          r.folder ? ` ／ **フォルダ**: ${r.folder}` : ""
        }\n\n${r.content}`;
      })
      .join("\n\n---\n\n") || "（データがありません）";
  await exportMarkdownAsPdf({
    title: "DermaPDF Pro 分析ストック",
    metaLines: [`${records.length}件 ／ ${new Date().toLocaleString("ja-JP")}`],
    markdown,
    fileName: `dermapdf_analyses_${new Date().toISOString().split("T")[0]}.pdf`,
  });
}

export async function bulkExportAsMarkdown(records: AnalysisRecord[]): Promise<void> {
  for (let i = 0; i < records.length; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, i === 0 ? 0 : 500));
    exportSingleAnalysisAsMarkdown(records[i]);
  }
}

// 単一カードを .txt（プレーンテキスト）でダウンロード。
// 整形・命名規則は一括テキスト出力（bulkExportAsText）と同一に揃える。
export function exportSingleAnalysisAsText(record: AnalysisRecord): void {
  const r = record;
  const dateFileStr = new Date().toISOString().split("T")[0];
  const title = r.title || r.fileName;
  const text = `${title}
分析タイプ: ${r.analysisLabel}
保存日時: ${new Date(r.createdAt).toLocaleString("ja-JP")}
${r.folder ? `フォルダ: ${r.folder}` : ""}
${"─".repeat(40)}

${markdownToPlainText(r.content)}
`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = title.replace(/[^\w぀-鿿]/g, "_").slice(0, 30);
  const safeLabel = r.analysisLabel.replace(/[^\w぀-鿿]/g, "_");
  a.download = `dermapdf_${safeName}_${safeLabel}_${dateFileStr}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function bulkExportAsText(records: AnalysisRecord[]): Promise<void> {
  for (let i = 0; i < records.length; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, i === 0 ? 0 : 500));
    exportSingleAnalysisAsText(records[i]);
  }
}

export async function bulkExportAsPdf(records: AnalysisRecord[]): Promise<void> {
  for (let i = 0; i < records.length; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, i === 0 ? 0 : 800));
    await exportSingleAnalysisAsPdf(records[i]);
  }
}
