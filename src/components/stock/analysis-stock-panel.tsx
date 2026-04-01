"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Trash2, Download, Search, ChevronDown, ChevronUp, Sparkles, ExternalLink, X, Loader2 } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";
import {
  loadAllAnalyses,
  deleteAnalysis,
  clearAllAnalyses,
  exportAnalysesAsJSON,
  exportAnalysesAsText,
  updateAnalysisTitle,
  getDisplayTitle,
  type AnalysisRecord,
} from "@/lib/analysis-storage";
import {
  TARGET_OPTIONS,
  LEVEL_OPTIONS,
  PURPOSE_OPTIONS,
  TONE_OPTIONS,
  getTechniqueFlags,
  generateGensparkPrompt,
} from "@/lib/genspark-prompt-generator";

const selectClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200";

function InlineGensparkPanel({
  record,
  onClose,
}: {
  record: AnalysisRecord;
  onClose: () => void;
}) {
  const [target, setTarget] = useState("all_staff");
  const [level, setLevel] = useState("standard");
  const [purpose, setPurpose] = useState("inform");
  const [tone, setTone] = useState("professional");
  const [notes, setNotes] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const { appliesEmotion, appliesCatch, appliesBeforeAfter } = getTechniqueFlags(target, purpose);
  const hasTechniques = appliesEmotion || appliesCatch || appliesBeforeAfter;

  const handleGenerate = async () => {
    setLoading(true);
    setPrompt("");
    try {
      const data = await generateGensparkPrompt({
        analysisResult: record.content,
        target,
        level,
        purpose,
        tone,
        additionalNotes: notes,
      });
      if (!data.success) throw new Error(data.error);
      setPrompt(data.prompt);
      toastOk("Gensparkプロンプトを生成しました");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAndOpen = async () => {
    await navigator.clipboard.writeText(prompt);
    toastOk("コピーしました。Gensparkを開きます...");
    window.open("https://www.genspark.ai/ai_slides?tab=explore", "_blank");
  };

  const handleCopyOnly = async () => {
    await navigator.clipboard.writeText(prompt);
    toastOk("クリップボードにコピーしました");
  };

  return (
    <div className="space-y-3 border-t border-purple-100 bg-purple-50/30 px-4 py-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-purple-700">
          <Sparkles className="h-4 w-4" /> Gensparkプロンプト生成
        </h4>
        <button onClick={onClose} className="rounded p-1 hover:bg-purple-100">
          <X className="h-3.5 w-3.5 text-purple-400" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">聴講ターゲット</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectClass}>
            {TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">内容レベル</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass}>
            {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">プレゼンの目的</label>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={selectClass}>
            {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">スライドのトーン</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)} className={selectClass}>
            {TONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">追加要望（任意）</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="例：会社のカラーはピンクと白。冒頭に院長の挨拶スライドを入れてほしい。"
          rows={2}
          className={selectClass}
        />
      </div>

      {hasTechniques && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-gray-500">自動適用される技法：</p>
          <div className="flex flex-wrap gap-1.5">
            {appliesEmotion && (
              <span className="rounded-full border border-pink-200 bg-pink-50 px-2 py-0.5 text-[10px] text-pink-700">感情の動線設計</span>
            )}
            {appliesCatch && (
              <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] text-purple-700">1スライド1メッセージ</span>
            )}
            {appliesBeforeAfter && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">Before/After比較</span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "生成中..." : "プロンプトを生成"}
      </button>

      {prompt && (
        <div className="space-y-2">
          <textarea readOnly value={prompt} rows={8} className="w-full rounded-xl border border-purple-200 bg-white/80 px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopyAndOpen}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm"
            >
              <Copy className="h-3 w-3" /> コピーしてGensparkを開く <ExternalLink className="h-2.5 w-2.5" />
            </button>
            <button
              onClick={handleCopyOnly}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80"
            >
              <Copy className="h-3 w-3" /> コピーのみ
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
            >
              <X className="h-3 w-3" /> 閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalysisStockPanel() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeGensparkId, setActiveGensparkId] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setRecords(loadAllAnalyses());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("storage", reload);
    window.addEventListener("analysisStockUpdated", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("analysisStockUpdated", reload);
    };
  }, [reload]);

  const filtered = search
    ? records.filter(
        (r) =>
          getDisplayTitle(r).toLowerCase().includes(search.toLowerCase()) ||
          r.fileName.toLowerCase().includes(search.toLowerCase()) ||
          r.content.toLowerCase().includes(search.toLowerCase()) ||
          r.analysisLabel.toLowerCase().includes(search.toLowerCase())
      )
    : records;

  const handleDelete = (id: string) => {
    deleteAnalysis(id);
    if (activeGensparkId === id) setActiveGensparkId(null);
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
    setActiveGensparkId(null);
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
            const isGensparkActive = activeGensparkId === r.id;
            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white/60"
              >
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    {r.analysisLabel}
                  </span>
                  {editingId === r.id ? (
                    <input
                      type="text"
                      defaultValue={getDisplayTitle(r)}
                      autoFocus
                      placeholder={r.fileName}
                      className="flex-1 text-sm font-semibold border-b border-purple-400 outline-none bg-transparent w-full max-w-xs"
                      onBlur={(e) => {
                        updateAnalysisTitle(r.id, e.target.value);
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateAnalysisTitle(r.id, e.currentTarget.value);
                          setEditingId(null);
                        }
                        if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm font-medium text-gray-700">
                      {getDisplayTitle(r)}
                      <button
                        onClick={() => setEditingId(r.id)}
                        className="ml-1 text-gray-400 hover:text-purple-500 transition-colors"
                        title="タイトルを編集"
                      >
                        ✏️
                      </button>
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleString("ja-JP")}
                  </span>
                  <button
                    onClick={() =>
                      setActiveGensparkId(isGensparkActive ? null : r.id)
                    }
                    className="rounded bg-gradient-to-r from-purple-500 to-pink-500 px-2 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Gensparkへ
                  </button>
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

                {!isExpanded && !isGensparkActive && (
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

                {isGensparkActive && (
                  <InlineGensparkPanel
                    record={r}
                    onClose={() => setActiveGensparkId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
