import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { excelText, fileName } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const prompt = `以下のクリニック月次集計データから数値を読み取り、JSONのみで回答してください。

データ:
${excelText}

回答形式（JSONのみ・説明文不要）:
{
  "yearMonth": "2026年3月",
  "shiharaiGoukeiTotal": 12889712,
  "shiharaiGoukeiJihi": 7560692,
  "shiharaiGoukeiHoken": 5329020,
  "genkinTotal": 2101370,
  "genkinJihi": 1699190,
  "genkinHoken": 402180,
  "creditTotal": 5665290,
  "creditJihi": 5144040,
  "creditHoken": 521250,
  "qrTotal": 685020,
  "qrJihi": 509670,
  "qrHoken": 175350,
  "emoneyTotal": 264530,
  "emoneyJihi": 186790,
  "emoneyHoken": 77740,
  "henkinTotal": -8210,
  "henkinJihi": 0,
  "henkinHoken": -8210,
  "nyukinGoukeiTotal": 8708000,
  "nyukinGoukeiJihi": 7539690,
  "nyukinGoukeiHoken": 1168310,
  "tensuGoukei": 0,
  "seikyuGoukei": 0,
  "madoGuchiGoukei": 0,
  "mishuGoukei": 0,
  "shaHo": 0,
  "kokuHo": 0,
  "rosai": 0,
  "jibaiseki": 0,
  "kogai": 0,
  "sonotaHoken": 0,
  "shoshinRyo": 0,
  "saishinRyo": 0,
  "kanriRyo": 0,
  "zaitakuRyo": 0,
  "chusha": 0,
  "shochi": 0,
  "shujutsu": 0,
  "kensa": 0,
  "byori": 0,
  "shohosenRyo": 0,
  "sonotaTensu": 0,
  "gazoShindan": 0
}

上記は例です。実際のデータから正しい数値を読み取ってください。
「支払い合計(税込)」行の最初の3つの数値がTotal/自費/保険です。`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("[parse-excel] Gemini error:", response.status, err);
      return NextResponse.json({ error: `Gemini API error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts
        ?.filter((p: { text?: string }) => p.text)
        ?.map((p: { text: string }) => p.text)
        ?.join("") ?? "";

    console.log("[parse-excel] Gemini raw response:", text.slice(0, 500));

    const cleaned = text
      .replace(/^```json\s*/m, "")
      .replace(/^```\s*/m, "")
      .replace(/\s*```$/m, "")
      .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      console.error("[parse-excel] No JSON found in:", cleaned);
      return NextResponse.json({ error: "JSON not found", raw: cleaned.slice(0, 300) }, { status: 500 });
    }

    const jsonStr = cleaned.slice(start, end + 1);
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("[parse-excel] JSON parse error:", parseErr, jsonStr.slice(0, 200));
      return NextResponse.json({ error: "JSON parse failed", raw: jsonStr.slice(0, 200) }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: parsed, fileName });
  } catch (e) {
    console.error("[parse-excel] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
