// Markdown記号を整理した読みやすいプレーンテキストへ変換（.txt出力の共通整形）。
// 見出しは記号を外して見出し行＋空行、太字/斜体/コードの記号を除去、箇条書きは「・」、
// テーブルはセル内容を保持、リンクはテキストのみ、水平線は罫線文字に。構造は保つ。
// 依存なし（一括テキスト出力・個別テキスト出力で共通利用）。
export function markdownToPlainText(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (let raw of lines) {
    // 見出し: ### 見出し → 見出し（前に空行）
    const heading = raw.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (heading) {
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      raw = heading[2];
    }

    // 水平線
    if (/^\s*([-*_])\1{2,}\s*$/.test(raw)) {
      out.push("─".repeat(24));
      continue;
    }

    // テーブル区切り行（|---|---|）は除去
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(raw) && raw.includes("-") && raw.includes("|")) {
      continue;
    }

    // テーブル行: | a | b | → a | b
    if (/^\s*\|.*\|\s*$/.test(raw)) {
      raw = raw
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim())
        .join(" | ");
    }

    // 箇条書き: -, *, + → ・（番号付きは維持）
    raw = raw.replace(/^(\s*)[-*+]\s+/, "$1・");

    // 強調・コードの記号を除去、リンクはテキストのみ
    raw = raw
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/, "");

    out.push(raw);
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
