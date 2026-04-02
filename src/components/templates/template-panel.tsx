"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, ChevronDown, ChevronUp, Pencil, X, BrainCircuit, Sparkles } from "lucide-react";
import { toastOk } from "@/components/ui/toast-provider";
import {
  loadTemplates,
  deleteTemplate,
  updateTemplate,
  type AnalysisTemplate,
} from "@/lib/template-storage";

export function TemplatePanel() {
  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setTemplates(loadTemplates());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("templatesUpdated", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("templatesUpdated", reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  if (templates.length === 0) return null;

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    reload();
    toastOk("テンプレートを削除しました");
  };

  const handleRename = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (trimmed) {
      updateTemplate(id, { name: trimmed });
      reload();
    }
    setEditingId(null);
  };

  const handleApplyGemini = (t: AnalysisTemplate) => {
    window.dispatchEvent(
      new CustomEvent("applyTemplateGemini", {
        detail: { analysisType: t.analysisType, analysisPurpose: t.analysisPurpose },
      })
    );
    toastOk(`「${t.name}」をGemini分析に適用しました`);
  };

  const handleApplyGenspark = (t: AnalysisTemplate) => {
    window.dispatchEvent(
      new CustomEvent("applyTemplateGenspark", {
        detail: {
          target: t.gensparkTarget,
          level: t.gensparkLevel,
          purpose: t.gensparkPurpose,
          tone: t.gensparkTone,
          notes: t.gensparkNotes,
        },
      })
    );
    toastOk(`「${t.name}」をGenspark設定に適用しました`);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      <h2 className="text-lg font-bold text-gray-700">
        テンプレート ({templates.length}件)
      </h2>

      <div className="space-y-2">
        {templates.map((t) => {
          const isExpanded = expandedId === t.id;
          return (
            <div
              key={t.id}
              className="overflow-hidden rounded-xl border border-gray-100 bg-white/60"
            >
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {t.analysisType}
                </span>
                {editingId === t.id ? (
                  <input
                    type="text"
                    defaultValue={t.name}
                    autoFocus
                    className="flex-1 text-sm font-semibold border-b border-purple-400 outline-none bg-transparent max-w-xs"
                    onBlur={(e) => handleRename(t.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(t.id, e.currentTarget.value);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span className="flex-1 truncate text-sm font-medium text-gray-700">
                    {t.name}
                    <button
                      onClick={() => setEditingId(t.id)}
                      className="ml-1.5 text-gray-400 hover:text-purple-500 transition-colors"
                      title="名前を編集"
                    >
                      <Pencil className="inline h-3 w-3" />
                    </button>
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {new Date(t.createdAt).toLocaleDateString("ja-JP")}
                </span>
                <button
                  onClick={() => handleApplyGemini(t)}
                  className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-700 hover:bg-purple-100"
                  title="Gemini分析に適用"
                >
                  <BrainCircuit className="h-3 w-3" /> Gemini分析に適用
                </button>
                <button
                  onClick={() => handleApplyGenspark(t)}
                  className="inline-flex items-center gap-1 rounded-lg bg-pink-50 px-2 py-1 text-[10px] font-medium text-pink-700 hover:bg-pink-100"
                  title="Genspark設定に適用"
                >
                  <Sparkles className="h-3 w-3" /> Genspark設定に適用
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="rounded p-1 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="rounded p-1 hover:bg-gray-100"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-2 text-xs text-gray-600">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium text-gray-500">分析タイプ:</span> {t.analysisType}
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">ターゲット:</span> {t.gensparkTarget}
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">レベル:</span> {t.gensparkLevel}
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">目的:</span> {t.gensparkPurpose}
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">トーン:</span> {t.gensparkTone}
                    </div>
                  </div>
                  {t.analysisPurpose && (
                    <div>
                      <span className="font-medium text-gray-500">分析目的:</span> {t.analysisPurpose}
                    </div>
                  )}
                  {t.gensparkNotes && (
                    <div>
                      <span className="font-medium text-gray-500">追加要望:</span> {t.gensparkNotes}
                    </div>
                  )}
                  {t.memo && (
                    <div>
                      <span className="font-medium text-gray-500">メモ:</span> {t.memo}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
