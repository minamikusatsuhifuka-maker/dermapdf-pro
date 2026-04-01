"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Trash2, Download, Search, ChevronDown, ChevronUp } from "lucide-react";
import { toastOk } from "@/components/ui/toast-provider";
import {
  loadAllAnalyses,
  deleteAnalysis,
  clearAllAnalyses,
  exportAnalysesAsJSON,
  exportAnalysesAsText,
  type AnalysisRecord,
} from "@/lib/analysis-storage";

export function AnalysisStockPanel() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const reload = useCallback(() => {
    setRecords(loadAllAnalyses());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = search
    ? records.filter(
        (r) =>
          r.fileName.toLowerCase().includes(search.toLowerCase()) ||
          r.content.toLowerCase().includes(search.toLowerCase()) ||
          r.analysisLabel.toLowerCase().includes(search.toLowerCase())
      )
    : records;

  const handleDelete = (id: string) => {
    deleteAnalysis(id);
    reload();
    toastOk("削除しました");
  };

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    toastOk("クリップボードにコピーしました");
  };

  const handleClearAll = () => {
    clearAllAnalyses();
    setShowConfirmClear(false);
    reload();
    toastOk("全件削除しました");
  };

  return (
    <div
      id="analysis-stock"
      className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">
          保存済み分析 ({records.length}件)
        </h2>
        <div className="flex gap-2">
          <button
            onClick={exportAnalysesAsJSON}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80 disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> JSON
          </button>
          <button
            onClick={exportAnalysesAsText}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80 disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> テキスト
          </button>
          {showConfirmClear ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearAll}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white"
              >
                本当に全削除
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600"
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmClear(true)}
              disabled={records.length === 0}
              className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-100 disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" /> 全削除
            </button>
          )}
        </div>
      </div>

      {/* 検索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ファイル名・内容・分析タイプで検索..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
        />
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          {records.length === 0
            ? "保存された分析結果はありません"
            : "検索条件に一致する結果がありません"}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const isExpanded = expandedId === r.id;
            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white/60"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    {r.analysisLabel}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-gray-700">
                    {r.fileName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleString("ja-JP")}
                  </span>
                  <button
                    onClick={() => handleCopy(r.content)}
                    className="rounded p-1 hover:bg-gray-100"
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded p-1 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : r.id)
                    }
                    className="rounded p-1 hover:bg-gray-100"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </button>
                </div>

                {!isExpanded && (
                  <p className="truncate px-4 pb-3 text-xs text-gray-500">
                    {r.content.slice(0, 100)}...
                  </p>
                )}

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700">
                      {r.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
