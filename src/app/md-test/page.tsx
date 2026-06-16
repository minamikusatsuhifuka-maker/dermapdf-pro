"use client";

import MarkdownView from "@/components/ui/markdown-view";

const tests = [
  {
    id: 1,
    label: "1. 見出し・太字・箇条書き（要約系）",
    expect: "### → 見出し / ** → 太字 / - → 箇条書き。# * - の記号が文字として残らないこと。",
    raw: `### 月次サマリー
今月の売上は **増加** しました。要因は以下です。
- 新規患者の増加
- 自費メニューの伸び
#### 補足
来月は *予約枠* の拡張を検討。`,
  },
  {
    id: 2,
    label: "2. 基本テーブル",
    expect: "2列の表として枠線付きで描画。| や --- が文字として見えないこと。",
    raw: `| 区分 | 金額 |
| --- | --- |
| 自費 | 7,560,692 |
| 保険 | 5,329,020 |
| 合計 | 12,889,712 |`,
  },
  {
    id: 3,
    label: "3. セル内 <br>（今回の不具合の核心）",
    expect: "右セル内で <br> が改行として表示される。<br> の文字が残らないこと。",
    raw: `| 評価項目 | チェック内容 |
| --- | --- |
| 接遇 | □ 笑顔で対応している<br><br>□ 名前を名乗っている |
| 説明 | □ 専門用語を避ける<br>□ 次回予約を案内する |`,
  },
  {
    id: 4,
    label: "4. テーブル直前に空行が無いケース（normalize確認）",
    expect: "前行に文章があっても表として描画される（normalizeMarkdownが空行を補う）。",
    raw: `以下の内容を確認してください。
| 状況 | 対応 |
| --- | --- |
| 初診 | 問診票を渡す |
| 再診 | 経過を確認する |`,
  },
  {
    id: 5,
    label: "5. 実データ相当の混在ブロック",
    expect: "ページ見出し行は文字のまま / 表は表に / <br>は改行に。記号が生で残らないこと。",
    raw: `--- P.12 ---
## 患者対応チェック
| 場面 | 評価ポイント<br>できたら✓ | メモ |
| --- | --- | --- |
| 受付 | □ 順番を案内<br><br>□ 待ち時間を伝える | |
| 会計 | □ 金額を明確に説明 | |`,
  },
  {
    id: 6,
    label: "6. 区切り線の扱い",
    expect: "--- だけの行は水平線に。--- P.12 --- のように文字を含む行は文字のまま。",
    raw: `セクションA
---
セクションB`,
  },
];

export default function MdTestPage() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-4">
        <h1 className="text-xl font-bold text-[#185FA5]">
          MarkdownView 表示テスト（一時ページ）
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          各ブロックの「入力（生テキスト）」と「表示（MarkdownView）」を見比べ、
          期待どおり描画されるか確認してください。確認後はこのページ（/md-test）を削除します。
        </p>
      </div>

      {tests.map((t) => (
        <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-800">{t.label}</h2>
            <p className="text-xs text-[#1D9E75] mt-1">期待: {t.expect}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">入力（生テキスト）</div>
              <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap break-words">{t.raw}</pre>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">表示（MarkdownView）</div>
              <div className="border border-[#B5D4F4] rounded-lg p-3">
                <MarkdownView>{t.raw}</MarkdownView>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
