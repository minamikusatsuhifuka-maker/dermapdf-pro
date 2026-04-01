import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface ExtractRequest {
  base64: string;
  fileName: string;
  pageRange: string;
}

export async function POST(request: Request) {
  try {
    const { base64, fileName, pageRange } =
      (await request.json()) as ExtractRequest;

    const apiKey = process.env.PDF_CO_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "PDF.co APIキーが設定されていません" },
        { status: 200 }
      );
    }

    const splitRes = await fetch("https://api.pdf.co/v1/pdf/split", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: `data:application/pdf;base64,${base64}`,
        pages: pageRange,
        name: fileName,
        async: true,
      }),
    });

    const splitData = (await splitRes.json()) as {
      error?: boolean;
      jobId?: string;
      url?: string | string[];
      message?: string;
    };

    if (splitData.error) {
      throw new Error(splitData.message || "ページ抽出に失敗しました");
    }

    let resultUrl: string;
    if (splitData.jobId) {
      resultUrl = await waitForJob(splitData.jobId, apiKey);
    } else if (splitData.url) {
      resultUrl = Array.isArray(splitData.url)
        ? splitData.url[0]
        : splitData.url;
    } else {
      throw new Error("抽出結果のURLを取得できませんでした");
    }

    const downloadRes = await fetch(resultUrl);
    const arrayBuffer = await downloadRes.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBuffer).toString("base64");

    return NextResponse.json({
      success: true,
      base64: resultBase64,
      fileName: fileName.replace(/\.pdf$/i, `_pages_${pageRange}.pdf`),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 200 }
    );
  }
}

async function waitForJob(jobId: string, apiKey: string): Promise<string> {
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
