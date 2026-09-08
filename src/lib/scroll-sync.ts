import type { MutableRefObject } from "react";

// 複数の縦スクロール枠を「進捗率」で同期する共通ヘルパ。
// 保存カードの横並び比較ビュー（6f0ea00）で実装した方式をそのまま切り出したもの。
// - ratio = scrollTop / (scrollHeight - clientHeight)
// - 同期でプログラム的に動かした分が再発火して往復しないよう syncingRef + rAF で抑制
// - scrollHeight - clientHeight が 0 の枠（スクロール不要）は 0 除算を避けて同期対象外
export function syncScrollByRatio(
  sourceKey: string,
  refs: Record<string, HTMLDivElement | null>,
  syncingRef: MutableRefObject<boolean>
): void {
  if (syncingRef.current) return;
  const src = refs[sourceKey];
  if (!src) return;
  const denom = src.scrollHeight - src.clientHeight;
  if (denom <= 0) return;
  const ratio = src.scrollTop / denom;
  syncingRef.current = true;
  for (const [otherKey, el] of Object.entries(refs)) {
    if (otherKey === sourceKey || !el) continue;
    const d = el.scrollHeight - el.clientHeight;
    if (d <= 0) continue;
    el.scrollTop = ratio * d;
  }
  requestAnimationFrame(() => {
    syncingRef.current = false;
  });
}
