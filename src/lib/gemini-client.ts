/**
 * Gemini 呼び出しのクライアント側ラッパ。
 *
 * セキュリティ: APIキーはブラウザへ一切渡さない。全ての Gemini 呼び出しは
 * サーバルート（/api/gemini/*）経由で行い、キーはサーバの GEMINI_API_KEY のみが持つ。
 *
 * 送信方式（Vercel の 4.5MB リクエストボディ制限対策・ハイブリッド）:
 *  - テキスト: /api/gemini/analyze-text に直送
 *  - ファイル/画像: 生サイズ ≤3MB は inlineBase64 でJSON直送、
 *    3MB 超は Vercel Blob へクライアント直アップロードし blobUrl だけを送る
 *    （サーバは解析後に Blob を即削除する）。
 *
 * 応答の「thinking除く全textパート連結」はサーバ側（gemini-server.ts）へ移設・集約済み。
 * ここでは { success, analysis, error } を受け取るだけで、連結の重複実装は持たない。
 */

export const CURRENT_MODEL = "gemini-3.5-flash";

interface GeminiResult {
  success: boolean;
  analysis: string;
  error?: string;
}

// inlineBase64 でJSON直送する生サイズの上限（base64で約1.33倍に膨らむため 3MB→約4MB）。
const INLINE_LIMIT_BYTES = 3 * 1024 * 1024;

/** base64（data:プレフィックスなし）の生バイト数を概算する。 */
function base64Bytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

/** base64 を Blob 化する（Vercel Blob へのアップロード用）。 */
function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** アップロード先の拡張子（Blobの許可content-typeに合わせる）。 */
function extFor(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Vercel Blob へアップロードして URL を返す（サーバが解析後に即削除する）。 */
async function uploadToBlob(base64: string, mime: string): Promise<string> {
  const { upload } = await import("@vercel/blob/client");
  const file = base64ToBlob(base64, mime);
  const result = await upload(`dermapdf/upload.${extFor(mime)}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    contentType: mime,
  });
  return result.url;
}

/**
 * 3MB超のデータを Vercel Blob へアップロードして URL を返す。
 * 3MB以下なら null を返し、呼び出し側は inlineBase64 でJSON直送する。
 */
async function uploadIfLarge(
  base64: string,
  mime: string
): Promise<string | null> {
  if (base64Bytes(base64) <= INLINE_LIMIT_BYTES) return null;
  return uploadToBlob(base64, mime);
}

/** 解析ルートを叩いて結果を受け取る共通処理。 */
async function postJson(
  path: string,
  body: Record<string, unknown>
): Promise<GeminiResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as GeminiResult;
    return data;
  } catch (e) {
    return {
      success: false,
      analysis: "",
      error: e instanceof Error ? e.message : "AI分析に失敗しました",
    };
  }
}

export async function analyzeWithGemini(
  base64: string,
  mimeType: string,
  prompt: string,
  analysisType?: string,
  maxTokensOverride?: number
): Promise<GeminiResult> {
  try {
    const blobUrl = await uploadIfLarge(base64, mimeType);
    return await postJson("/api/gemini/analyze-file", {
      ...(blobUrl ? { blobUrl } : { inlineBase64: base64 }),
      mimeType,
      prompt,
      analysisType,
      maxOutputTokens: maxTokensOverride,
    });
  } catch (e) {
    return {
      success: false,
      analysis: "",
      error: e instanceof Error ? e.message : "AI分析に失敗しました",
    };
  }
}

/**
 * 複数画像をPDFに統合せず、画像パートとして直接 Gemini に渡して分析する。
 * 画像の圧縮はクライアント側（compressImagesToParts）のまま。
 */
export async function analyzeImagesWithGemini(
  images: { base64: string; mime: string }[],
  prompt: string,
  analysisType?: string,
  maxTokensOverride?: number
): Promise<GeminiResult> {
  if (images.length === 0) {
    return { success: false, analysis: "", error: "分析対象の画像がありません" };
  }
  try {
    // 1枚ずつは小さくても、複数枚をJSONに詰めると合計でボディ制限を超える。
    // 合計が閾値を超える場合は全枚を Blob へ上げ、blobUrl だけを送る。
    const total = images.reduce((s, img) => s + base64Bytes(img.base64), 0);
    const forceBlob = total > INLINE_LIMIT_BYTES;

    const items = await Promise.all(
      images.map(async (img) => {
        const blobUrl = forceBlob
          ? await uploadToBlob(img.base64, img.mime)
          : await uploadIfLarge(img.base64, img.mime);
        return blobUrl
          ? { blobUrl, mimeType: img.mime }
          : { inlineBase64: img.base64, mimeType: img.mime };
      })
    );
    return await postJson("/api/gemini/analyze-images", {
      items,
      prompt,
      analysisType,
      maxOutputTokens: maxTokensOverride,
    });
  } catch (e) {
    return {
      success: false,
      analysis: "",
      error: e instanceof Error ? e.message : "AI分析に失敗しました",
    };
  }
}

/** テキストのみでGeminiを呼び出す（ファイル不要）
 *  text を省略すると prompt のみで呼び出す（従来互換）
 *  thinkingMinimal: タイトル生成など推論不要の短出力用に thinking を最小化する
 *  （省略時は従来どおり既定thinking＝他の呼び出し元の挙動は不変）
 */
export async function analyzeTextWithGemini(
  prompt: string,
  text?: string,
  maxTokensOverride?: number,
  thinkingMinimal?: boolean
): Promise<GeminiResult> {
  return postJson("/api/gemini/analyze-text", {
    prompt,
    text,
    maxOutputTokens: maxTokensOverride,
    thinkingMinimal,
  });
}
