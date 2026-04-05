"use client";

import { useState } from "react";
import { Presentation, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";

type GensparkPreset =
  | "beauty_menu"
  | "beauty_campaign"
  | "beauty_comparison"
  | "beauty_case"
  | "derm_education"
  | "derm_faq"
  | "derm_guide"
  | "derm_treatment"
  | "biz_strategy"
  | "biz_market"
  | "biz_competitor"
  | "biz_finance"
  | "staff_training"
  | "staff_manual"
  | "staff_evaluation"
  | "staff_recruitment";

const PRESETS: { value: GensparkPreset; label: string; prompt: string }[] = [
  { value: "beauty_menu", label: "美容メニュー紹介", prompt: "以下の情報を元に、美容皮膚科のメニュー紹介プレゼンテーションを作成してください。見栄えの良いスライドデザインで、患者様に訴求力のある内容にしてください。" },
  { value: "beauty_campaign", label: "美容キャンペーン", prompt: "以下の情報を元に、美容皮膚科のキャンペーン告知プレゼンテーションを作成してください。" },
  { value: "beauty_comparison", label: "施術比較資料", prompt: "以下の情報を元に、施術の比較資料プレゼンテーションを作成してください。" },
  { value: "beauty_case", label: "症例紹介", prompt: "以下の情報を元に、症例紹介プレゼンテーションを作成してください。個人情報に配慮した内容にしてください。" },
  { value: "derm_education", label: "皮膚科患者教育", prompt: "以下の情報を元に、皮膚科の患者教育用プレゼンテーションを作成してください。" },
  { value: "derm_faq", label: "皮膚科FAQ", prompt: "以下の情報を元に、皮膚科のよくある質問プレゼンテーションを作成してください。" },
  { value: "derm_guide", label: "診療ガイド", prompt: "以下の情報を元に、診療ガイドのプレゼンテーションを作成してください。" },
  { value: "derm_treatment", label: "治療計画説明", prompt: "以下の情報を元に、治療計画の説明プレゼンテーションを作成してください。" },
  { value: "biz_strategy", label: "経営戦略", prompt: "以下の情報を元に、クリニックの経営戦略プレゼンテーションを作成してください。" },
  { value: "biz_market", label: "市場分析", prompt: "以下の情報を元に、医療市場分析のプレゼンテーションを作成してください。" },
  { value: "biz_competitor", label: "競合分析", prompt: "以下の情報を元に、競合分析のプレゼンテーションを作成してください。" },
  { value: "biz_finance", label: "財務レポート", prompt: "以下の情報を元に、クリニックの財務レポートプレゼンテーションを作成してください。" },
  { value: "staff_training", label: "スタッフ研修", prompt: "以下の情報を元に、スタッフ研修用プレゼンテーションを作成してください。" },
  { value: "staff_manual", label: "業務マニュアル", prompt: "以下の情報を元に、業務マニュアルのプレゼンテーションを作成してください。" },
  { value: "staff_evaluation", label: "評価制度説明", prompt: "以下の情報を元に、評価制度の説明プレゼンテーションを作成してください。" },
  { value: "staff_recruitment", label: "採用説明会", prompt: "以下の情報を元に、採用説明会用プレゼンテーションを作成してください。" },
];

interface GensparkPanelProps {
  analysisResult?: string;
  pdfContent?: string;
}

export function GensparkPanel({
  analysisResult,
  pdfContent,
}: GensparkPanelProps) {
  const [preset, setPreset] = useState<GensparkPreset>("beauty_menu");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const sourceContent = analysisResult || pdfContent || "";

  const handleGenerate = async () => {
    if (!sourceContent) {
      toastError("元となるAI分析結果またはPDFコンテンツがありません");
      return;
    }

    setLoading(true);
    const selected = PRESETS.find((p) => p.value === preset);
    if (!selected) return;

    const prompt = `${selected.prompt}\n\n---\n\n${sourceContent}`;
    setGeneratedPrompt(prompt);
    setLoading(false);
    toastOk("プロンプトを生成しました");
  };

  const handleCopyAndOpen = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    toastOk("コピーしました。Gensparkを開きます...");
    window.open("https://www.genspark.ai", "_blank");
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-700">
        <Presentation className="h-5 w-5 text-[#4f6272]" />
        Genspark プレゼン生成
      </h2>

      {/* プリセット選択 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          プリセット
        </label>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as GensparkPreset)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* 生成ボタン */}
      <button
        onClick={handleGenerate}
        disabled={loading || !sourceContent}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5c7a6e] hover:bg-[#4a6459] px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Presentation className="h-4 w-4" />
        )}
        プロンプト生成
      </button>

      {/* 生成結果 */}
      {generatedPrompt && (
        <div className="space-y-3">
          <textarea
            value={generatedPrompt}
            onChange={(e) => setGeneratedPrompt(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopyAndOpen}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f6272] hover:bg-[#3d5260] px-6 py-3 text-sm font-bold text-white shadow-lg"
            >
              <Copy className="h-4 w-4" /> Gensparkにコピー
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <a
              href="https://www.genspark.ai/ai_slides?tab=explore"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#5c7a6e] hover:bg-[#4a6459] px-4 py-2 text-sm font-semibold text-white transition-opacity"
            >
              Gensparkで資料作成
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
