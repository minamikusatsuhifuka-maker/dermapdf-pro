"use client";

import { useState } from "react";
import { Eraser, FileOutput, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageItem {
  id: string;
  name: string;
  url: string;
}

interface ImageGridProps {
  images: ImageItem[];
  onRemoveBg?: (ids: string[]) => void;
  onMergePdf?: (ids: string[]) => void;
  onMergePdfAndAnalyze?: (ids: string[]) => void;
}

export function ImageGrid({
  images,
  onRemoveBg,
  onMergePdf,
  onMergePdfAndAnalyze,
}: ImageGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(images.map((img) => img.id)));
  const deselectAll = () => setSelected(new Set());

  const selectedArray = Array.from(selected);

  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={selectAll}
          className="rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
        >
          全選択
        </button>
        <button
          onClick={deselectAll}
          className="rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
        >
          全解除
        </button>
        <span className="text-xs text-gray-400">
          {selected.size} / {images.length} 枚選択中
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            disabled={selected.size === 0}
            onClick={() => onRemoveBg?.(selectedArray)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#378ADD] hover:bg-[#185FA5] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity disabled:opacity-40"
          >
            <Eraser className="h-3.5 w-3.5" /> 一括背景除去
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() => onMergePdf?.(selectedArray)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D9E75] hover:bg-[#0F6E56] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity disabled:opacity-40"
          >
            <FileOutput className="h-3.5 w-3.5" /> PDFに統合
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() => onMergePdfAndAnalyze?.(selectedArray)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#378ADD] hover:bg-[#185FA5] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity disabled:opacity-40"
          >
            <BrainCircuit className="h-3.5 w-3.5" /> PDF統合してAI分析
          </button>
        </div>
      </div>

      {/* 画像グリッド */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {images.map((img) => {
          const isSelected = selected.has(img.id);
          return (
            <button
              key={img.id}
              onClick={() => toggle(img.id)}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-all",
                isSelected
                  ? "border-[#378ADD] ring-2 ring-slate-200"
                  : "border-transparent hover:border-[#B5D4F4]"
              )}
            >
              <img
                src={img.url}
                alt={img.name}
                className="h-full w-full object-cover"
              />
              {/* チェックボックス */}
              <div
                className={cn(
                  "absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-md border-2 text-white transition-colors",
                  isSelected
                    ? "border-[#378ADD] bg-[#378ADD]"
                    : "border-gray-300 bg-white/80"
                )}
              >
                {isSelected && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {/* ファイル名 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5 text-center text-xs text-white truncate">
                {img.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
