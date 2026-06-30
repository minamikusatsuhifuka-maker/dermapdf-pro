"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import MarkdownPrint from "@/components/ui/markdown-print";

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
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    // 1枚の縦長画像をページ高で分割して全内容を載せる（空白ページを出さない）。
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    pdf.save(fileName);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
