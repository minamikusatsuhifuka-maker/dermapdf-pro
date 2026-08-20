"use client";

// コピー処理の共通ヘルパ。1回のコピーで「書式付き(HTML)」と「プレーンテキスト」の
// 両方をクリップボードに載せ、貼り先(Word/メモ/チャット等)が最適な形を自動で拾えるようにする。
// - text/html : Markdownをレンダリングした書式付きHTML（Word/Googleドキュメント/メール等が拾う）
// - text/plain: markdownToPlainText で記号を除去した読みやすいテキスト（メモ帳/チャット等が拾う）
// ClipboardItem 非対応環境では writeText でプレーンにフォールバック（生Markdownにはしない）。

import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { markdownToPlainText } from "@/lib/markdown-plain";

// 貼り付け先は Tailwind クラスを解釈しないため、基本的なインラインスタイルで書式を付ける
// （見出しサイズ・太字・リスト・表の枠線程度）。配色は画面表示の markdown-view に合わせる。
const components: Components = {
  table: ({ node, ...p }) => (
    <table
      style={{ borderCollapse: "collapse", width: "100%", margin: "12px 0", fontSize: "14px" }}
      {...p}
    />
  ),
  th: ({ node, ...p }) => (
    <th
      style={{
        border: "1px solid #B5D4F4",
        background: "#E6F1FB",
        padding: "4px 8px",
        textAlign: "left",
        fontWeight: 600,
      }}
      {...p}
    />
  ),
  td: ({ node, ...p }) => (
    <td style={{ border: "1px solid #B5D4F4", padding: "4px 8px", verticalAlign: "top" }} {...p} />
  ),
  h1: ({ node, ...p }) => (
    <h1 style={{ fontSize: "1.5em", fontWeight: 700, margin: "16px 0 8px" }} {...p} />
  ),
  h2: ({ node, ...p }) => (
    <h2 style={{ fontSize: "1.3em", fontWeight: 700, margin: "14px 0 8px" }} {...p} />
  ),
  h3: ({ node, ...p }) => (
    <h3 style={{ fontSize: "1.1em", fontWeight: 600, margin: "12px 0 6px" }} {...p} />
  ),
  ul: ({ node, ...p }) => <ul style={{ paddingLeft: "20px", margin: "8px 0" }} {...p} />,
  ol: ({ node, ...p }) => <ol style={{ paddingLeft: "20px", margin: "8px 0" }} {...p} />,
  li: ({ node, ...p }) => <li style={{ margin: "2px 0" }} {...p} />,
  p: ({ node, ...p }) => <p style={{ margin: "8px 0", lineHeight: 1.6 }} {...p} />,
  strong: ({ node, ...p }) => <strong style={{ fontWeight: 700 }} {...p} />,
  em: ({ node, ...p }) => <em style={{ fontStyle: "italic" }} {...p} />,
  a: ({ node, ...p }) => <a style={{ color: "#185FA5", textDecoration: "underline" }} {...p} />,
  hr: () => (
    <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid #B5D4F4" }} />
  ),
  blockquote: ({ node, ...p }) => (
    <blockquote
      style={{ borderLeft: "3px solid #B5D4F4", paddingLeft: "12px", margin: "8px 0", color: "#475569" }}
      {...p}
    />
  ),
  code: ({ node, ...p }) => (
    <code
      style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: "3px", fontFamily: "monospace", fontSize: "0.9em" }}
      {...p}
    />
  ),
};

// 表ブロックの直前に空行が無いと GFM がテーブルを認識しないことがあるため空行を挿入。
// （画面表示の markdown-view.tsx と同じ整形。元データ文字列は変更しない）
function normalizeMarkdown(src: string): string {
  const lines = src.split("\n");
  const isRow = (s: string) => /^\s*\|.*\|\s*$/.test(s);
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1] ?? "";
    if (isRow(line) && prev.trim() !== "" && !isRow(prev)) out.push("");
    out.push(line);
  }
  return out.join("\n");
}

// 画面表示と同じ変換規則(react-markdown + remark-gfm)でHTML文字列を生成する。
function markdownToHtml(markdown: string): string {
  const body = renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={components}
    >
      {normalizeMarkdown(markdown)}
    </ReactMarkdown>
  );
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,'Hiragino Sans','Noto Sans JP',sans-serif;color:#1f2937;line-height:1.6;">${body}</div>`;
}

/**
 * Markdown本文を「書式付きHTML＋プレーンテキスト」の両形式でクリップボードにコピーする。
 * 非対応環境では markdownToPlainText のプレーンテキストで writeText フォールバック。
 */
export async function copyRichText(markdown: string): Promise<void> {
  const plain = markdownToPlainText(markdown);
  try {
    if (
      typeof ClipboardItem !== "undefined" &&
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function"
    ) {
      const html = markdownToHtml(markdown);
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      return;
    }
  } catch {
    // リッチ書き込みに失敗した場合はプレーンへフォールバック（生Markdownにはしない）
  }
  await navigator.clipboard.writeText(plain);
}
