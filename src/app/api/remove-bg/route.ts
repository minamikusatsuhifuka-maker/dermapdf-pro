interface RemoveBgRequest {
  base64: string;
  mime: string;
  fileName: string;
}

// HEIC画像をPNGに変換（PDF.co経由）
async function convertHeicToPng(
  base64: string,
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.pdf.co/v1/file/convert", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: `data:image/heic;base64,${base64}`,
      outputFormat: "png",
      async: false,
    }),
  });

  const data = (await res.json()) as {
    error?: boolean;
    url?: string;
    message?: string;
  };

  if (data.error || !data.url) {
    throw new Error(data.message || "HEIC→PNG変換に失敗しました");
  }

  // 変換結果をダウンロードしてbase64に変換
  const downloadRes = await fetch(data.url);
  const arrayBuffer = await downloadRes.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

export async function POST(request: Request) {
  try {
    const { base64, mime, fileName } =
      (await request.json()) as RemoveBgRequest;

    const removeBgKey = process.env.REMOVE_BG_API_KEY;
    if (!removeBgKey) {
      return Response.json(
        { error: "remove.bg APIキーが設定されていません" },
        { status: 500 }
      );
    }

    let imageBase64 = base64;
    let imageMime = mime;

    // HEIC画像の場合はPNGに変換
    if (mime.includes("heic") || mime.includes("heif")) {
      const pdfCoKey = process.env.PDF_CO_API_KEY;
      if (!pdfCoKey) {
        return Response.json(
          { error: "HEIC変換にはPDF.co APIキーが必要です" },
          { status: 500 }
        );
      }
      imageBase64 = await convertHeicToPng(base64, pdfCoKey);
      imageMime = "image/png";
    }

    // remove.bg API呼び出し
    const formData = new FormData();
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const blob = new Blob([imageBuffer], { type: imageMime });
    formData.append("image_file", blob, fileName);
    formData.append("size", "auto");

    const removeBgRes = await fetch(
      "https://api.remove.bg/v1.0/removebg",
      {
        method: "POST",
        headers: {
          "X-Api-Key": removeBgKey,
        },
        body: formData,
      }
    );

    if (!removeBgRes.ok) {
      const errorData = (await removeBgRes.json().catch(() => null)) as {
        errors?: Array<{ title?: string }>;
      } | null;
      const errorMsg =
        errorData?.errors?.[0]?.title || "背景除去に失敗しました";
      throw new Error(errorMsg);
    }

    const resultBuffer = await removeBgRes.arrayBuffer();
    const resultBase64 = Buffer.from(resultBuffer).toString("base64");
    const dataUrl = `data:image/png;base64,${resultBase64}`;

    const outputFileName = fileName.replace(
      /\.[^.]+$/,
      "_nobg.png"
    );

    return Response.json({
      success: true,
      dataUrl,
      base64: resultBase64,
      fileName: outputFileName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "背景除去に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
