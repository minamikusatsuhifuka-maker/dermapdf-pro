"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { BrainCircuit, Copy, Download, Loader2 } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";

export type AnalysisType =
  | "summary"
  | "findings"
  | "ingredients"
  | "care"
  | "patient_consent"
  | "business_strategy"
  | "grade_design"
  | "grade_analyze"
  | "marketing_copy"
  | "staff_guidance"
  | "goal_cheer"
  | "management_plan"
  | "swot"
  | "kpi_plan"
  | "briefing_hr"
  | "briefing_manager"
  | "briefing_staff";

const ANALYSIS_LABELS: Record<AnalysisType, string> = {
  summary: "概要・要約",
  findings: "所見まとめ",
  ingredients: "成分分析",
  care: "ケアプラン",
  patient_consent: "患者同意書生成",
  business_strategy: "経営戦略分析",
  grade_design: "等級制度設計",
  grade_analyze: "等級制度分析",
  marketing_copy: "マーケティングコピー",
  staff_guidance: "スタッフ指導メモ",
  goal_cheer: "目標応援メッセージ",
  management_plan: "経営計画書",
  swot: "SWOT分析",
  kpi_plan: "KPI設計",
  briefing_hr: "人事ブリーフィング",
  briefing_manager: "管理者ブリーフィング",
  briefing_staff: "スタッフブリーフィング",
};

const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
  summary: "この文書の内容を日本語で簡潔に要約してください。",
  findings: "この文書に含まれる医学的所見をまとめてください。",
  ingredients: "この文書に記載されている成分・薬剤を分析してください。",
  care: "この文書に基づいたケアプランを日本語で作成してください。",
  patient_consent: "この文書の内容に基づいて、患者向けの同意書を日本語で作成してください。",
  business_strategy: "この文書を経営戦略の観点から分析し、提言をまとめてください。",
  grade_design: "この文書を参考に等級制度の設計案を提案してください。",
  grade_analyze: "この文書に記載された等級制度を分析し、改善点を提案してください。",
  marketing_copy: "この文書の内容をもとに、マーケティング用のコピーを作成してください。",
  staff_guidance: "この文書に基づいてスタッフ向けの指導メモを作成してください。",
  goal_cheer: "この文書の目標に対する応援・モチベーションメッセージを作成してください。",
  management_plan: "この文書をもとに経営計画書を作成してください。",
  swot: "この文書の内容についてSWOT分析を行ってください。",
  kpi_plan: "この文書に基づいてKPIを設計してください。",
  briefing_hr: "この文書の内容を人事担当者向けにブリーフィングしてください。",
  briefing_manager: "この文書の内容を管理者向けにブリーフィングしてください。",
  briefing_staff: "この文書の内容をスタッフ向けにブリーフィングしてください。",
};

interface GeminiPanelProps {
  fileBase64?: string;
  fileMime?: string;
  fileName?: string;
  onResult?: (result: string) => void;
}

export function GeminiPanel({
  fileBase64,
  fileMime,
  fileName,
  onResult,
}: GeminiPanelProps) {
  const [analysisType, setAnalysisType] = useState<AnalysisType>("summary");
  const [purpose, setPurpose] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!fileBase64 || !fileMime || !fileName) {
      toastError("ファイルが選択されていません");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const basePrompt = ANALYSIS_PROMPTS[analysisType];
      const fullPrompt = purpose
        ? `${basePrompt}\n\n目的: ${purpose}`
        : basePrompt;

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: fileBase64,
          mime: fileMime,
          fileName,
          prompt: fullPrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "分析に失敗しました");

      setResult(data.analysis);
      onResult?.(data.analysis);
      toastOk("AI分析が完了しました");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "分析に失敗しました";
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    toastOk("クリップボードにコピーしました");
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis_${analysisType}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-700">
        <BrainCircuit className="h-5 w-5 text-purple-500" />
        Gemini AI分析
      </h2>

      {/* 分析タイプ選択 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          分析タイプ
        </label>
        <select
          value={analysisType}
          onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
        >
          {(Object.entries(ANALYSIS_LABELS) as [AnalysisType, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </select>
      </div>

      {/* 目的入力 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          目的（任意）
        </label>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="分析の目的や追加の指示を入力..."
          rows={2}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
        />
      </div>

      {/* 実行ボタン */}
      <button
        onClick={handleAnalyze}
        disabled={loading || !fileBase64}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-400 via-rose-500 to-purple-400 px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span>🚀</span>
        )}
        {loading ? "分析中..." : "実行"}
      </button>

      {/* 結果表示 */}
      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-100 bg-white/80 p-4">
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-4 py-2 text-sm font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
            >
              <Copy className="h-3.5 w-3.5" /> コピー
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-4 py-2 text-sm font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
            >
              <Download className="h-3.5 w-3.5" /> テキスト保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
