"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

// 表示用の軽い整形のみ。元データ文字列は一切変更しない。
function normalizeMarkdown(src: string): string {
  const lines = src.split("\n");
  const isRow = (s: string) => /^\s*\|.*\|\s*$/.test(s);
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1] ?? "";
    // 表ブロックの直前に空行が無いと GFM がテーブルを認識しないことがあるため空行を挿入
    if (isRow(line) && prev.trim() !== "" && !isRow(prev)) out.push("");
    out.push(line);
  }
  return out.join("\n");
}

// 配色はソフトブルー×スレートに合わせる（表ボーダー #B5D4F4・見出し背景 #E6F1FB）。
// node は hast ノードのため DOM へ渡さず除外する。
const components: Components = {
  table: ({ node, ...p }) => (
    <table className="w-full border-collapse my-3 text-sm" {...p} />
  ),
  th: ({ node, ...p }) => (
    <th
      className="border border-[#B5D4F4] bg-[#E6F1FB] px-2 py-1 text-left font-semibold"
      {...p}
    />
  ),
  td: ({ node, ...p }) => (
    <td className="border border-[#B5D4F4] px-2 py-1 align-top" {...p} />
  ),
  h1: ({ node, ...p }) => <h1 className="text-lg font-bold mt-4 mb-2" {...p} />,
  h2: ({ node, ...p }) => <h2 className="text-base font-bold mt-3 mb-2" {...p} />,
  h3: ({ node, ...p }) => (
    <h3 className="text-base font-semibold mt-3 mb-1.5" {...p} />
  ),
  ul: ({ node, ...p }) => <ul className="list-disc pl-5 my-2 space-y-1" {...p} />,
  ol: ({ node, ...p }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1" {...p} />
  ),
  p: ({ node, ...p }) => <p className="my-2 leading-relaxed" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold" {...p} />,
  hr: () => <hr className="my-3 border-[#B5D4F4]" />,
};

export default function MarkdownView({ children }: { children: string }) {
  return (
    <div className="leading-relaxed text-[#1f2937] break-words">
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
