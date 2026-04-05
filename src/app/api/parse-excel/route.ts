import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const jsonSchema = `{"yearMonth":"","shiharaiGoukeiTotal":0,"shiharaiGoukeiJihi":0,"shiharaiGoukeiHoken":0,"genkinTotal":0,"genkinJihi":0,"genkinHoken":0,"creditTotal":0,"creditJihi":0,"creditHoken":0,"qrTotal":0,"qrJihi":0,"qrHoken":0,"emoneyTotal":0,"emoneyJihi":0,"emoneyHoken":0,"henkinTotal":0,"henkinJihi":0,"henkinHoken":0,"nyukinGoukeiTotal":0,"nyukinGoukeiJihi":0,"nyukinGoukeiHoken":0,"tensuGoukei":0,"seikyuGoukei":0,"madoGuchiGoukei":0,"mishuGoukei":0,"shaHo":0,"kokuHo":0,"rosai":0,"jibaiseki":0,"kogai":0,"sonotaHoken":0,"shoshinRyo":0,"saishinRyo":0,"kanriRyo":0,"zaitakuRyo":0,"chusha":0,"shochi":0,"shujutsu":0,"kensa":0,"byori":0,"shohosenRyo":0,"sonotaTensu":0,"gazoShindan":0}`;

    const instruction = `あなたはクリニック月次集計データを読み取るAIです。
画像またはテキストからデータを読み取り、以下のJSONのみで回答してください。
説明文・マークダウン・コードブロックは一切不要です。JSONのみ返してください。

抽出する項目:
- yearMonth: 日付情報から「YYYY年M月」形式
- shiharaiGoukeiTotal/Jihi/Hoken: 「支払い合計(税込)」行の合計/自費/保険
- genkinTotal/Jihi/Hoken: 「現金」行の合計/自費/保険
- creditTotal/Jihi/Hoken: 「クレジットカード」行の合計/自費/保険
- qrTotal/Jihi/Hoken: 「QR決済」行の合計/自費/保険
- emoneyTotal/Jihi/Hoken: 「電子マネー」行の合計/自費/保険
- henkinTotal/Jihi/Hoken: 「返金対応用」行の合計/自費/保険
- nyukinGoukeiTotal/Jihi/Hoken: 「入金額合計」行の合計/自費/保険
- tensuGoukei: 保険点数合計, seikyuGoukei: 保険請求額合計, madoGuchiGoukei: 窓口負担額合計, mishuGoukei: 未収金合計
- shaHo: 社保, kokuHo: 国保, rosai: 労災, jibaiseki: 自賠責, kogai: 公害, sonotaHoken: その他保険
- shoshinRyo: 初診料, saishinRyo: 再診料, kanriRyo: 管理料, zaitakuRyo: 在宅料
- chusha: 皮下筋肉内注射, shochi: 処置行為, shujutsu: 手術, kensa: 検査, byori: 病理診断
- shohosenRyo: 処方箋料, sonotaTensu: その他点数, gazoShindan: 画像診断

JSON形式: ${jsonSchema}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents: any[];

    if (body.imageBase64) {
      contents = [{
        role: "user",
        parts: [
          { inline_data: { mime_type: body.mimeType || "image/png", data: body.imageBase64 } },
          { text: instruction },
        ],
      }];
    } else {
      contents = [{
        role: "user",
        parts: [{ text: `${instruction}\n\nデータ:\n${body.excelText}` }],
      }];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0, maxOutputTokens: 1024 },
        }),
      }
    );

    const raw = await response.text();
    console.log("[parse-excel] status:", response.status);

    if (!response.ok) {
      console.error("[parse-excel] error:", raw.slice(0, 300));
      return NextResponse.json({ error: `Gemini error: ${response.status}` }, { status: 500 });
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
      console.error("[parse-excel] no JSON:", cleaned.slice(0, 200));
      return NextResponse.json({ error: "No JSON found", raw: cleaned.slice(0, 300) }, { status: 500 });
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return NextResponse.json({ success: true, data: parsed });
  } catch (e) {
    console.error("[parse-excel] exception:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
