"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import MarkdownPrint from "@/components/ui/markdown-print";

// 生成済みcanvasを「行の隙間（背景色だけの横1行）」で分割する切れ目のy座標列を返す。
// 返り値は [0, cut1, cut2, ..., canvas.height]（各区間の高さは pageHeightPx 以下）。
// 背景色は決め打ちせずcanvas上部と左マージン列からサンプル推定する（白以外の背景でも動く）。
function findSafeCuts(canvas: HTMLCanvasElement, pageHeightPx: number): number[] {
  const cuts = [0];
  const height = canvas.height;
  const width = canvas.width;
  const step = Math.max(1, Math.floor(pageHeightPx));

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    // ピクセルを読めない環境ではハード切り（従来どおり）にフォールバック。
    for (let y = step; y < height; y += step) cuts.push(y);
    cuts.push(height);
    return cuts;
  }

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, width, height).data; // 全ピクセル取得は1回だけ
  } catch {
    for (let y = step; y < height; y += step) cuts.push(y);
    cuts.push(height);
    return cuts;
  }

  // --- 背景色の推定：最上部の数行と左マージン列をサンプルして平均する ---
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  const addSample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    sr += data[i];
    sg += data[i + 1];
    sb += data[i + 2];
    n++;
  };
  for (let y = 0; y < Math.min(5, height); y++) {
    for (let x = 0; x < width; x += 8) addSample(x, y);
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 50))) {
    addSample(1, y); // 左マージン列
  }
  const bg = n > 0 ? [sr / n, sg / n, sb / n] : [255, 255, 255];

  const TOLERANCE = 12; // 各チャンネルの許容差
  const SAMPLE_STEP = 4; // 横方向のサンプル間隔(px)
  const SAFE_MARGIN = 4; // 切れ目直前に残す安全余白(px)

  // その y の横1行がすべて背景色（±許容差）＝余白行か判定する。
  const isBackgroundRow = (y: number): boolean => {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      const i = (y * width + x) * 4;
      if (
        Math.abs(data[i] - bg[0]) > TOLERANCE ||
        Math.abs(data[i + 1] - bg[1]) > TOLERANCE ||
        Math.abs(data[i + 2] - bg[2]) > TOLERANCE
      ) {
        return false;
      }
    }
    return true;
  };

  // 探索窓（理想の切れ目から上方向へ何pxまで背景行を探すか）
  const WINDOW = Math.max(1, Math.floor(Math.min(pageHeightPx * 0.12, 160)));

  let y0 = 0;
  while (height - y0 > pageHeightPx) {
    const target = Math.floor(y0 + pageHeightPx);
    let cut = target; // 窓内に背景行が無ければハード切り（大きな表など・稀）
    const limit = Math.max(y0 + 1, target - WINDOW);
    for (let y = Math.min(target, height - 1); y >= limit; y--) {
      if (isBackgroundRow(y)) {
        // 行が下端ぎりぎりに来ないよう、切れ目の直前に安全余白を残す。
        cut = Math.max(y0 + 1, y - SAFE_MARGIN);
        break;
      }
    }
    cuts.push(cut);
    y0 = cut;
  }
  cuts.push(height);
  return cuts;
}

// 表示と同じMarkdownレンダリングでPDF化（全内容・適切な改ページ）。
// インラインHEXスタイルの自己完結要素を html2canvas-pro で画像化し、jsPDF で
// A4 複数ページに分割（コンテンツ高に応じてページ送り＝無駄な空白ページを出さない）。
export async function exportMarkdownAsPdf(opts: {
  title: string;
  metaLines: string[];
  markdown: string;
  fileName: string;
}): Promise<void> {
  const { title, metaLines, markdown, fileName } = opts;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // オフスクリーンの描画コンテナ（A4相当の横幅・余白・白背景）。
  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "left:-99999px",
    "top:0",
    "width:794px", // A4幅(96dpi)相当
    "box-sizing:border-box",
    "padding:40px",
    "background:#ffffff",
    "color:#1f2937",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Kaku Gothic ProN','Noto Sans JP',Meiryo,sans-serif",
    "font-size:14px",
    "line-height:1.8",
    "z-index:-1",
  ].join(";");
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    flushSync(() => {
      root.render(
        createElement(
          "div",
          null,
          // ヘッダ（タイトル・メタ情報）
          createElement(
            "div",
            {
              style: {
                borderBottom: "2px solid #B5D4F4",
                paddingBottom: "10px",
                marginBottom: "16px",
              },
            },
            createElement(
              "div",
              {
                style: {
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#185FA5",
                },
              },
              title
            ),
            ...metaLines.map((line, i) =>
              createElement(
                "div",
                {
                  key: `meta-${i}`,
                  style: { fontSize: "12px", color: "#64748b", marginTop: "2px" },
                },
                line
              )
            )
          ),
          // 本文（表示と同じMarkdownレンダリング）
          createElement(MarkdownPrint, { children: markdown })
        )
      );
    });

    // レイアウト確定後に画像化（高解像度）。
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;

    // 安全改ページ：固定のページ高で機械的に切ると境界の行が上下に割れるため、
    // 「行と行の隙間＝背景色だけの横1行」を探してそこで切り、帯ごとに切り出して貼る。
    const cuts = findSafeCuts(canvas, (pageH * canvas.width) / imgW);

    const slice = document.createElement("canvas");
    const sliceCtx = slice.getContext("2d");

    for (let i = 0; i < cuts.length - 1; i++) {
      const y0 = cuts[i];
      const y1 = cuts[i + 1];
      const h = y1 - y0;
      if (h <= 0) continue;

      if (i > 0) pdf.addPage();

      // 帯を一時canvasへ切り出して個別に貼る（各帯は必ず1ページ内に収まる）。
      slice.width = canvas.width;
      slice.height = h;
      if (!sliceCtx) {
        // 2Dコンテキストが取れない環境では従来どおり全体画像をずらして貼る。
        const imgH = (canvas.height * imgW) / canvas.width;
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.92),
          "JPEG",
          0,
          -((y0 * imgW) / canvas.width),
          imgW,
          imgH
        );
        continue;
      }
      sliceCtx.clearRect(0, 0, slice.width, slice.height);
      sliceCtx.drawImage(canvas, 0, y0, canvas.width, h, 0, 0, canvas.width, h);

      pdf.addImage(
        slice.toDataURL("image/png"),
        "PNG",
        0,
        0,
        imgW,
        (h * imgW) / canvas.width
      );
    }

    pdf.save(fileName);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
