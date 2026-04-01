"use client";

import { Download, HardDrive } from "lucide-react";

interface ResultCardProps {
  type: "image" | "text";
  title: string;
  imageUrl?: string;
  text?: string;
  onDownload?: () => void;
  onSaveToDrive?: () => void;
}

export function ResultCard({
  type,
  title,
  imageUrl,
  text,
  onDownload,
  onSaveToDrive,
}: ResultCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/50 bg-white/60 shadow-lg backdrop-blur-xl">
      {/* プレビュー */}
      {type === "image" && imageUrl && (
        <div className="flex items-center justify-center bg-gray-50/50 p-4">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-64 rounded-lg object-contain"
          />
        </div>
      )}
      {type === "text" && text && (
        <div className="max-h-64 overflow-y-auto bg-gray-50/50 p-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{text}</pre>
        </div>
      )}

      {/* フッター */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
        <span className="truncate text-sm font-medium text-gray-700">
          {title}
        </span>
        <div className="flex gap-2">
          {onDownload && (
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-400 to-rose-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-rose-500 hover:to-rose-600"
            >
              <Download className="h-3.5 w-3.5" /> ダウンロード
            </button>
          )}
          {onSaveToDrive && (
            <button
              onClick={onSaveToDrive}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-400 to-purple-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-purple-500 hover:to-purple-600"
            >
              <HardDrive className="h-3.5 w-3.5" /> Drive保存
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
