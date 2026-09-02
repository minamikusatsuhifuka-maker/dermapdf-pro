"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, Image as ImageIcon, X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import {
  ProofreadModal,
  type AppliedFix,
} from "@/components/proofread/proofread-modal";
import { ProofreadComparison } from "@/components/proofread/proofread-comparison";
import { saveAnalysis } from "@/lib/analysis-storage";
import { classifyAnalysisInBackground } from "@/lib/ai-category";
import { toastInfo } from "@/components/ui/toast-provider";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
];

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onTextInput?: (text: string, fileName: string) => void;
  // 読み込んだファイル（PDF・画像）を一括削除して状態をリセットする。
  onClearFiles?: () => void;
}

export function UploadZone({ onFilesSelected, onTextInput, onClearFiles }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [todayStr, setTodayStr] = useState("");
  const [showProofread, setShowProofread] = useState(false);
  // メイン画面に大きく表示する校正前後比較
  const [comparison, setComparison] = useState<{
    before: string;
    after: string;
    fixes: AppliedFix[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTodayStr(new Date().toLocaleDateString("ja-JP")); }, []);

  const inputMode = useAppStore((s) => s.inputMode);
  const inputText = useAppStore((s) => s.inputText);
  const inputTextFileName = useAppStore((s) => s.inputTextFileName);
  const setInputMode = useAppStore((s) => s.setInputMode);
  const setInputText = useAppStore((s) => s.setInputText);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const files = Array.from(fileList).filter((f) =>
        ACCEPTED_TYPES.includes(f.type)
      );
      if (files.length === 0) return;

      // 追加アップロードは既存への追記。同一ファイル（名前＋サイズ＋更新日時）は重複としてスキップ。
      const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
      const knownKeys = new Set(selectedFiles.map(fileKey));
      const fresh: File[] = [];
      let skipped = 0;
      for (const f of files) {
        const key = fileKey(f);
        if (knownKeys.has(key)) {
          skipped++;
          continue;
        }
        knownKeys.add(key);
        fresh.push(f);
      }
      if (skipped > 0) {
        toastInfo(`${skipped} 件は読み込み済みのためスキップしました`);
      }
      if (fresh.length === 0) return;

      // PDFも複数受け付ける。PDFを先頭・画像を後段に並べ替え（各グループ内の既存順序は保持）。
      // PDFを先頭に置くことで、単一ファイル前提の fileBase64 セットが従来どおり先頭PDFを指す。
      const combined = [...selectedFiles, ...fresh];
      const pdfs = combined.filter((f) => f.type === "application/pdf");
      const images = combined.filter((f) => f.type !== "application/pdf");
      const accepted = [...pdfs, ...images];

      setSelectedFiles(accepted);
      onFilesSelected(accepted);
    },
    [onFilesSelected, selectedFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const removeFile = (index: number) => {
    const next = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(next);
    onFilesSelected(next);
  };

  // 読み込んだファイルを一括削除（全PDF・全画像をまとめてクリア）。
  // ファイル自体の削除であり、再統合は一切走らせず状態をリセットするだけ。
  const clearAllFiles = () => {
    setSelectedFiles([]);
    if (onClearFiles) onClearFiles();
    else onFilesSelected([]);
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (onTextInput) {
      onTextInput(text, inputTextFileName);
    }
  };

  const handleClearText = () => {
    setInputText("");
    if (onTextInput) {
      onTextInput("", inputTextFileName);
    }
  };

  const handleTabSwitch = (mode: "file" | "text") => {
    setInputMode(mode);
  };

  return (
    <div className="space-y-3">
      {/* タブ切り替え */}
      <div className="flex rounded-xl border border-gray-200 bg-white/60 overflow-hidden">
        <button
          onClick={() => handleTabSwitch("file")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
            inputMode === "file"
              ? "bg-gradient-to-r from-[#E6F1FB] to-white text-[#185FA5] border-b-2 border-[#378ADD]"
              : "text-gray-500 hover:bg-gray-50"
          )}
        >
          <FileText className="h-4 w-4" />
          ファイルアップロード
        </button>
        <button
          onClick={() => handleTabSwitch("text")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
            inputMode === "text"
              ? "bg-gradient-to-r from-[#E6F1FB] to-white text-[#185FA5] border-b-2 border-[#378ADD]"
              : "text-gray-500 hover:bg-gray-50"
          )}
        >
          <Pencil className="h-4 w-4" />
          テキスト入力
        </button>
      </div>

      {/* ファイルアップロードモード */}
      {inputMode === "file" && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all",
              isDragging
                ? "border-[#378ADD] bg-[#E6F1FB]/60"
                : "border-gray-300 bg-white/40 hover:border-[#B5D4F4] hover:bg-[#E6F1FB]/30"
            )}
          >
            <Upload className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-600">
              ファイルをドラッグ＆ドロップ、またはクリックして選択
            </p>
            <p className="mt-1 text-xs text-gray-400">
              PDF / PNG / JPEG / HEIC 対応（画像もPDFも複数可）
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.heic"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                // 同じファイルを再選択しても change が発火するようリセット（重複はスキップ判定に委ねる）
                e.target.value = "";
              }}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              {/* ファイル一覧ヘッダ＋一括削除（ページ選択の「全解除」とは別物：ファイル自体を削除） */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-gray-500">
                  読み込み済みファイル（{selectedFiles.length}件）
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAllFiles();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-500 transition-colors hover:bg-red-100"
                  title="読み込んだファイルをすべて削除（再統合は走りません）"
                >
                  <Trash2 className="h-3 w-3" /> すべて削除
                </button>
              </div>
              {selectedFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-white/50 bg-white/60 px-4 py-2 backdrop-blur-sm"
                >
                  {file.type === "application/pdf" ? (
                    <FileText className="h-4 w-4 text-[#185FA5]" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-[#378ADD]" />
                  )}
                  <span className="flex-1 truncate text-sm">{file.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="rounded-full p-1 hover:bg-gray-100"
                  >
                    <X className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* テキスト入力モード */}
      {inputMode === "text" && (
        <div className="relative rounded-2xl border-2 border-[#B5D4F4] bg-[#E6F1FB]/30 p-4">
          {/* クリアボタン */}
          {inputText.length > 0 && (
            <button
              onClick={handleClearText}
              className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs text-gray-500 shadow-sm hover:bg-white hover:text-gray-700 transition-colors z-10"
            >
              <X className="h-3 w-3" />
              クリア
            </button>
          )}

          <textarea
            value={inputText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={
              "分析したいテキストをここに入力してください。\n\n例：会議の議事録、スタッフへのフィードバック、研修メモ、アイデアなど..."
            }
            rows={14}
            className="w-full resize-y rounded-xl border border-[#B5D4F4] bg-white/80 px-4 py-3 text-sm leading-relaxed text-gray-700 placeholder:text-gray-400 focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
          />

          {/* 校正ボタン（テキスト入力直下） */}
          <div className="mt-2">
            <button
              onClick={() => setShowProofread(true)}
              disabled={inputText.trim().length === 0}
              className="inline-flex items-center gap-1 rounded-lg bg-purple-500 hover:bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              title="貼り付けたテキストの誤字・脱字・表記揺れを校正"
            >
              🔎 校正
            </button>
          </div>

          {/* 文字数カウンター + ファイル情報 */}
          <div className="mt-2 flex items-center justify-between">
            {inputText.length > 0 ? (
              <span className="text-xs text-[#378ADD]">
                ✏️ テキスト入力 ({inputText.length}文字){" "}
                {todayStr}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-gray-400">
              {inputText.length} 文字
            </span>
          </div>

          {/* 比較表示中はアンマウントせず hidden で保持する（検出一覧・適用状態・workText を
              そのまま残し、「🔎 校正レビューを開く」で再検出なしに再表示できるようにする）。 */}
          {(showProofread || comparison) && (
            <ProofreadModal
              hidden={!showProofread}
              sourceText={inputText}
              sourceTitle={`テキスト入力_${todayStr}`}
              onClose={() => setShowProofread(false)}
              onComparison={(before, after, fixes) =>
                setComparison({ before, after, fixes })
              }
              onSaveCard={(title, content, before) => {
                const saved = saveAnalysis({
                  fileName: `テキスト入力_${todayStr}`,
                  analysisType: "proofread",
                  analysisLabel: "校正済み",
                  content,
                  tags: [],
                  folder: "校正",
                  title,
                  proofreadBefore: before,
                });
                // folder:"校正" は従来どおり固定。AIカテゴリは別フィールドに裏で付与
                void classifyAnalysisInBackground(saved.id, saved.content);
              }}
            />
          )}
        </div>
      )}

      {/* 校正の前後比較（メイン画面に大きく表示） */}
      {comparison && (
        <ProofreadComparison
          before={comparison.before}
          after={comparison.after}
          fixes={comparison.fixes}
          title={`テキスト入力_${todayStr}`}
          onClose={() => setComparison(null)}
          onReopen={() => setShowProofread(true)}
        />
      )}
    </div>
  );
}
