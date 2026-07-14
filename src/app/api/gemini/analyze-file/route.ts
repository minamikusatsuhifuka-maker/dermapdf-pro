import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { callGeminiWithRetry, resolveBase64 } from "@/lib/server/gemini-server";

// Gemini 呼び出しは Node runtime 必須（edge は既知の失敗事象あり）。
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// 単一ファイル（PDF・画像）の解析。
// ≤3MB は inlineBase64 でJSON直送、>3MB は Blob へ上げて blobUrl だけ渡す（4.5MB制限回避）。
// blobUrl を使った場合は解析後に finally で必ず即削除する（残骸を残さない）。
export async function POST(request: Request) {
  let blobUrl: string | undefined;

  try {
    const body = (await request.json()) as {
      blobUrl?: string;
      inlineBase64?: string;
      mimeType?: string;
      prompt?: string;
      analysisType?: string;
      maxOutputTokens?: number;
    };
    blobUrl = body.blobUrl;

    if (!body.prompt || !body.mimeType) {
      return NextResponse.json(
        { success: false, analysis: "", error: "解析パラメータが不足しています" },
        { status: 200 }
      );
    }

    const base64 = await resolveBase64(body);

    // 書き起こし（mechanical）は thinking 最小・低温・大きめ出力枠（従来と同一）。
    const isTranscription = body.analysisType === "transcription";
    const result = await callGeminiWithRetry({
      prompt: body.prompt,
      inlineParts: [{ base64, mime: body.mimeType }],
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
    // Blob 経由で受け取ったファイルは解析の成否によらず即削除する。
    if (blobUrl) {
      try {
        await del(blobUrl);
      } catch {
        /* 削除失敗は解析結果に影響させない */
      }
    }
  }
}
