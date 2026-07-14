import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// 利用可能なモデル名一覧を返す（新モデル検知用）。
// 従来はクライアントが ListModels を直叩きしていたためAPIキーが露出していた。
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ models: [] }, { status: 200 });
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await res.json();
    const models: string[] = (data.models || []).map((m: { name: string }) =>
      m.name.replace("models/", "")
    );
    return NextResponse.json({ models }, { status: 200 });
  } catch {
    return NextResponse.json({ models: [] }, { status: 200 });
  }
}
