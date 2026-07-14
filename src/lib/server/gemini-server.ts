/**
 * サーバ専用の Gemini 呼び出しヘルパ（GEMINI_API_KEY を扱う唯一の場所）。
 * クライアントへキーを渡さないため、Gemini API はこのモジュール経由でのみ叩く。
 *
 * 応答抽出（最重要）: 複数パート応答では thinking パートを除く全 text パートを連結する。
 * 3経路（text / file / images）で同一実装を使うため、ここに1箇所集約する。
 */

// クライアント側 gemini-client.ts の CURRENT_MODEL と同値（モデル指定は変更しない）。
export const SERVER_MODEL = "gemini-3.5-flash";

const systemInstruction =
  "【重要な出力ルール】\n前置き・挨拶・「承知いたしました」などの導入文は一切出力しないでください。\n分析結果の本文のみを、見出し・箇条書き・Markdown形式で直接出力してください。\n\n";

/** 冒頭の定型文パターンを除去するクリーンアップ関数（クライアント版と同一挙動） */
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
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim();
}

export interface GeminiServerResult {
  success: boolean;
  analysis: string;
  error?: string;
}

export interface InlinePart {
  base64: string;
  mime: string;
}

/**
 * Gemini を1回呼び出して「thinking を除く全 text パートを連結した本文」を返す。
 * inlineParts が空ならテキストのみのリクエストになる。
 */
export async function callGemini(opts: {
  prompt: string;
  inlineParts?: InlinePart[];
  thinkingMinimal?: boolean;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  model?: string;
}): Promise<GeminiServerResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      analysis: "",
      error: "Gemini APIキーが設定されていません",
    };
  }

  const model = opts.model || SERVER_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const parts = [
    ...(opts.inlineParts ?? []).map((p) => ({
      inline_data: { mime_type: p.mime, data: p.base64 },
    })),
    { text: systemInstruction + opts.prompt },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${url}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: opts.temperature,
          maxOutputTokens: opts.maxOutputTokens,
          ...(opts.thinkingMinimal
            ? { thinkingConfig: { thinkingLevel: "minimal" } }
            : {}),
        },
      }),
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        analysis: "",
        error: "タイムアウトしました。分量を減らすか、再度お試しください。",
      };
    }
    return {
      success: false,
      analysis: "",
      error: err instanceof Error ? err.message : "AI分析に失敗しました",
    };
  }

  let responseData: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
    error?: { message?: string };
  };

  try {
    const text = await res.text();
    responseData = JSON.parse(text);
  } catch {
    return {
      success: false,
      analysis: "",
      error: "Gemini APIのレスポンス解析に失敗しました",
    };
  }

  if (responseData.error) {
    return {
      success: false,
      analysis: "",
      error: responseData.error.message || "Gemini APIエラー",
    };
  }

  // 応答が複数パートに分割されても先頭1パートだけ拾わないよう、
  // thinkingパートを除く全textパートを連結する（3経路で共通）。
  const analysis = (responseData.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");

  return { success: true, analysis: cleanAnalysisResult(analysis) };
}

/** 失敗時に1回だけリトライして呼ぶ（クライアント版の従来挙動と同じ）。 */
export async function callGeminiWithRetry(
  opts: Parameters<typeof callGemini>[0]
): Promise<GeminiServerResult> {
  const result = await callGemini(opts);
  if (result.success) return result;
  return callGemini(opts);
}

/**
 * Blob URL（または inlineBase64）から解析用の base64 を解決する。
 * blobUrl はサーバ側でのみ fetch する（クライアントにキーを出さないため）。
 */
export async function resolveBase64(part: {
  blobUrl?: string;
  inlineBase64?: string;
}): Promise<string> {
  if (part.inlineBase64) return part.inlineBase64;
  if (!part.blobUrl) throw new Error("解析対象データがありません");
  const res = await fetch(part.blobUrl);
  if (!res.ok) throw new Error("アップロード済みファイルの取得に失敗しました");
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}
