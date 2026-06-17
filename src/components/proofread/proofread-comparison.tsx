"use client";

import { X } from "lucide-react";
import { saveAnalysis } from "@/lib/analysis-storage";
import { toastOk } from "@/components/ui/toast-provider";

// 校正の「校正前｜校正後」をメイン画面に大きく表示し、校正後を「校正」フォルダへ新カード保存する。
export function ProofreadComparison({
  before,
  after,
  title,
  onClose,
}: {
  before: string;
  after: string;
  title: string;
  onClose: () => void;
}) {
  const handleSave = () => {
    saveAnalysis({
      fileName: title,
      analysisType: "proofread",
      analysisLabel: "校正済み",
      content: after,
      tags: [],
      folder: "校正",
      title: `【校正済み】${title}`,
    });
    toastOk("校正内容を「校正」フォルダに保存しました");
    onClose();
  };

  return (
    <section className="space-y-3 rounded-2xl border border-[#B5D4F4] bg-white/60 p-5 shadow-lg backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-700">🔎 校正 前後比較</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-100"
          title="比較を閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-red-600">
            校正前（原文）
          </div>
          <pre className="min-h-[50vh] max-h-[72vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50/30 p-4 text-sm leading-relaxed text-gray-700">
            {before}
          </pre>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-green-600">校正後</div>
          <pre className="min-h-[50vh] max-h-[72vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-green-200 bg-green-50/30 p-4 text-sm leading-relaxed text-gray-700">
            {after}
          </pre>
        </div>
      </div>

      <div>
        <button
          onClick={handleSave}
          className="rounded-lg bg-[#1D9E75] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F6E56]"
        >
          校正内容を保存
        </button>
      </div>
    </section>
  );
}
