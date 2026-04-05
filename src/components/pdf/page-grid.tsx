"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckSquare, Square, Scissors, Crop } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageGridProps {
  pdfUrl: string;
  onExtract?: (pages: number[]) => void;
  onCrop?: (pages: number[]) => void;
}

interface PageThumb {
  pageNum: number;
  dataUrl: string;
}

export function PageGrid({ pdfUrl, onExtract, onCrop }: PageGridProps) {
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // PDF.jsでページサムネイルを生成
  useEffect(() => {
    let cancelled = false;

    async function renderPages() {
      setLoading(true);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const thumbs: PageThumb[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          thumbs.push({ pageNum: i, dataUrl: canvas.toDataURL() });
        }

        if (!cancelled) setPages(thumbs);
      } catch (err) {
        console.error("PDF rendering error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    renderPages();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  const togglePage = (pageNum: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(pages.map((p) => p.pageNum)));
  const deselectAll = () => setSelected(new Set());

  const selectedArray = Array.from(selected).sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-transparent" />
        <span className="ml-3 text-sm text-gray-500">PDF読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={selectAll}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
        >
          <CheckSquare className="h-3.5 w-3.5" /> 全選択
        </button>
        <button
          onClick={deselectAll}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
        >
          <Square className="h-3.5 w-3.5" /> 全解除
        </button>
        <span className="text-xs text-gray-400">
          {selected.size} / {pages.length} ページ選択中
        </span>
        <div className="ml-auto flex gap-2">
          <button
            disabled={selected.size === 0}
            onClick={() => onExtract?.(selectedArray)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#4f6272] hover:bg-[#3d5260] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity disabled:opacity-40"
          >
            <Scissors className="h-3.5 w-3.5" /> 選択ページ抽出
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() => onCrop?.(selectedArray)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#5c7a6e] hover:bg-[#4a6459] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity disabled:opacity-40"
          >
            <Crop className="h-3.5 w-3.5" /> トリミング
          </button>
        </div>
      </div>

      {/* ページグリッド */}
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {pages.map((page) => {
          const isSelected = selected.has(page.pageNum);
          return (
            <button
              key={page.pageNum}
              onClick={() => togglePage(page.pageNum)}
              className={cn(
                "group relative overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-all",
                isSelected
                  ? "border-slate-400 ring-2 ring-slate-200"
                  : "border-transparent hover:border-slate-200"
              )}
            >
              <img
                src={page.dataUrl}
                alt={`ページ ${page.pageNum}`}
                className="w-full"
              />
              {/* チェックボックス */}
              <div
                className={cn(
                  "absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-md border-2 text-white transition-colors",
                  isSelected
                    ? "border-slate-500 bg-slate-500"
                    : "border-gray-300 bg-white/80"
                )}
              >
                {isSelected && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {/* ページ番号 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent px-2 py-1 text-center text-xs font-medium text-white">
                {page.pageNum}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
