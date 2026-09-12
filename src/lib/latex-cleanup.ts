// 生成結果への LaTeX（数式）記法の混入対策をまとめた共通モジュール。
// ・NO_LATEX_RULE        : 本文生成系プロンプトの末尾に足す「数式記法を使うな」の1行ルール（予防）
// ・cleanupLatexNotation : 既に生成・保存済みの本文に残った既知記法を記号へ戻す（表示・出力時の保険）
// 数式レンダリング（remark-math / rehype-katex）は導入しない方針。新規依存なし。

// 本文生成系プロンプトの末尾に1行だけ足す共通ルール。
// 既存プロンプトの指示内容・出力構成は一切変更せず、これを末尾に連結するだけで使う。
// ※ 校正の検出プロンプト（JSON応答）には付けない。
export const NO_LATEX_RULE =
  "\n\n【表記ルール】数式記法（LaTeX、`$...$`、\\rightarrow 等のコマンド）は使用しないでください。" +
  "矢印は「→」、プラスマイナスは「±」のように、記号を直接そのまま書いてください。";

// 置換対象は「よく出る既知パターン」のみ。$...$ で囲まれた任意文字列を無差別に削らない（誤爆防止）。
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

// 例: `$\rightarrow$` `$ \pm $` のみにマッチ。長い名前（leq/geq）を先に並べて部分一致を防ぐ。
const KNOWN_LATEX_RE =
  /\$\s*\\(rightarrow|leftarrow|pm|times|div|approx|leq|le|geq|ge|%)\s*\$/g;

// 表示・出力時だけ使う軽量サニタイズ。保存データ（AnalysisRecord.content）は書き換えない。
export function cleanupLatexNotation(text: string): string {
  if (!text || text.indexOf("$") === -1) return text;
  return text.replace(KNOWN_LATEX_RE, (m, cmd: string) => LATEX_SYMBOLS[cmd] ?? m);
}
