/**
 * ブラウザから直接 Gemini API を呼ぶクライアント
 * Vercel の 4.5MB リクエストボディ制限を回避するため、
 * サーバーを経由せずクライアントから直接呼び出す
 */

export const CURRENT_MODEL = "gemini-2.5-pro";
const GEMINI_MODEL = CURRENT_MODEL;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiResult {
  success: boolean;
  analysis: string;
  error?: string;
}

let cachedKey: string | null = null;

async function getGeminiKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  const res = await fetch("/api/get-gemini-key");
  let data: { key?: string };
  try {
    const text = await res.text();
    data = JSON.parse(text);
  } catch {
    throw new Error("Gemini APIキーの取得に失敗しました");
  }

  if (!data.key) {
    throw new Error("Gemini APIキーが設定されていません");
  }

  cachedKey = data.key;
  return cachedKey;
}

export async function analyzeWithGemini(
  base64: string,
  mimeType: string,
  prompt: string
): Promise<GeminiResult> {
  try {
    const apiKey = await getGeminiKey();

    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      }),
    });

    let responseData: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      error?: { message?: string };
    };

    try {
      const text = await res.text();
      responseData = JSON.parse(text);
    } catch {
      return { success: false, analysis: "", error: "Gemini APIのレスポンス解析に失敗しました" };
    }

    if (responseData.error) {
      return {
        success: false,
        analysis: "",
        error: responseData.error.message || "Gemini APIエラー",
      };
    }

    const analysis =
      responseData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return { success: true, analysis };
  } catch (e) {
    return {
      success: false,
      analysis: "",
      error: e instanceof Error ? e.message : "AI分析に失敗しました",
    };
  }
}
