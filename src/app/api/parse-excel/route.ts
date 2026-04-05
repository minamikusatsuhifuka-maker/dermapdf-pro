import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { excelText } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const requestBody = {
      system_instruction: {
        parts: [{
          text: "あなたはデータ抽出AIです。ユーザーから渡されたテキストデータを解析し、指定されたJSONフォーマットのみで回答してください。説明文、マークダウン、コードブロックは一切不要です。JSONオブジェクトのみを返してください。",
        }],
      },
      contents: [{
        role: "user",
        parts: [{
          text: `以下のクリニック月次集計データから数値を読み取り、JSONのみで返してください。

${excelText}

抽出ルール:
- yearMonth: 「日付:」の後の年月 → "2026年3月" 形式
- Sheet1の「現金」行: 最初の3つの数値が合計/自費/保険
- Sheet1の「クレジットカード」行: 最初の3つの数値が合計/自費/保険
- Sheet1の「ＱＲ決済」行: 最初の3つの数値が合計/自費/保険
- Sheet1の「電子マネー」行: 最初の3つの数値が合計/自費/保険
- Sheet1の「返金対応用」行: 最初の3つの数値が合計/自費/保険
- Sheet1の「入金額合計」行: 最初の3つの数値が合計/自費/保険
- Sheet1の「支払い合計(税込)」行（行頭にあるもの）: 最初の3つの数値が合計/自費/保険
- 保険シートの「保険点数合計」の直後の数値
- 保険シートの「保険請求額合計」の直後の数値
- 保険シートの「窓口負担額合計」の直後の数値
- 保険シートの「未収金合計」の直後の数値
- 保険シートの「社保」「国保」「労災」「自賠責」「公害」の直後の数値
- 保険シートの「初診料」「再診料」「管理料」「在宅料」の直後の数値
- 保険シートの「皮下・筋肉内注射」「処置行為」「手術」「検査」「病理診断」「処方箋料」の直後の数値

返答するJSONの形式:
{"yearMonth":"","shiharaiGoukeiTotal":0,"shiharaiGoukeiJihi":0,"shiharaiGoukeiHoken":0,"genkinTotal":0,"genkinJihi":0,"genkinHoken":0,"creditTotal":0,"creditJihi":0,"creditHoken":0,"qrTotal":0,"qrJihi":0,"qrHoken":0,"emoneyTotal":0,"emoneyJihi":0,"emoneyHoken":0,"henkinTotal":0,"henkinJihi":0,"henkinHoken":0,"nyukinGoukeiTotal":0,"nyukinGoukeiJihi":0,"nyukinGoukeiHoken":0,"tensuGoukei":0,"seikyuGoukei":0,"madoGuchiGoukei":0,"mishuGoukei":0,"shaHo":0,"kokuHo":0,"rosai":0,"jibaiseki":0,"kogai":0,"sonotaHoken":0,"shoshinRyo":0,"saishinRyo":0,"kanriRyo":0,"zaitakuRyo":0,"chusha":0,"shochi":0,"shujutsu":0,"kensa":0,"byori":0,"shohosenRyo":0,"sonotaTensu":0,"gazoShindan":0}`,
        }],
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const raw = await response.text();
    console.log("[parse-excel] status:", response.status);
    console.log("[parse-excel] raw:", raw.slice(0, 300));

    if (!response.ok) {
      return NextResponse.json({ error: `Gemini error: ${response.status}`, raw: raw.slice(0, 500) }, { status: 500 });
    }

    const data = JSON.parse(raw);
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || "")
      .join("") ?? "";

    console.log("[parse-excel] gemini text:", text.slice(0, 300));

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
      console.error("[parse-excel] no JSON in:", cleaned);
      return NextResponse.json({ error: "No JSON found", raw: cleaned.slice(0, 300) }, { status: 500 });
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return NextResponse.json({ success: true, data: parsed });
  } catch (e) {
    console.error("[parse-excel] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
