import { NextResponse } from "next/server";
import { callGeminiWithRetry } from "@/lib/server/gemini-server";

// Gemini 呼び出しは Node runtime 必須（edge は既知の失敗事象あり）。
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// テキストのみの解析（タイトル生成・校正検出・テキストモード分析などが利用）。
// クライアントは prompt / text を送るだけで、APIキーはサーバから出ない。
export async function POST(request: Request) {
  try {
    const { prompt, text, maxOutputTokens, thinkingMinimal } =
      (await request.json()) as {
        prompt?: string;
        text?: string;
        maxOutputTokens?: number;
        thinkingMinimal?: boolean;
      };

    if (!prompt) {
      return NextResponse.json(
        { success: false, analysis: "", error: "プロンプトがありません" },
        { status: 200 }
      );
    }

    // text 省略時は prompt のみ（従来の analyzeTextWithGemini と同じ組み立て）。
    const basePrompt = text
      ? `以下のテキストを分析してください。\n\n【テキスト内容】\n${text}\n\n【分析指示】\n${prompt}`
      : prompt;

    const result = await callGeminiWithRetry({
      prompt: basePrompt,
      thinkingMinimal,
      maxOutputTokens: maxOutputTokens ?? 16384,
      temperature: 0.3,
      timeoutMs: 120000,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        analysis: "",
        error: e instanceof Error ? e.message : "レポート生成に失敗しました",
      },
      { status: 200 }
    );
  }
}
