import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { excelText, fileName } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const prompt = `以下はクリニック月次集計Excelの重要行データです。
数値を読み取りJSONで回答してください。数値不明は0。

${excelText}

回答はJSONのみ（説明不要）:
{"yearMonth":"2026年3月","shiharaiGoukeiTotal":0,"shiharaiGoukeiJihi":0,"shiharaiGoukeiHoken":0,"genkinTotal":0,"genkinJihi":0,"genkinHoken":0,"creditTotal":0,"creditJihi":0,"creditHoken":0,"qrTotal":0,"qrJihi":0,"qrHoken":0,"emoneyTotal":0,"emoneyJihi":0,"emoneyHoken":0,"henkinTotal":0,"henkinJihi":0,"henkinHoken":0,"nyukinGoukeiTotal":0,"nyukinGoukeiJihi":0,"nyukinGoukeiHoken":0,"tensuGoukei":0,"seikyuGoukei":0,"madoGuchiGoukei":0,"mishuGoukei":0,"shaHo":0,"kokuHo":0,"rosai":0,"jibaiseki":0,"kogai":0,"sonotaHoken":0,"shoshinRyo":0,"saishinRyo":0,"kanriRyo":0,"zaitakuRyo":0,"chusha":0,"shochi":0,"shujutsu":0,"kensa":0,"byori":0,"shohosenRyo":0,"sonotaTensu":0,"gazoShindan":0}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
