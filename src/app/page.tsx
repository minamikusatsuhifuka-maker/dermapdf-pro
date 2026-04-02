"use client";

import { useCallback, useEffect, useState } from "react";
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
import { AnalysisStockPanel } from "@/components/stock/analysis-stock-panel";
import { TemplatePanel } from "@/components/templates/template-panel";
import { MonthlyReportPanel } from "@/components/reports/monthly-report-panel";
import { StaffPanel } from "@/components/staff/staff-panel";
import { loadAllAnalyses } from "@/lib/analysis-storage";
import { loadTemplates, initDefaultTemplates } from "@/lib/template-storage";
import { loadStaffProfiles } from "@/lib/staff-storage";
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

  const [stockCount, setStockCount] = useState(0);
  const [templateCount, setTemplateCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);

  const { settings, save: saveSettings, context: clinicContext } =
    useClinicSettings();

  // ストック件数の更新
  const refreshStockCount = useCallback(() => {
    setStockCount(loadAllAnalyses().length);
  }, []);

  const refreshTemplateCount = useCallback(() => {
    setTemplateCount(loadTemplates().length);
  }, []);

  const refreshStaffCount = useCallback(() => {
    setStaffCount(loadStaffProfiles().length);
  }, []);

  useEffect(() => {
    initDefaultTemplates();
    refreshStockCount();
    refreshTemplateCount();
    refreshStaffCount();
    window.addEventListener("storage", refreshStockCount);
    window.addEventListener("analysisStockUpdated", refreshStockCount);
    window.addEventListener("templatesUpdated", refreshTemplateCount);
    window.addEventListener("storage", refreshTemplateCount);
    window.addEventListener("staffUpdated", refreshStaffCount);
    window.addEventListener("storage", refreshStaffCount);
    return () => {
      window.removeEventListener("storage", refreshStockCount);
      window.removeEventListener("analysisStockUpdated", refreshStockCount);
      window.removeEventListener("templatesUpdated", refreshTemplateCount);
      window.removeEventListener("storage", refreshTemplateCount);
      window.removeEventListener("staffUpdated", refreshStaffCount);
      window.removeEventListener("storage", refreshStaffCount);
    };
  }, [refreshStockCount, refreshTemplateCount, refreshStaffCount]);

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
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <QuickActions onAction={handleQuickAction} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                document
                  .getElementById("staff-panel")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
            >
              スタッフカルテ ({staffCount}人) ↓
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("report-panel")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
            >
              📊 レポート生成 ↓
            </button>
            {templateCount > 0 && (
              <button
                onClick={() =>
                  document
                    .getElementById("template-panel")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              >
                テンプレート ({templateCount}件) ↓
              </button>
            )}
            {stockCount > 0 && (
              <button
                onClick={() =>
                  document
                    .getElementById("analysis-stock")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
              >
                保存済み分析 ({stockCount}件) ↓
              </button>
            )}
          </div>
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
        <div className="w-full space-y-8">
          {(activePanel === "gemini" || activePanel === null) && (
            <section className="w-full">
              <GeminiPanel
                fileBase64={fileBase64}
                fileMime={fileMime}
                fileName={fileName}
                onResult={(r) => setAnalysisResult(r)}
                clinicSettings={settings}
              />
            </section>
          )}

          {activePanel === "genspark" && (
            <section className="w-full">
              <GensparkPanel analysisResult={analysisResult} />
            </section>
          )}

          {activePanel === "message" && (
            <section className="w-full">
              <MessagePanel
                fileBase64={fileBase64}
                fileMime={fileMime}
                fileName={fileName}
                clinicContext={clinicContext}
              />
            </section>
          )}
        </div>

        {/* テンプレートパネル */}
        <section id="template-panel">
          <TemplatePanel />
        </section>

        {/* レポートパネル */}
        <section>
          <MonthlyReportPanel clinicSettings={settings} />
        </section>

        {/* ストックパネル */}
        <section>
          <AnalysisStockPanel />
        </section>

        {/* スタッフカルテ */}
        <section>
          <StaffPanel clinicSettings={settings} />
        </section>
      </main>
    </div>
  );
}
