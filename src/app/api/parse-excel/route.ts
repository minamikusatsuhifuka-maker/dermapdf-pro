import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { excelText, fileName } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const prompt = `以下のExcelデータから数値を読み取ってください。

${(excelText as string).slice(0, 4000)}

JSONのみで回答してください：
{
  "yearMonth": "年月（例: 2026年3月）",
  "shiharaiGoukeiTotal": 支払い合計(税込)の合計欄の数値,
  "shiharaiGoukeiJihi": 支払い合計(税込)の自費欄の数値,
  "shiharaiGoukeiHoken": 支払い合計(税込)の保険欄の数値,
  "genkinTotal": 現金の合計,
  "genkinJihi": 現金の自費,
  "genkinHoken": 現金の保険,
  "creditTotal": クレジットカードの合計,
  "creditJihi": クレジットカードの自費,
  "creditHoken": クレジットカードの保険,
  "qrTotal": QR決済の合計,
  "qrJihi": QR決済の自費,
  "qrHoken": QR決済の保険,
  "emoneyTotal": 電子マネーの合計,
  "emoneyJihi": 電子マネーの自費,
  "emoneyHoken": 電子マネーの保険,
  "henkinTotal": 返金対応用の合計,
  "henkinJihi": 返金対応用の自費,
  "henkinHoken": 返金対応用の保険,
  "nyukinGoukeiTotal": 入金額合計の合計,
  "nyukinGoukeiJihi": 入金額合計の自費,
  "nyukinGoukeiHoken": 入金額合計の保険,
  "tensuGoukei": 保険点数合計,
  "seikyuGoukei": 保険請求額合計,
  "madoGuchiGoukei": 窓口負担額合計,
  "mishuGoukei": 未収金合計,
  "shaHo": 社保,
  "kokuHo": 国保,
  "rosai": 労災,
  "jibaiseki": 自賠責,
  "kogai": 公害,
  "sonotaHoken": その他（保険）,
  "shoshinRyo": 初診料,
  "saishinRyo": 再診料,
  "kanriRyo": 管理料,
  "zaitakuRyo": 在宅料,
  "chusha": 皮下筋肉内注射,
  "shochi": 処置行為,
  "shujutsu": 手術,
  "kensa": 検査,
  "byori": 病理診断,
  "shohosenRyo": 処方箋料,
  "sonotaTensu": その他点数,
  "gazoShindan": 画像診断
}`;

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
