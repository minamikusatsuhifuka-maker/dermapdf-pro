// 保存カードのAI自動カテゴライズ。
// - カテゴリは folder とは独立の AnalysisRecord.aiCategory に持つ（folderには一切書かない）。
// - Gemini は必ずサーバ経由（analyzeTextWithGemini → /api/gemini/analyze-text）。
// - 分類の失敗・タイムアウトでは null を返すだけで、呼び出し元の保存を壊さない。
import { analyzeTextWithGemini } from "./gemini-client";
import { markdownToPlainText } from "./markdown-plain";
import { loadAllAnalyses, updateAnalysisAiCategory } from "./analysis-storage";

// content は編集の有無で「生Markdown」と「HTML」の2種類ありうるため、
// analysis-stock-panel.tsx の htmlToText と同じ規則でテキスト化してから使う。
function htmlToTextForCategory(content: string): string {
  if (!content) return "";
  if (/<[a-z!/][\s\S]*?>/i.test(content)) {
    return content
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return content.trim();
}

// 分類プロンプトに渡す本文（プレーン化して先頭1500字）
export function normalizeContentForCategory(content: string): string {
  return markdownToPlainText(htmlToTextForCategory(content)).slice(0, 1500);
}

// 既存カテゴリ一覧（重複排除・最大30件）。似た意味のカテゴリの乱立を防ぐため
// プロンプトに渡して「近いものがあれば新語を作らず流用」させる。
export function getExistingAiCategories(max = 30): string[] {
  const seen = new Set<string>();
  for (const r of loadAllAnalyses()) {
    const c = (r.aiCategory || "").trim();
    if (c) seen.add(c);
    if (seen.size >= max) break;
  }
  return Array.from(seen);
}

// タイムアウト付きカテゴリ生成（generateTitleWithTimeout と同じ作法：
// 短いプロンプト・thinkingMinimal・超過/失敗時はフォールバック＝null）。
export async function generateCategoryWithTimeout(
  content: string,
  existingCategories: string[],
  timeoutMs = 15000
): Promise<string | null> {
  const body = normalizeContentForCategory(content);
  if (!body.trim()) return null;
  const existingBlock = existingCategories.length
    ? `\n【既存カテゴリ一覧】\n${existingCategories.join(" ／ ")}\n意味が近いものが上の一覧にあれば、新しい言葉を作らずその名称をそのまま使ってください。\n`
    : "";
  const prompt =
    "次の文書の主題を表すカテゴリ名を1つだけ出力してください。\n" +
    "- 日本語で6〜12字程度の短い名詞句にする（例：営業・トーク術／健康食品トレンド／法令・コンプライアンス）\n" +
    "- カテゴリ名のみを出力する（説明・記号・改行を付けない）\n" +
    existingBlock +
    `\n【文書】\n${body}`;
  try {
    const data = await Promise.race([
      analyzeTextWithGemini(prompt, undefined, undefined, true),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (data?.success && data.analysis) {
      const cat = data.analysis
        .replace(/^["「『【]|["」』】]$/g, "")
        .replace(/\n/g, "")
        .trim()
        .slice(0, 20);
      return cat || null;
    }
  } catch (e) {
    console.error("[aiCategory] 分類失敗:", e);
  }
  return null;
}

// 保存済みカードをバックグラウンドで分類し、aiCategory のみ更新する。
// 保存経路から fire-and-forget で呼ぶ（失敗しても保存済みカードには影響しない）。
export async function classifyAnalysisInBackground(
  id: string,
  content: string
): Promise<void> {
  try {
    const cat = await generateCategoryWithTimeout(content, getExistingAiCategories());
    if (cat) updateAnalysisAiCategory(id, cat);
  } catch {
    // 未分類のままにする
  }
}
