export async function GET() {
  try {
    const pdfCo = !!process.env.PDF_CO_API_KEY;
    const removeBg = !!process.env.REMOVE_BG_API_KEY;
    const gemini = !!process.env.GEMINI_API_KEY;

    return Response.json({ pdfCo, removeBg, gemini });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "APIキーの確認に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
