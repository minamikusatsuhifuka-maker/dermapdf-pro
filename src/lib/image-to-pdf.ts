// 画像（スクショ等）を1本のPDFに統合するユーティリティ。
// 多数・高解像度の画像でもハングしないよう、各画像を縮小＋JPEG圧縮してから埋め込む。
// 読み込みは onload/onerror 両対応・1枚失敗してもスキップして継続。
// 全体にハードタイムアウトを設け、無限待ちを防ぐ。

export interface MergeImagesResult {
  blob: Blob;
  base64: string; // AI分析用（data部のみ。data:プレフィックスは含まない）
  pageCount: number; // 実際にPDFへ収録できた枚数
  skipped: number; // 読み込み/変換失敗でスキップした枚数
}

export interface MergeImagesOptions {
  maxEdge?: number; // 長辺の上限(px)。既定1800
  quality?: number; // JPEG品質 0〜1。既定0.8
  timeoutMs?: number; // ハードタイムアウト(ms)。既定90秒
  onProgress?: (done: number, total: number) => void;
}

// blob URL / data URL から HTMLImageElement を読み込む。onerror も必ず処理する。
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = url;
  });
}

// 画像を長辺上限にリサイズし、白背景でJPEGに変換してバイト列を返す。
async function imageToJpegBytes(
  url: string,
  maxEdge: number,
  quality: number,
): Promise<Uint8Array> {
  const img = await loadImage(url);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("画像サイズを取得できません");

  const scale = Math.min(1, maxEdge / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D コンテキストを取得できません");

  // JPEGは透過非対応のため、白で塗りつぶしてから描画する。
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("JPEG変換に失敗しました");
  return new Uint8Array(await blob.arrayBuffer());
}

// 大きなバイト列でもスタックを溢れさせずにBase64化する。
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// PDFに統合せず、各画像を縮小＋JPEG圧縮して AI へ直接渡すための
// {base64, mime} 配列に変換する。選択順を保持し、1枚失敗してもスキップして継続。
export interface CompressedImagePart {
  base64: string; // data:プレフィックスを含まない純粋なBase64
  mime: string; // 常に "image/jpeg"
}

export async function compressImagesToParts(
  urls: string[],
  options: {
    maxEdge?: number;
    quality?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<{ parts: CompressedImagePart[]; skipped: number }> {
  const { maxEdge = 1800, quality = 0.8, onProgress } = options;
  const parts: CompressedImagePart[] = [];
  let skipped = 0;
  const total = urls.length;

  for (let i = 0; i < total; i++) {
    try {
      const bytes = await imageToJpegBytes(urls[i], maxEdge, quality);
      parts.push({ base64: uint8ToBase64(bytes), mime: "image/jpeg" });
    } catch {
      // 1枚失敗しても全体は止めない。
      skipped++;
    }
    onProgress?.(i + 1, total);
  }

  return { parts, skipped };
}

// 複数画像を1本のPDFへ統合する本体。タイムアウト付き。
export async function mergeImagesToPdf(
  urls: string[],
  options: MergeImagesOptions = {},
): Promise<MergeImagesResult> {
  const {
    maxEdge = 1800,
    quality = 0.8,
    timeoutMs = 90000,
    onProgress,
  } = options;

  const work = (async (): Promise<MergeImagesResult> => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    let skipped = 0;
    const total = urls.length;

    for (let i = 0; i < total; i++) {
      try {
        const bytes = await imageToJpegBytes(urls[i], maxEdge, quality);
        const jpg = await doc.embedJpg(bytes);
        const page = doc.addPage([jpg.width, jpg.height]);
        page.drawImage(jpg, {
          x: 0,
          y: 0,
          width: jpg.width,
          height: jpg.height,
        });
      } catch {
        // 1枚失敗しても全体は止めない（スキップして件数を報告）。
        skipped++;
      }
      onProgress?.(i + 1, total);
    }

    if (doc.getPageCount() === 0) {
      throw new Error("すべての画像の処理に失敗しました");
    }

    const out = await doc.save();
    // Uint8Array<ArrayBufferLike> をそのまま Blob に渡すと型が合わないため、
    // 該当区間の ArrayBuffer を切り出して渡す。
    const ab = out.buffer.slice(
      out.byteOffset,
      out.byteOffset + out.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([ab], { type: "application/pdf" });
    return {
      blob,
      base64: uint8ToBase64(out),
      pageCount: doc.getPageCount(),
      skipped,
    };
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`タイムアウト（${Math.round(timeoutMs / 1000)}秒）しました`),
        ),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
