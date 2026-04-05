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

const systemInstruction = '【重要な出力ルール】\n前置き・挨拶・「承知いたしました」などの導入文は一切出力しないでください。\n分析結果の本文のみを、見出し・箇条書き・Markdown形式で直接出力してください。\n\n';

/** 冒頭の定型文パターンを除去するクリーンアップ関数 */
function cleanAnalysisResult(text: string): string {
  const patterns = [
    /^(はい、?|承知いたしました。?|かしこまりました。?)[^\n]*\n+/,
    /^(以下のように|以下に|下記に)[^\n]*\n+/,
    /^ご依頼[^\n]*\n+/,
    /^ご指定[^\n]*\n+/,
    /^---+\n+/,
    /^```[^\n]*\n+/,
  ];

  let cleaned = text;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
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
                { text: systemInstruction + prompt },
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

    return { success: true, analysis: cleanAnalysisResult(analysis) };
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

/** テキストのみでGemini APIを呼び出す（ファイル不要）
 *  text を省略すると prompt のみで呼び出す（従来互換）
 */
export async function analyzeTextWithGemini(
  prompt: string,
  text?: string
): Promise<GeminiResult> {
  const basePrompt = text
    ? `以下のテキストを分析してください。\n\n【テキスト内容】\n${text}\n\n【分析指示】\n${prompt}`
    : prompt;
  const fullPrompt = systemInstruction + basePrompt;

  const callGemini = async (): Promise<GeminiResult> => {
    const apiKey = await getGeminiKey();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    let res: Response;
    try {
      res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
        }),
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("タイムアウトしました。再度お試しください。");
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
      return { success: false, analysis: "", error: responseData.error.message || "Gemini APIエラー" };
    }

    const analysis = responseData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { success: true, analysis: cleanAnalysisResult(analysis) };
  };

  try {
    const result = await callGemini();
    if (result.success) return result;
    return await callGemini();
  } catch (e) {
    return {
      success: false,
      analysis: "",
      error: e instanceof Error ? e.message : "レポート生成に失敗しました",
    };
  }
}
