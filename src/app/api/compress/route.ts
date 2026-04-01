interface CompressRequest {
  base64: string;
  fileName: string;
  quality: number;
}

// 非同期ジョブのポーリング
async function waitForAsyncJob(
  jobId: string,
  apiKey: string
): Promise<string> {
  const maxAttempts = 60;
  const interval = 3000;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `https://api.pdf.co/v1/job/check?jobid=${jobId}`,
      { headers: { "x-api-key": apiKey } }
    );
    const data = (await res.json()) as {
      status: string;
      url?: string;
      message?: string;
    };

    if (data.status === "success" && data.url) {
      return data.url;
    }
    if (data.status === "error") {
      throw new Error(data.message || "ジョブがエラーで終了しました");
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error("ジョブがタイムアウトしました");
}

export async function POST(request: Request) {
  try {
    const { base64, fileName, quality } =
      (await request.json()) as CompressRequest;

    const apiKey = process.env.PDF_CO_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "PDF.co APIキーが設定されていません" },
        { status: 500 }
      );
    }

    const originalSize = Math.round((base64.length * 3) / 4);

    // v2/pdf/compress を試行
    let resultUrl: string | null = null;

    try {
      const compressRes = await fetch(
        "https://api.pdf.co/v2/pdf/compress",
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file: `data:application/pdf;base64,${base64}`,
            name: fileName,
            quality: quality || 65,
          }),
        }
      );

      const compressData = (await compressRes.json()) as {
        error?: boolean;
        jobId?: string;
        url?: string;
        message?: string;
      };

      if (!compressData.error && compressData.jobId) {
        resultUrl = await waitForAsyncJob(compressData.jobId, apiKey);
      } else if (!compressData.error && compressData.url) {
        resultUrl = compressData.url;
      }
    } catch {
      // v2が失敗した場合、v1にフォールバック
    }

    // v1/pdf/optimize フォールバック
    if (!resultUrl) {
      const optimizeRes = await fetch(
        "https://api.pdf.co/v1/pdf/optimize",
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file: `data:application/pdf;base64,${base64}`,
            name: fileName,
            async: true,
          }),
        }
      );

      const optimizeData = (await optimizeRes.json()) as {
        error?: boolean;
        jobId?: string;
        url?: string;
        message?: string;
      };

      if (optimizeData.error) {
        throw new Error(
          optimizeData.message || "PDF圧縮に失敗しました"
        );
      }

      if (optimizeData.jobId) {
        resultUrl = await waitForAsyncJob(optimizeData.jobId, apiKey);
      } else if (optimizeData.url) {
        resultUrl = optimizeData.url;
      }
    }

    if (!resultUrl) {
      throw new Error("圧縮結果のURLを取得できませんでした");
    }

    // 結果をダウンロードしてbase64に変換
    const downloadRes = await fetch(resultUrl);
    const arrayBuffer = await downloadRes.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBuffer).toString("base64");
    const compressedSize = arrayBuffer.byteLength;

    return Response.json({
      success: true,
      base64: resultBase64,
      fileName: fileName.replace(/\.pdf$/i, "_compressed.pdf"),
      originalSize,
      compressedSize,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF圧縮に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
