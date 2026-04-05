"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, Image as ImageIcon, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
];

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onTextInput?: (text: string, fileName: string) => void;
}

export function UploadZone({ onFilesSelected, onTextInput }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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

      // PDFは1件のみ
      const pdfs = files.filter((f) => f.type === "application/pdf");
      const images = files.filter((f) => f.type !== "application/pdf");
      const accepted = pdfs.length > 0 ? [pdfs[0], ...images] : images;

      setSelectedFiles(accepted);
      onFilesSelected(accepted);
    },
    [onFilesSelected]
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
              PDF / PNG / JPEG / HEIC 対応（画像は複数、PDFは1件まで）
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.heic"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
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
            rows={10}
            className="w-full resize-y rounded-xl border border-[#B5D4F4] bg-white/80 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-[#378ADD] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
          />

          {/* 文字数カウンター + ファイル情報 */}
          <div className="mt-2 flex items-center justify-between">
            {inputText.length > 0 ? (
              <span className="text-xs text-[#378ADD]">
                ✏️ テキスト入力 ({inputText.length}文字){" "}
                {new Date().toLocaleDateString("ja-JP")}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-gray-400">
              {inputText.length} 文字
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
