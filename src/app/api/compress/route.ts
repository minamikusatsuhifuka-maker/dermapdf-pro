import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface CompressRequest {
  base64: string;
  fileName: string;
  quality: number;
}

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
    let base64: string, fileName: string, quality: number;
    try {
      const arrayBuffer = await request.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      ({ base64, fileName, quality } = JSON.parse(text) as CompressRequest);
    } catch {
      return NextResponse.json(
        { success: false, error: "リクエストの解析に失敗しました" },
        { status: 200 }
      );
    }

    const apiKey = process.env.PDF_CO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "PDF.co APIキーが設定されていません" },
        { status: 200 }
      );
    }

    const originalSize = Math.round((base64.length * 3) / 4);

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

    const downloadRes = await fetch(resultUrl);
    const downloadBuffer = await downloadRes.arrayBuffer();
    const resultBase64 = Buffer.from(downloadBuffer).toString("base64");
    const compressedSize = downloadBuffer.byteLength;

    return NextResponse.json({
      success: true,
      base64: resultBase64,
      fileName: fileName.replace(/\.pdf$/i, "_compressed.pdf"),
      originalSize,
      compressedSize,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 }
    );
  }
}
