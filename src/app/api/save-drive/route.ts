import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface SaveDriveRequest {
  base64: string;
  fileName: string;
  mime: string;
  folderId?: string;
}

export async function POST(request: Request) {
  try {
    const { base64, fileName, mime, folderId } =
      (await request.json()) as SaveDriveRequest;

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(
      /\\n/g,
      "\n"
    );

    if (!clientEmail || !privateKey) {
      return NextResponse.json(
        { success: false, error: "Google Drive認証情報が設定されていません" },
        { status: 200 }
      );
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    const buffer = Buffer.from(base64, "base64");
    const stream = Readable.from(buffer);

    const fileMetadata: { name: string; parents?: string[] } = {
      name: fileName,
    };
    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: mime,
        body: stream,
      },
      fields: "id, webViewLink, name",
    });

    const fileId = res.data.id;
    const fileUrl = res.data.webViewLink;

    return NextResponse.json({
      success: true,
      fileId,
      fileUrl,
      fileName: res.data.name,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 200 }
    );
  }
}
