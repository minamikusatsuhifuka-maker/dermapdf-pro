import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// 【廃止】このルートは APIキーをブラウザへ返していたため露出の原因だった。
// Gemini 呼び出しは全て /api/gemini/* のサーバルート経由に一本化済みで、
// キーはサーバ（GEMINI_API_KEY）から出さない。キーの有無確認は /api/check-keys を使う。
// ルート名は残すが、キーは決して返さない。
export async function GET() {
  return NextResponse.json(
    {
      key: "",
      error:
        "このエンドポイントは廃止されました。Gemini呼び出しは /api/gemini/* を使用してください。",
    },
    { status: 410 }
  );
}
