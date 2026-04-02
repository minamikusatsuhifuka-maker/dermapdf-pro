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
  prompt: string,
  analysisType?: string
): Promise<GeminiResult> {
  const isTranscription = analysisType === "transcription";
  const maxOutputTokens = isTranscription ? 65536 : 8192;
  const temperature = isTranscription ? 0.1 : 0.3;

  const callGemini = async (): Promise<GeminiResult> => {
    const apiKey = await getGeminiKey();

    const controller = new AbortController();
    const timeoutMs = isTranscription ? 180000 : 120000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
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
            temperature,
            maxOutputTokens,
          },
        }),
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("タイムアウトしました。PDFのページ数を減らすか、再度お試しください。");
      }
      throw err;
    }

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
  };

  try {
    const result = await callGemini();
    if (result.success) return result;

    // 失敗時に1回リトライ
    return await callGemini();
  } catch (e) {
    return {
      success: false,
      analysis: "",
      error: e instanceof Error ? e.message : "AI分析に失敗しました",
    };
  }
}
