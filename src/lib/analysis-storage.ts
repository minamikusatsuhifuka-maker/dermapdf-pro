import { cleanupLatexNotation } from "@/lib/latex-cleanup";
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
  // AIが内容から自動付与するカテゴリ（folderとは独立。既存レコードはundefinedのままでよい）
  aiCategory?: string;
  // 同時実行（1回の実行で複数タイプ）で生成された結果を束ねるID。
  // 表示上だけ1枚のカードにまとめる（タブ切替）ためのもので、データは1レコード=1本文のまま。
  // 既存レコードは undefined のままで従来どおり1枚1カード。
  groupId?: string;
}

const STORAGE_KEY = "dermapdf_analysis_stock";

export const STORAGE_QUOTA_MESSAGE =
  "⚠ 保存容量がいっぱいのため保存できませんでした。不要なカードを削除するか、バックアップ後に整理してください";

// 保存容量（localStorage）が足りず書き込めなかったことを示すエラー。
// 呼び出し元は instanceof で判別し、ユーザーに分かる文言で通知する。
export class StorageQuotaError extends Error {
  constructor(message: string = STORAGE_QUOTA_MESSAGE) {
    super(message);
    this.name = "StorageQuotaError";
  }
}

// ブラウザが投げる容量超過例外の判定（Chrome/Safari: QuotaExceededError / code 22, Firefox: code 1014）
function isQuotaExceeded(err: unknown): boolean {
  if (err instanceof StorageQuotaError) return true;
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return (
      err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22 ||
      err.code === 1014
    );
  }
  return false;
}

// 保存系エラーをユーザー向け文言に変換する共通ヘルパー。
// 容量超過なら統一メッセージ、それ以外は err.message、無ければ fallback。
export function describeSaveError(err: unknown, fallback: string): string {
  if (err instanceof StorageQuotaError) return err.message;
  if (isQuotaExceeded(err)) return STORAGE_QUOTA_MESSAGE;
  return err instanceof Error && err.message ? err.message : fallback;
}

// ストック全件を一括で書き込む。容量超過は StorageQuotaError に変換して投げる。
// 失敗時は何も書き込まれない（localStorage.setItem は原子的）ので既存データは無傷。
function writeStock(records: AnalysisRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    if (isQuotaExceeded(err)) throw new StorageQuotaError();
    throw err;
  }
}

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
  // 件数上限は設けない。消えるのはユーザーが削除したときだけ。
  // 容量超過時は StorageQuotaError を投げ、何も書き込まない（イベントも発火しない）。
  writeStock(records);
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

// AIカテゴリのみ更新（content・folder・titleには触らない）。空文字でクリア。
export function updateAnalysisAiCategory(id: string, aiCategory: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    const trimmed = aiCategory.trim();
    if (trimmed) {
      records[idx].aiCategory = trimmed;
    } else {
      delete records[idx].aiCategory;
    }
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
    // 複製はグループに混ぜない（同種別のタブが二重に並ぶのを防ぐ）
    groupId: undefined,
  };

  records.splice(records.findIndex((r) => r.id === id) + 1, 0, duplicated);
  // 件数上限なし。容量超過時は StorageQuotaError を投げ、何も書き込まない。
  writeStock(records);
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

// ---- 容量の目安 ----
// localStorage は多くのブラウザで約5MB（UTF-16 文字数×2バイトで概算）。あくまで目安。
export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

export interface StorageUsage {
  stockBytes: number; // dermapdf_analysis_stock の概算バイト数
  totalBytes: number; // 同一オリジンの localStorage 全体の概算バイト数
  limitBytes: number; // 上限の目安
  ratio: number; // totalBytes / limitBytes（0〜）
}

export function estimateStorageUsage(): StorageUsage {
  let stockChars = 0;
  let totalChars = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const value = localStorage.getItem(key) ?? "";
      const chars = key.length + value.length;
      totalChars += chars;
      if (key === STORAGE_KEY) stockChars = chars;
    }
  } catch {
    // アクセス不可（プライベートモード等）は 0 扱い
  }
  const stockBytes = stockChars * 2;
  const totalBytes = totalChars * 2;
  return {
    stockBytes,
    totalBytes,
    limitBytes: STORAGE_LIMIT_BYTES,
    ratio: totalBytes / STORAGE_LIMIT_BYTES,
  };
}

// ---- バックアップからの復元 ----
export interface ImportResult {
  added: number;
  skipped: number;
}

function isImportableRecord(v: unknown): v is AnalysisRecord {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    r.id.length > 0 &&
    typeof r.content === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.fileName === "string" &&
    typeof r.analysisType === "string"
  );
}

// exportAnalysesAsJSON の出力（AnalysisRecord の配列）を読み込み、既存に無い id だけ追加する。
// 既存カードは上書きしない。不正な JSON・形式なら何も書かずに Error を投げる。
// 書き込みは一括1回（途中まで書いて壊さない）。容量超過は StorageQuotaError。
export function importAnalysesFromJSON(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON として読み取れませんでした。バックアップファイルを確認してください");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("バックアップの形式が違います（配列ではありません）");
  }
  const invalid = parsed.findIndex((v) => !isImportableRecord(v));
  if (invalid !== -1) {
    throw new Error(
      `バックアップの ${invalid + 1} 件目に必須項目（id・content・createdAt 等）がありません`
    );
  }
  const incoming = parsed as AnalysisRecord[];
  const existing = loadAllAnalyses();
  const existingIds = new Set(existing.map((r) => r.id));
  const seen = new Set<string>();
  const toAdd: AnalysisRecord[] = [];
  let skipped = 0;
  for (const r of incoming) {
    if (existingIds.has(r.id) || seen.has(r.id)) {
      skipped++;
      continue;
    }
    seen.add(r.id);
    toAdd.push({
      ...r,
      tags: Array.isArray(r.tags) ? r.tags : [],
      folder: typeof r.folder === "string" ? r.folder : "",
      analysisLabel: typeof r.analysisLabel === "string" ? r.analysisLabel : r.analysisType,
    });
  }
  if (toAdd.length === 0) return { added: 0, skipped };
  // 復元分は新しい順（createdAt 降順）で既存の後ろに付ける。既存の並びは崩さない。
  toAdd.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  writeStock([...existing, ...toAdd]);
  window.dispatchEvent(new Event("analysisStockUpdated"));
  return { added: toAdd.length, skipped };
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

${cleanupLatexNotation(record.content)}

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
