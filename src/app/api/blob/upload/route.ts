import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// Gemini 呼び出しは Node runtime 必須（edge は既知の失敗事象あり）。
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// 大容量ファイル（>3MB）をクライアントから Vercel Blob へ直接アップロードするための
// トークンを発行する。アップロード後は解析ルートが blobUrl を fetch し、finally で即削除する。
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        // 解析対象として受け付ける形式のみに限定
        allowedContentTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/webp",
        ],
        // URL 推測を防ぐ
        addRandomSuffix: true,
        maximumSizeInBytes: 50 * 1024 * 1024,
      }),
      // アップロード完了通知（解析後に削除するのでここでは何もしない）
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "アップロードに失敗しました" },
      { status: 400 }
    );
  }
}
