// 生成結果への LaTeX（数式）記法の混入対策をまとめた共通モジュール。
// ・NO_LATEX_RULE        : 本文生成系プロンプトの末尾に足す「数式記法を使うな」のルール（予防）
// ・cleanupLatexNotation : 既に生成・保存済みの本文に残った記法を記号へ戻す（表示・出力時の保険）
// 数式レンダリング（remark-math / rehype-katex）は導入しない方針。新規依存なし。

// 本文生成系プロンプトの末尾に足す共通ルール。
// 既存プロンプトの指示内容・出力構成は一切変更せず、これを末尾に連結するだけで使う。
// ※ 校正の検出プロンプト（JSON応答）・カテゴリ分類・タイトル生成には付けない。
// 単一コマンド（$\rightarrow$）だけでなく「数式全体を $...$ で囲む」形も明示的に禁止し、
// 実際に出てしまった悪い例→良い例のペアを示す（例示の方が指示より効く）。
export const NO_LATEX_RULE =
  "\n\n【表記ルール】数式・記号はすべてプレーンテキストで直接書いてください。" +
  "`$` で囲む記法（インライン数式）や `\\times` `\\pm` `\\rightarrow` などの LaTeX コマンドは一切使用しないでください。\n" +
  "例：`$5 \\times 5 = 25$` ではなく `5 × 5 = 25` と書く。" +
  "`$5 + 5 = 10 = 8 + 2$` ではなく `5 + 5 = 10 = 8 + 2`。" +
  "`$\\pm 10\\%$` ではなく `±10%`。`$\\rightarrow$` ではなく `→`。";

// 既知の LaTeX コマンド → 記号。ここに無いコマンドは一切触らない（温存）。
const LATEX_SYMBOLS: Record<string, string> = {
  rightarrow: "→",
  leftarrow: "←",
  pm: "±",
  times: "×",
  div: "÷",
  approx: "≈",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  "%": "%",
};

// 既知コマンドの並び（長い名前を先に置き、leq が le として部分一致するのを防ぐ）。
const CMD = "rightarrow|leftarrow|approx|times|leq|geq|pm|div|le|ge|%";

// $...$ の候補。改行をまたがず、長すぎるものは対象外（暴走防止）。
const INLINE_MATH_RE = /\$([^$\n]{1,200})\$/g;

// 「数式として安全な中身」＝ 数字・空白・+ - = ( ) . , % / と既知コマンドだけ。
// 英単語・日本語・未知の \コマンド が1文字でも混ざれば対象外（＝温存）。
const SAFE_INNER_RE = new RegExp(
  `^(?:[0-9\\s+\\-=().,%\\/]|\\\\(?:${CMD}))+$`
);

// 既知コマンドを記号へ置換。未知コマンドはそのまま残す。
const CMD_RE = new RegExp(`\\\\(${CMD})`, "g");

// 単独で使われた既知コマンド（$ で囲まれていない裸の \times など）は触らない。
// 触るのは「$ で囲まれた安全な中身」だけに限定する。
function convertCommands(inner: string): string {
  return inner.replace(CMD_RE, (m, cmd: string) => LATEX_SYMBOLS[cmd] ?? m);
}

// 表示・出力時だけ使う軽量サニタイズ。保存データ（AnalysisRecord.content）は書き換えない。
// 金額表記（`$1,200 から $3,500 へ`・`$500 + $300`）を壊さないことを最優先し、
// 数式と断定できないものはすべて温存する。
export function cleanupLatexNotation(text: string): string {
  if (!text || text.indexOf("$") === -1) return text;
  return text.replace(INLINE_MATH_RE, (whole, inner: string) => {
    // ① 中身が安全な文字だけで構成されていること（英字・日本語・未知コマンドを含むなら温存）
    if (!SAFE_INNER_RE.test(inner)) return whole;
    // ② 既知コマンドか「=」を含むこと。どちらも無いものは金額の並び（`$500 + $`）の可能性が高い
    if (!/\\[a-z%]/.test(inner) && !inner.includes("=")) return whole;
    const converted = convertCommands(inner)
      .trim()
      .replace(/\s+/g, " ")
      // 「± 10%」→「±10%」。前置記号の ± だけ空白を詰める（× ÷ は数の間に入るので触らない）
      .replace(/±\s+(?=[\d.])/g, "±");
    if (!converted) return whole;
    // ③ 演算子で始まる/終わるものは式として不完全＝金額の連結とみなして温存（`$500 = $`）
    if (/^[+\-=,/]/.test(converted) || /[+\-=,/]$/.test(converted)) return whole;
    return converted;
  });
}
