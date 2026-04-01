import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// このルートは非推奨。クライアント側で直接 Gemini API を呼ぶ方式に移行済み。
// 後方互換のため残すが、413エラーが発生する可能性がある。
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "このエンドポイントは廃止されました。クライアント側から直接Gemini APIを呼び出してください。",
    },
    { status: 200 }
  );
}
