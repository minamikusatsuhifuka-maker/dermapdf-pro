import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { excelText, fileName } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const prompt = `以下はクリニックの月次集計Excelをテキスト化したデータです。
各項目の数値を正確に読み取り、JSONで返してください。
数値が見つからない場合は0。小数は切り捨て整数に。

${excelText}

以下のJSON形式のみで返答（説明文・マークダウン不要）:
{
  "yearMonth": "YYYY年M月",
  "shiharaiGoukeiTotal": 0, "shiharaiGoukeiJihi": 0, "shiharaiGoukeiHoken": 0,
  "genkinTotal": 0, "genkinJihi": 0, "genkinHoken": 0,
  "creditTotal": 0, "creditJihi": 0, "creditHoken": 0,
  "qrTotal": 0, "qrJihi": 0, "qrHoken": 0,
  "emoneyTotal": 0, "emoneyJihi": 0, "emoneyHoken": 0,
  "henkinTotal": 0, "henkinJihi": 0, "henkinHoken": 0,
  "nyukinGoukeiTotal": 0, "nyukinGoukeiJihi": 0, "nyukinGoukeiHoken": 0,
  "tensuGoukei": 0, "seikyuGoukei": 0, "madoGuchiGoukei": 0, "mishuGoukei": 0,
  "shaHo": 0, "kokuHo": 0, "rosai": 0, "jibaiseki": 0, "kogai": 0, "sonotaHoken": 0,
  "shoshinRyo": 0, "saishinRyo": 0, "kanriRyo": 0, "zaitakuRyo": 0,
  "chusha": 0, "shochi": 0, "shujutsu": 0, "kensa": 0, "byori": 0,
  "shohosenRyo": 0, "sonotaTensu": 0, "gazoShindan": 0
}

読み取りのヒント:
- yearMonth: 「日付:」の後ろにある年月（例: 2026/03/01 → 2026年3月）
- shiharaiGoukei: 「支払い合計(税込)」という行ラベルの隣にある合計・自費・保険の3つの数値。同名ラベルが複数ある場合は最大の合計値の行を使用
- genkin: 「現金」行の合計・自費・保険
- credit: 「クレジットカード」行の合計・自費・保険
- qr: 「ＱＲ決済」または「QR決済」行の合計・自費・保険
- emoney: 「電子マネー」行の合計・自費・保険
- henkin: 「返金対応用」行の合計・自費・保険
- nyukinGoukei: 「入金額合計」行の合計・自費・保険
- tensuGoukei: 「保険点数合計」の数値（点数）
- seikyuGoukei: 「保険請求額合計」の数値（円）
- madoGuchiGoukei: 「窓口負担額合計」の数値（円）
- mishuGoukei: 「未収金合計」の数値（円）
- shaHo/kokuHo: 「社保」「国保」の金額
- shoshinRyo〜shohosenRyo: 各点数項目
- sonotaTensu: 「その他（リハビリ」を含む行の点数
- gazoShindan: 「画像診断」の点数`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini error:", response.status, err);
      return NextResponse.json({ error: `Gemini API error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts
        ?.filter((p: { text?: string }) => p.text)
        ?.map((p: { text: string }) => p.text)
        ?.join("") ?? "";

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("No JSON in response:", text);
      return NextResponse.json({ error: "JSON parse failed", raw: text }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]);
    return NextResponse.json({ success: true, data: parsed, fileName });
  } catch (e) {
    console.error("parse-excel error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
