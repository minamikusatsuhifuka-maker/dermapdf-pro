"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { UploadZone } from "@/components/upload/upload-zone";
import { PageGrid } from "@/components/pdf/page-grid";
import { ImageGrid } from "@/components/image/image-grid";
import { ProgressBar } from "@/components/progress/progress-bar";
import { ResultCard } from "@/components/result/result-card";
import { toastOk, toastInfo } from "@/components/ui/toast-provider";

export default function Home() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [images, setImages] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [progress, setProgress] = useState<number | null>(null);

  const handleFiles = (files: File[]) => {
    const pdf = files.find((f) => f.type === "application/pdf");
    if (pdf) {
      setPdfUrl(URL.createObjectURL(pdf));
    }

    const imgs = files
      .filter((f) => f.type !== "application/pdf")
      .map((f, i) => ({
        id: `img-${i}-${Date.now()}`,
        name: f.name,
        url: URL.createObjectURL(f),
      }));
    if (imgs.length > 0) setImages(imgs);

    toastOk(`${files.length} 件のファイルを読み込みました`);
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header apiStatus={{ pdfCo: true, removeBg: true, gemini: true }} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 pb-12">
        {/* アップロード */}
        <section>
          <UploadZone onFilesSelected={handleFiles} />
        </section>

        {/* プログレス */}
        {progress !== null && (
          <section>
            <ProgressBar label="処理中..." percent={progress} />
          </section>
        )}

        {/* PDFページ一覧 */}
        {pdfUrl && (
          <section className="rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-bold text-gray-700">
              PDFページ
            </h2>
            <PageGrid
              pdfUrl={pdfUrl}
              onExtract={(pages) =>
                toastInfo(`ページ ${pages.join(", ")} を抽出します`)
              }
              onCrop={(pages) =>
                toastInfo(`ページ ${pages.join(", ")} をトリミングします`)
              }
            />
          </section>
        )}

        {/* 画像一覧 */}
        {images.length > 0 && (
          <section className="rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-bold text-gray-700">
              画像ファイル
            </h2>
            <ImageGrid
              images={images}
              onRemoveBg={(ids) =>
                toastInfo(`${ids.length} 枚の背景除去を開始します`)
              }
              onMergePdf={(ids) =>
                toastInfo(`${ids.length} 枚をPDFに統合します`)
              }
              onMergePdfAndAnalyze={(ids) =>
                toastInfo(`${ids.length} 枚をPDF統合してAI分析します`)
              }
            />
          </section>
        )}
      </main>
    </div>
  );
}
