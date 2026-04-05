"use client";

import { useState } from "react";
import {
  FileDown,
  Maximize,
  BrainCircuit,
  Presentation,
  MessageSquare,
} from "lucide-react";

type CompressionQuality = "light" | "standard" | "strong" | "max";
type PaperSize = "A4" | "A5" | "B5" | "Letter";

interface PdfActionsProps {
  onCompress?: (quality: CompressionQuality) => void;
  onResize?: (size: PaperSize) => void;
  onGemini?: () => void;
  onPresentation?: () => void;
  onMessage?: () => void;
}

const QUALITY_OPTIONS: { value: CompressionQuality; label: string }[] = [
  { value: "light", label: "軽（画質優先）" },
  { value: "standard", label: "標準" },
  { value: "strong", label: "強（バランス）" },
  { value: "max", label: "最大（サイズ優先）" },
];

const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: "A4", label: "A4 (210×297mm)" },
  { value: "A5", label: "A5 (148×210mm)" },
  { value: "B5", label: "B5 (182×257mm)" },
  { value: "Letter", label: "Letter (216×279mm)" },
];

export function PdfActions({
  onCompress,
  onResize,
  onGemini,
  onPresentation,
  onMessage,
}: PdfActionsProps) {
  const [quality, setQuality] = useState<CompressionQuality>("standard");
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");

  return (
    <div className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      <h2 className="text-lg font-bold text-gray-700">PDFアクション</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 圧縮 */}
        <div className="rounded-xl border border-gray-100 bg-white/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FileDown className="h-4 w-4 text-[#185FA5]" /> 圧縮
          </div>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as CompressionQuality)}
            className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
          >
            {QUALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onCompress?.(quality)}
            className="w-full rounded-lg bg-[#378ADD] hover:bg-[#185FA5] px-4 py-2 text-sm font-medium text-white shadow-sm"
          >
            圧縮実行
          </button>
        </div>

        {/* リサイズ */}
        <div className="rounded-xl border border-gray-100 bg-white/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Maximize className="h-4 w-4 text-[#185FA5]" /> 用紙リサイズ
          </div>
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value as PaperSize)}
            className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
          >
            {PAPER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onResize?.(paperSize)}
            className="w-full rounded-lg bg-[#378ADD] hover:bg-[#185FA5] px-4 py-2 text-sm font-medium text-white shadow-sm"
          >
            リサイズ実行
          </button>
        </div>
      </div>

      {/* AIアクション */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onGemini}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] hover:bg-[#0F6E56] px-4 py-2.5 text-sm font-medium text-white shadow-sm"
        >
          <BrainCircuit className="h-4 w-4" /> Gemini AI分析
        </button>
        <button
          onClick={onPresentation}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] hover:bg-[#0F6E56] px-4 py-2.5 text-sm font-medium text-white shadow-sm"
        >
          <Presentation className="h-4 w-4" /> プレゼン生成
        </button>
        <button
          onClick={onMessage}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] hover:bg-[#0F6E56] px-4 py-2.5 text-sm font-medium text-white shadow-sm"
        >
          <MessageSquare className="h-4 w-4" /> メッセージ生成
        </button>
      </div>
    </div>
  );
}
