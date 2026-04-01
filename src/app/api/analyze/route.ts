import { GoogleGenAI } from "@google/genai";

interface AnalyzeRequest {
  base64: string;
  mime: string;
  fileName: string;
  prompt: string;
}

const MAX_SIZE_BYTES = 18 * 1024 * 1024; // 18MB

export async function POST(request: Request) {
  try {
    const { base64, mime, fileName, prompt } =
      (await request.json()) as AnalyzeRequest;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Gemini APIキーが設定されていません" },
        { status: 500 }
      );
    }

    // サイズチェック
    const sizeBytes = Math.round((base64.length * 3) / 4);
    if (sizeBytes > MAX_SIZE_BYTES) {
      return Response.json(
        {
          error: `ファイルサイズが上限（18MB）を超えています: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB（${fileName}）`,
        },
        { status: 400 }
      );
    }

    const genai = new GoogleGenAI({ apiKey });

    const response = await genai.models.generateContent({
      model: "gemini-2.5-pro-preview-06-05",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mime,
                data: base64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        temperature: 0.3,
      },
    });

    const analysis = response.text ?? "";

    return Response.json({
      success: true,
      analysis,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI分析に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
