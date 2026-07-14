import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { callGeminiWithRetry, resolveBase64 } from "@/lib/server/gemini-server";

// Gemini 呼び出しは Node runtime 必須（edge は既知の失敗事象あり）。
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// 複数画像をPDFに統合せず inline_data の画像パートとして解析（「画像のままAI分析」）。
// 画像の圧縮はクライアント側（compressImagesToParts）のまま。ここは送信と解析のみ。
// Blob 経由で受け取った画像は解析後に finally で必ず即削除する。
export async function POST(request: Request) {
  let blobUrls: string[] = [];

  try {
    const body = (await request.json()) as {
      items?: { blobUrl?: string; inlineBase64?: string; mimeType?: string }[];
      prompt?: string;
      analysisType?: string;
      maxOutputTokens?: number;
    };

    const items = body.items ?? [];
    blobUrls = items
      .map((i) => i.blobUrl)
      .filter((u): u is string => typeof u === "string");

    if (!body.prompt || items.length === 0) {
      return NextResponse.json(
        { success: false, analysis: "", error: "分析対象の画像がありません" },
        { status: 200 }
      );
    }

    const inlineParts = await Promise.all(
      items.map(async (item) => ({
        base64: await resolveBase64(item),
        mime: item.mimeType || "image/jpeg",
      }))
    );

    const isTranscription = body.analysisType === "transcription";
    const result = await callGeminiWithRetry({
      prompt: body.prompt,
      inlineParts,
      thinkingMinimal: isTranscription,
      maxOutputTokens: body.maxOutputTokens ?? (isTranscription ? 65536 : 8192),
      temperature: isTranscription ? 0.1 : 0.3,
      timeoutMs: isTranscription ? 280000 : 120000,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        analysis: "",
        error: e instanceof Error ? e.message : "AI分析に失敗しました",
      },
      { status: 200 }
    );
  } finally {
    for (const url of blobUrls) {
      try {
        await del(url);
      } catch {
        /* 削除失敗は解析結果に影響させない */
      }
    }
  }
}
