import { google } from "googleapis";
import { Readable } from "stream";

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
      return Response.json(
        { error: "Google Drive認証情報が設定されていません" },
        { status: 500 }
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

    return Response.json({
      success: true,
      fileId,
      fileUrl,
      fileName: res.data.name,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Google Driveへの保存に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
