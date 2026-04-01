"use client";

import { useCallback, useState } from "react";
import { Header } from "@/components/layout/header";
import { UploadZone } from "@/components/upload/upload-zone";
import { PageGrid } from "@/components/pdf/page-grid";
import { ImageGrid } from "@/components/image/image-grid";
import { ProgressBar } from "@/components/progress/progress-bar";
import { QuickActions } from "@/components/actions/quick-actions";
import { PdfActions } from "@/components/actions/pdf-actions";
import { GeminiPanel } from "@/components/ai/gemini-panel";
import type { AnalysisType } from "@/components/ai/gemini-panel";
import { GensparkPanel } from "@/components/ai/genspark-panel";
import { MessagePanel } from "@/components/ai/message-panel";
import { WorkflowPanel } from "@/components/workflow/workflow-panel";
import {
  SettingsModal,
  PhilosophyBanner,
  useClinicSettings,
} from "@/components/settings/settings-modal";
import { toastOk, toastInfo } from "@/components/ui/toast-provider";

type ActivePanel = "gemini" | "genspark" | "message" | null;

export default function Home() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [images, setImages] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [analysisResult, setAnalysisResult] = useState("");

  // ファイルのBase64データ（AI分析用）
  const [fileBase64, setFileBase64] = useState<string | undefined>();
  const [fileMime, setFileMime] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();

  const { settings, save: saveSettings, context: clinicContext } =
    useClinicSettings();

  const handleFiles = useCallback(async (files: File[]) => {
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

    // 最初のファイルをAI分析用にBase64変換
    const target = files[0];
    if (target) {
      const buffer = await target.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      setFileBase64(base64);
      setFileMime(target.type);
      setFileName(target.name);
    }

    toastOk(`${files.length} 件のファイルを読み込みました`);
  }, []);

  const handleQuickAction = useCallback((actionId: string) => {
    switch (actionId) {
      case "gemini":
        setActivePanel("gemini");
        break;
      case "presentation":
        setActivePanel("genspark");
        break;
      case "message":
        setActivePanel("message");
        break;
      case "compress":
      case "resize":
      case "crop":
      case "remove-bg":
        toastInfo(`${actionId} 機能を実行します`);
        break;
    }
  }, []);

  const handleWorkflowAnalysisType = useCallback((type: AnalysisType) => {
    setActivePanel("gemini");
    toastInfo(`分析タイプ「${type}」をセットしました`);
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <Header apiStatus={{ pdfCo: true, removeBg: true, gemini: true }} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 pb-12">
        {/* 設定バー */}
        <div className="flex items-center justify-between gap-4">
          <PhilosophyBanner settings={settings} />
          <SettingsModal settings={settings} onSave={saveSettings} />
        </div>

        {/* アップロード */}
        <section>
          <UploadZone onFilesSelected={handleFiles} />
        </section>

        {/* クイックアクション */}
        <section>
          <QuickActions onAction={handleQuickAction} />
        </section>

        {/* プログレス */}
        {progress !== null && (
          <section>
            <ProgressBar label="処理中..." percent={progress} />
          </section>
        )}

        {/* PDFページ一覧 + PDFアクション */}
        {pdfUrl && (
          <>
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

            <section>
              <PdfActions
                onCompress={(q) => toastInfo(`品質「${q}」で圧縮します`)}
                onResize={(s) => toastInfo(`${s}にリサイズします`)}
                onGemini={() => setActivePanel("gemini")}
                onPresentation={() => setActivePanel("genspark")}
                onMessage={() => setActivePanel("message")}
              />
            </section>
          </>
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

        {/* ワークフロー */}
        <section>
          <WorkflowPanel onSelectAnalysisType={handleWorkflowAnalysisType} />
        </section>

        {/* AIパネル */}
        <div className="grid gap-8 lg:grid-cols-2">
          {(activePanel === "gemini" || activePanel === null) && (
            <section>
              <GeminiPanel
                fileBase64={fileBase64}
                fileMime={fileMime}
                fileName={fileName}
                onResult={(r) => setAnalysisResult(r)}
              />
            </section>
          )}

          {activePanel === "genspark" && (
            <section>
              <GensparkPanel analysisResult={analysisResult} />
            </section>
          )}

          {activePanel === "message" && (
            <section>
              <MessagePanel
                fileBase64={fileBase64}
                fileMime={fileMime}
                fileName={fileName}
                clinicContext={clinicContext}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
