"use client";

import type { CSSProperties } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

// PDF出力専用のMarkdownレンダラ。
// 画面表示（markdown-view.tsx）と同じ解析（remark-gfm + rehype-raw）で見た目を揃えつつ、
// Tailwindクラスではなく「インラインHEXスタイル」で描画する。
// 理由：Tailwind v4 は oklch を使うため、Tailwindクラス依存だと html2canvas 系で
// 色のパースに失敗しうる。自己完結したHEXスタイルにすることで安全に画像化できる。

// 表示用の軽い整形のみ（markdown-view と同一）。元データ文字列は変更しない。
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

const s = {
  h1: { fontSize: "20px", fontWeight: 700, margin: "18px 0 8px" } as CSSProperties,
  h2: { fontSize: "17px", fontWeight: 700, margin: "16px 0 8px" } as CSSProperties,
  h3: { fontSize: "15px", fontWeight: 600, margin: "14px 0 6px" } as CSSProperties,
  p: { margin: "8px 0", lineHeight: 1.8 } as CSSProperties,
  ul: { paddingLeft: "22px", margin: "8px 0", listStyleType: "disc" } as CSSProperties,
  ol: { paddingLeft: "22px", margin: "8px 0", listStyleType: "decimal" } as CSSProperties,
  li: { margin: "4px 0", lineHeight: 1.8 } as CSSProperties,
  strong: { fontWeight: 700 } as CSSProperties,
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    margin: "12px 0",
    fontSize: "13px",
  } as CSSProperties,
  th: {
    border: "1px solid #B5D4F4",
    background: "#E6F1FB",
    padding: "4px 8px",
    textAlign: "left" as const,
    fontWeight: 600,
  } as CSSProperties,
  td: {
    border: "1px solid #B5D4F4",
    padding: "4px 8px",
    verticalAlign: "top" as const,
  } as CSSProperties,
  hr: { border: 0, borderTop: "1px solid #B5D4F4", margin: "12px 0" } as CSSProperties,
  code: {
    background: "#F1F5F9",
    borderRadius: "4px",
    padding: "1px 4px",
    fontFamily: "monospace",
    fontSize: "12px",
  } as CSSProperties,
};

const components: Components = {
  table: ({ node, ...p }) => <table style={s.table} {...p} />,
  th: ({ node, ...p }) => <th style={s.th} {...p} />,
  td: ({ node, ...p }) => <td style={s.td} {...p} />,
  h1: ({ node, ...p }) => <h1 style={s.h1} {...p} />,
  h2: ({ node, ...p }) => <h2 style={s.h2} {...p} />,
  h3: ({ node, ...p }) => <h3 style={s.h3} {...p} />,
  ul: ({ node, ...p }) => <ul style={s.ul} {...p} />,
  ol: ({ node, ...p }) => <ol style={s.ol} {...p} />,
  li: ({ node, ...p }) => <li style={s.li} {...p} />,
  p: ({ node, ...p }) => <p style={s.p} {...p} />,
  strong: ({ node, ...p }) => <strong style={s.strong} {...p} />,
  hr: () => <hr style={s.hr} />,
  code: ({ node, ...p }) => <code style={s.code} {...p} />,
};

export default function MarkdownPrint({ children }: { children: string }) {
  return (
    <div style={{ color: "#1f2937", lineHeight: 1.8, wordBreak: "break-word" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {normalizeMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}
