import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pdfCo = !!process.env.PDF_CO_API_KEY;
    const removeBg = !!process.env.REMOVE_BG_API_KEY;
    const gemini = !!process.env.GEMINI_API_KEY;

    return NextResponse.json({ pdfCo, removeBg, gemini });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 200 }
    );
  }
}
