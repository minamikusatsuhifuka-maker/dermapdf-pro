import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface AnalyzeRequest {
  base64: string;
  mime: string;
  fileName: string;
  prompt: string;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const bodySize = new TextEncoder().encode(body).length;
    if (bodySize > MAX_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `リクエストサイズが上限（50MB）を超えています: ${(bodySize / 1024 / 1024).toFixed(1)}MB`,
        },
        { status: 200 }
      );
    }

    const { base64, mime, fileName, prompt } = JSON.parse(body) as AnalyzeRequest;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Gemini APIキーが設定されていません" },
        { status: 200 }
      );
    }

    const sizeBytes = Math.round((base64.length * 3) / 4);
    if (sizeBytes > 18 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: `ファイルサイズが上限（18MB）を超えています: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB（${fileName}）`,
        },
        { status: 200 }
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

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 200 }
    );
  }
}
