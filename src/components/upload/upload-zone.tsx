"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
];

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export function UploadZone({ onFilesSelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="space-y-3">
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
            ? "border-rose-400 bg-rose-50/60"
            : "border-gray-300 bg-white/40 hover:border-purple-300 hover:bg-purple-50/30"
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
                <FileText className="h-4 w-4 text-rose-500" />
              ) : (
                <ImageIcon className="h-4 w-4 text-purple-500" />
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
    </div>
  );
}
