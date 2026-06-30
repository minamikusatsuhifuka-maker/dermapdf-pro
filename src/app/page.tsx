"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/header";
import { UploadZone } from "@/components/upload/upload-zone";
import { useAppStore } from "@/store/app-store";
import { PageGrid } from "@/components/pdf/page-grid";
import { ImageGrid } from "@/components/image/image-grid";
import { ProgressBar } from "@/components/progress/progress-bar";
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
import { loadFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";
import {
  SettingsModal,
  PhilosophyBanner,
  useClinicSettings,
} from "@/components/settings/settings-modal";
import { toastOk, toastInfo, toastError } from "@/components/ui/toast-provider";
import { mergeImagesToPdf, compressImagesToParts } from "@/lib/image-to-pdf";
import { mergePdfs } from "@/lib/pdf-splitter";

// ファイル（PDF）を AI 分析用の純粋なBase64（data:プレフィックスなし）へ変換。
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return btoa(
    new Uint8Array(buffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );
}

type ActivePanel =
  | "gemini"
  | "genspark"
  | "message"
  | "pdf"
  | "workflow"
  | null;

// 上部のコンパクトな機能切替ボタン（アコーディオン）。Gemini AI分析を主役に。
const PANEL_BUTTONS: {
  id: Exclude<ActivePanel, null>;
  label: string;
  primary?: boolean;
}[] = [
  { id: "gemini", label: "🧠 Gemini AI分析", primary: true },
  { id: "genspark", label: "🖥 プレゼン生成" },
  { id: "message", label: "💬 メッセージ生成" },
  { id: "pdf", label: "📄 PDFアクション" },
  { id: "workflow", label: "🗂 ワークフロー" },
];

export default function Home() {
  // 表示用PDF（ファイルごとのセクション）。各エントリは安定したidとobject URLを持ち、
  // 1件削除しても他ファイルのサムネイルを再描画しない（重い再統合・再描画を避ける）。
  const [pdfDocs, setPdfDocs] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [images, setImages] = useState<
    { id: string; name: string; url: string }[]
  >([]);

  // 遅延統合用: File参照ごとの { id, url } キャッシュ（削除時にURLを使い回し再描画を防ぐ）。
  const pdfUrlMapRef = useRef<Map<File, { id: string; url: string }>>(new Map());
  // 現在読み込み中のPDF File配列（解析直前に最新セットで統合するため保持）。
  const pdfSourceFilesRef = useRef<File[]>([]);
  // fileBase64 が最新の統合PDFを反映していない（要再統合）かどうか。
  const pdfMergeDirtyRef = useRef(false);
  // 表示用PDFエントリの安定したid採番。
  const pdfIdCounterRef = useRef(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("gemini");
  const [analysisResult, setAnalysisResult] = useState("");

  // ファイルのBase64データ（AI分析用）
  const [fileBase64, setFileBase64] = useState<string | undefined>();
  const [fileMime, setFileMime] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();

  // 「画像のままAI分析」用：PDFに統合せず直接AIへ渡す画像群（あれば優先）
  const [imageParts, setImageParts] = useState<
    { base64: string; mime: string }[]
  >([]);

  const [stockCount, setStockCount] = useState(0);
  const [templateCount, setTemplateCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [flags, setFlags] = useState<FeatureFlags>({ staffKarute: true, monthlyReport: true, templatePanel: true });

  // テキスト入力モード
  const inputMode = useAppStore((s) => s.inputMode);
  const inputText = useAppStore((s) => s.inputText);
  const inputTextFileName = useAppStore((s) => s.inputTextFileName);

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
    setFlags(loadFeatureFlags());
    const updateFlags = () => setFlags(loadFeatureFlags());
    window.addEventListener("storage", refreshStockCount);
    window.addEventListener("analysisStockUpdated", refreshStockCount);
    window.addEventListener("templatesUpdated", refreshTemplateCount);
    window.addEventListener("storage", refreshTemplateCount);
    window.addEventListener("staffUpdated", refreshStaffCount);
    window.addEventListener("storage", refreshStaffCount);
    window.addEventListener("featureFlagsUpdated", updateFlags);
    return () => {
      window.removeEventListener("storage", refreshStockCount);
      window.removeEventListener("analysisStockUpdated", refreshStockCount);
      window.removeEventListener("templatesUpdated", refreshTemplateCount);
      window.removeEventListener("storage", refreshTemplateCount);
      window.removeEventListener("staffUpdated", refreshStaffCount);
      window.removeEventListener("storage", refreshStaffCount);
      window.removeEventListener("featureFlagsUpdated", updateFlags);
    };
  }, [refreshStockCount, refreshTemplateCount, refreshStaffCount]);

  const handleFiles = useCallback(async (files: File[]) => {
    // 新規ファイル読み込み時は画像直接分析モードを解除（通常のファイル/PDF経路に戻す）
    setImageParts([]);
    const pdfs = files.filter((f) => f.type === "application/pdf");
    const imgFiles = files.filter((f) => f.type !== "application/pdf");

    // 画像（PDF以外）はファイル一覧として表示（無ければクリア）
    setImages(
      imgFiles.map((f, i) => ({
        id: `img-${i}-${Date.now()}`,
        name: f.name,
        url: URL.createObjectURL(f),
      }))
    );

    // --- PDF表示: File参照ごとに object URL を再利用（統合はここでは行わない）。---
    // これにより1件削除しても残りファイルのサムネイルは再描画されず軽い。
    const map = pdfUrlMapRef.current;
    // 今回のセットに無くなった File のURLを破棄（削除されたPDFを表示から外す）
    for (const [file, entry] of Array.from(map.entries())) {
      if (!pdfs.includes(file)) {
        URL.revokeObjectURL(entry.url);
        map.delete(file);
      }
    }
    const nextDocs = pdfs.map((f) => {
      let entry = map.get(f);
      if (!entry) {
        entry = { id: `pdf-${pdfIdCounterRef.current++}`, url: URL.createObjectURL(f) };
        map.set(f, entry);
      }
      return { id: entry.id, name: f.name, url: entry.url };
    });
    setPdfDocs(nextDocs);
    pdfSourceFilesRef.current = pdfs;

    // --- 解析用 fileBase64 の決定（統合は遅延：複数PDFはここで統合しない）---
    if (pdfs.length >= 2) {
      // 複数PDF: 統合は解析（実行）直前に一度だけ行う。ここでは暫定で先頭PDFをセットし、
      // 「要再統合」フラグを立てるだけ（削除のたびに統合を走らせない）。
      pdfMergeDirtyRef.current = true;
      setFileBase64(await fileToBase64(pdfs[0]));
      setFileMime("application/pdf");
      setFileName(`PDF ${pdfs.length}件（解析時に統合）`);
      toastOk(`${pdfs.length} 件のPDFを読み込みました（解析時に統合します）`);
      return;
    }

    pdfMergeDirtyRef.current = false;

    // 単一PDF or 画像のみ（従来どおり：最初のファイルをBase64化）
    const target = files[0];
    if (target) {
      setFileBase64(await fileToBase64(target));
      setFileMime(target.type);
      setFileName(target.name);
    }

    toastOk(`${files.length} 件のファイルを読み込みました`);
  }, []);

  // 解析（実行）／抽出／トリミングの直前に呼ばれ、最新のファイル構成で
  // 統合PDF等を解決して返す（遅延統合）。複数PDFはここで初めて一度だけ統合する。
  const ensurePdfMerged = useCallback(async (): Promise<
    { base64: string; mime: string; name: string } | null
  > => {
    const pdfs = pdfSourceFilesRef.current;
    if (pdfMergeDirtyRef.current && pdfs.length >= 2) {
      toastInfo(`${pdfs.length} 件のPDFを統合しています...`);
      const buffers = await Promise.all(pdfs.map((f) => f.arrayBuffer()));
      const merged = await mergePdfs(buffers);
      const name = `統合PDF_${pdfs.length}件_${merged.pageCount}ページ.pdf`;
      setFileBase64(merged.base64);
      setFileMime("application/pdf");
      setFileName(name);
      pdfMergeDirtyRef.current = false;
      return { base64: merged.base64, mime: "application/pdf", name };
    }
    if (fileBase64 && fileMime) {
      return { base64: fileBase64, mime: fileMime, name: fileName ?? "file" };
    }
    return null;
  }, [fileBase64, fileMime, fileName]);

  // ファイル（PDF・画像）を一括削除して状態をリセットする（再統合は一切走らせない）。
  const handleClearFiles = useCallback(() => {
    const map = pdfUrlMapRef.current;
    for (const [, entry] of map) URL.revokeObjectURL(entry.url);
    map.clear();
    pdfSourceFilesRef.current = [];
    pdfMergeDirtyRef.current = false;
    setPdfDocs([]);
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.url));
      return [];
    });
    setImageParts([]);
    setFileBase64(undefined);
    setFileMime(undefined);
    setFileName(undefined);
  }, []);

  const handleTextInput = useCallback((text: string, textFileName: string) => {
    // テキスト入力時はファイル名をセット
    if (text.trim()) {
      setFileName(textFileName);
    }
  }, []);

  const handleWorkflowAnalysisType = useCallback((type: AnalysisType) => {
    setActivePanel("gemini");
    toastInfo(`分析タイプ「${type}」をセットしました`);
  }, []);

  // 選択画像を1本のPDFに統合する。analyze=true ならAI分析パネルも開く。
  // リサイズ＋JPEG圧縮・タイムアウト・進捗・1枚失敗スキップで「固まる」を解消。
  const handleMergePdf = useCallback(
    async (ids: string[], analyze: boolean) => {
      const urls = ids
        .map((id) => images.find((img) => img.id === id)?.url)
        .filter((u): u is string => !!u);
      if (urls.length === 0) {
        toastError("統合対象の画像が見つかりません");
        return;
      }

      // PDF統合経路を使うので、画像直接分析の入力はクリアして排他にする。
      setImageParts([]);
      setProgress(0);
      toastInfo(`${urls.length} 枚をPDFに統合します`);
      try {
        const result = await mergeImagesToPdf(urls, {
          onProgress: (done, total) =>
            setProgress(Math.round((done / total) * 100)),
        });

        // 生成PDFを表示＆AI分析用データとしてセット（アップロードPDFとは別経路。
        // 既に1本に統合済みなので遅延統合の対象外＝dirtyにしない）
        pdfSourceFilesRef.current = [];
        pdfMergeDirtyRef.current = false;
        setPdfDocs([
          {
            id: `pdf-gen-${pdfIdCounterRef.current++}`,
            name: `統合_${result.pageCount}枚.pdf`,
            url: URL.createObjectURL(result.blob),
          },
        ]);
        setFileBase64(result.base64);
        setFileMime("application/pdf");
        setFileName(`統合_${result.pageCount}枚.pdf`);

        toastOk(
          result.skipped > 0
            ? `${result.pageCount} 枚をPDFに統合しました（${result.skipped} 枚は読み込み失敗のためスキップ）`
            : `${result.pageCount} 枚をPDFに統合しました`,
        );

        if (analyze) {
          setActivePanel("gemini");
          toastInfo("統合PDFでAI分析できます");
        }
      } catch (e) {
        toastError(
          `PDF統合に失敗しました: ${
            e instanceof Error ? e.message : "不明なエラー"
          }`,
        );
      } finally {
        setProgress(null);
      }
    },
    [images],
  );

  // 選択画像をPDFに統合せず、圧縮した画像群として直接AI分析へ渡す。
  const handleAnalyzeImages = useCallback(
    async (ids: string[]) => {
      // 選択順を保持して対象画像のURLを取得
      const urls = ids
        .map((id) => images.find((img) => img.id === id)?.url)
        .filter((u): u is string => !!u);
      if (urls.length === 0) {
        toastError("分析対象の画像が見つかりません");
        return;
      }

      setProgress(0);
      toastInfo(`${urls.length} 枚を画像のままAI分析します`);
      try {
        const { parts, skipped } = await compressImagesToParts(urls, {
          onProgress: (done, total) =>
            setProgress(Math.round((done / total) * 100)),
        });

        if (parts.length === 0) {
          toastError("すべての画像の読み込みに失敗しました");
          return;
        }

        // 画像直接分析モードへ。PDF経路の入力はクリアして排他にする。
        setImageParts(parts);
        pdfSourceFilesRef.current = [];
        pdfMergeDirtyRef.current = false;
        setPdfDocs([]);
        setFileBase64(undefined);
        setFileMime(undefined);
        setFileName(`画像${parts.length}枚`);
        setActivePanel("gemini");

        toastOk(
          skipped > 0
            ? `${parts.length} 枚を読み込みました（${skipped} 枚は失敗のためスキップ）。分析タイプを選んで実行してください`
            : `${parts.length} 枚を読み込みました。分析タイプを選んで実行してください`,
        );
      } catch (e) {
        toastError(
          `画像の準備に失敗しました: ${
            e instanceof Error ? e.message : "不明なエラー"
          }`,
        );
      } finally {
        setProgress(null);
      }
    },
    [images],
  );

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
          <UploadZone
            onFilesSelected={handleFiles}
            onTextInput={handleTextInput}
            onClearFiles={handleClearFiles}
          />
        </section>

        {/* ナビゲーションチップ */}
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {flags.staffKarute && (
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
            )}
            {flags.monthlyReport && (
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
            )}
            {flags.templatePanel && templateCount > 0 && (
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
                className="inline-flex items-center gap-2 rounded-full border border-[#B5D4F4] bg-[#E6F1FB] px-4 py-1.5 text-xs font-semibold text-[#185FA5] transition-colors hover:bg-[#E6F1FB]"
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

        {/* テキスト入力モード時のヒント */}
        {inputMode === "text" && !inputText.trim() && (
          <section className="rounded-2xl border border-[#B5D4F4] bg-[#E6F1FB]/50 p-6 text-center">
            <p className="text-sm text-[#378ADD] font-medium">
              ✏️ テキストを入力してください
            </p>
            <p className="mt-1 text-xs text-gray-400">
              テキストを入力するとAI分析が実行できます
            </p>
          </section>
        )}

        {/* PDFページ一覧（テキストモードでは非表示）。複数PDFはファイルごとにセクション表示。
            削除しても再統合は走らず、解析/抽出/トリミングの直前に最新セットで一度だけ統合する。 */}
        {inputMode === "file" && pdfDocs.length > 0 && (
          <section className="rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-bold text-gray-700">
              PDFページ
              {pdfDocs.length > 1 && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  （{pdfDocs.length} ファイル）
                </span>
              )}
            </h2>
            <div className="space-y-6">
              {pdfDocs.map((doc) => (
                <div key={doc.id}>
                  {pdfDocs.length > 1 && (
                    <p className="mb-2 truncate text-sm font-semibold text-[#185FA5]">
                      📄 {doc.name}
                    </p>
                  )}
                  <PageGrid
                    pdfUrl={doc.url}
                    onExtract={(pages) => {
                      // 抽出は最新の統合PDFを必要とするため、直前に遅延統合を確定。
                      ensurePdfMerged();
                      toastInfo(
                        `「${doc.name}」のページ ${pages.join(", ")} を抽出します`
                      );
                    }}
                    onCrop={(pages) => {
                      ensurePdfMerged();
                      toastInfo(
                        `「${doc.name}」のページ ${pages.join(", ")} をトリミングします`
                      );
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 画像一覧（テキストモードでは非表示） */}
        {inputMode === "file" && images.length > 0 && (
          <section className="rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-bold text-gray-700">
              画像ファイル
            </h2>
            <ImageGrid
              images={images}
              onRemoveBg={(ids) =>
                toastInfo(`${ids.length} 枚の背景除去を開始します`)
              }
              onMergePdf={(ids) => handleMergePdf(ids, false)}
              onMergePdfAndAnalyze={(ids) => handleMergePdf(ids, true)}
              onAnalyzeImages={(ids) => handleAnalyzeImages(ids)}
            />
          </section>
        )}

        {/* 機能パネル（アコーディオン：押したパネルだけ展開、他は閉じる） */}
        <section className="w-full space-y-4">
          <div className="flex flex-wrap gap-2">
            {PANEL_BUTTONS.map((b) => {
              const active = activePanel === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setActivePanel(active ? null : b.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors ${
                    b.primary
                      ? active
                        ? "bg-[#0F6E56] text-white"
                        : "bg-[#1D9E75] text-white hover:bg-[#0F6E56]"
                      : active
                        ? "bg-[#185FA5] text-white"
                        : "border border-gray-200 bg-white text-gray-600 hover:border-[#378ADD] hover:text-[#185FA5]"
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>

          {activePanel === "gemini" && (
            <GeminiPanel
              fileBase64={fileBase64}
              fileMime={fileMime}
              fileName={inputMode === "text" ? inputTextFileName : fileName}
              inputMode={inputMode}
              inputText={inputText}
              onResult={(r) => setAnalysisResult(r)}
              clinicSettings={settings}
              imageParts={imageParts}
              onEnsureFileData={ensurePdfMerged}
            />
          )}

          {activePanel === "genspark" && (
            <GensparkPanel analysisResult={analysisResult} />
          )}

          {activePanel === "message" && (
            <MessagePanel
              fileBase64={fileBase64}
              fileMime={fileMime}
              fileName={fileName}
              clinicContext={clinicContext}
            />
          )}

          {activePanel === "pdf" && (
            <PdfActions
              onCompress={(q) => toastInfo(`品質「${q}」で圧縮します`)}
              onResize={(s) => toastInfo(`${s}にリサイズします`)}
              onGemini={() => setActivePanel("gemini")}
              onPresentation={() => setActivePanel("genspark")}
              onMessage={() => setActivePanel("message")}
            />
          )}

          {activePanel === "workflow" && (
            <WorkflowPanel onSelectAnalysisType={handleWorkflowAnalysisType} />
          )}
        </section>

        {/* テンプレートパネル */}
        {flags.templatePanel && (
          <section id="template-panel">
            <TemplatePanel />
          </section>
        )}

        {/* レポートパネル */}
        {flags.monthlyReport && (
          <section>
            <MonthlyReportPanel clinicSettings={settings} />
          </section>
        )}

        {/* ストックパネル */}
        <section>
          <AnalysisStockPanel />
        </section>

        {/* スタッフカルテ */}
        {flags.staffKarute && (
          <section>
            <StaffPanel clinicSettings={settings} />
          </section>
        )}
      </main>
    </div>
  );
}
