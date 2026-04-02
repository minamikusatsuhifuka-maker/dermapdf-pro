import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface ResizeRequest {
  base64: string;
  fileName: string;
  pageSize: "A4" | "A5" | "B5" | "Letter";
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
    let body: ResizeRequest;
    try {
      const arrayBuffer = await request.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      body = JSON.parse(text) as ResizeRequest;
    } catch {
      return NextResponse.json(
        { success: false, error: "リクエストの解析に失敗しました" },
        { status: 200 }
      );
    }

    const { base64, fileName, pageSize } = body;

    const apiKey = process.env.PDF_CO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "PDF.co APIキーが設定されていません" },
        { status: 200 }
      );
    }

    const resizeRes = await fetch(
      "https://api.pdf.co/v1/pdf/convert/to/pdf",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: `data:application/pdf;base64,${base64}`,
          name: fileName,
          paperSize: pageSize,
          async: true,
        }),
      }
    );

    let resizeData: {
      error?: boolean;
      jobId?: string;
      url?: string;
      message?: string;
    };
    try {
      resizeData = await resizeRes.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "PDF.co APIのレスポンス解析に失敗しました" },
        { status: 200 }
      );
    }

    if (resizeData.error) {
      return NextResponse.json(
        { success: false, error: resizeData.message || "リサイズに失敗しました" },
        { status: 200 }
      );
    }

    let resultUrl: string;
    if (resizeData.jobId) {
      resultUrl = await waitForAsyncJob(resizeData.jobId, apiKey);
    } else if (resizeData.url) {
      resultUrl = resizeData.url;
    } else {
      return NextResponse.json(
        { success: false, error: "リサイズ結果のURLを取得できませんでした" },
        { status: 200 }
      );
    }

    const downloadRes = await fetch(resultUrl);
    const downloadBuffer = await downloadRes.arrayBuffer();
    const resultBase64 = Buffer.from(downloadBuffer).toString("base64");

    return NextResponse.json({
      success: true,
      base64: resultBase64,
      fileName: fileName.replace(/\.pdf$/i, `_${pageSize}.pdf`),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 200 }
    );
  }
}
