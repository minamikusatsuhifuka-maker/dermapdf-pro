"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Download, Loader2, BookmarkPlus, Sparkles } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";
import { loadAllAnalyses, saveAnalysis, getDisplayTitle } from "@/lib/analysis-storage";
import { analyzeTextWithGemini } from "@/lib/gemini-client";
import { type ClinicSettings, buildPhilosophyContext } from "@/components/settings/settings-modal";

type PeriodType = "this_week" | "this_month" | "last_month" | "last_3_months" | "all";
type ReportType = "learning" | "business" | "comprehensive";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "this_week", label: "今週" },
  { value: "this_month", label: "今月" },
  { value: "last_month", label: "先月" },
  { value: "last_3_months", label: "過去3ヶ月" },
  { value: "all", label: "全期間" },
];

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "learning", label: "学習・育成レポート" },
  { value: "business", label: "経営分析レポート" },
  { value: "comprehensive", label: "総合レポート" },
];

function getDateRange(period: PeriodType): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;

  switch (period) {
    case "this_week": {
      startDate = new Date(now);
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - (day === 0 ? 6 : day - 1));
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case "this_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setTime(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime());
      break;
    case "last_3_months":
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case "all":
      startDate = new Date(0);
      break;
  }

  return { startDate, endDate };
}

function buildSummaryData(
  period: PeriodType
): { summary: string; count: number } {
  const records = loadAllAnalyses();
  const { startDate, endDate } = getDateRange(period);

  const filtered = records.filter((r) => {
    const date = new Date(r.createdAt);
    return date >= startDate && date <= endDate;
  });

  if (filtered.length === 0) {
    return { summary: "", count: 0 };
  }

  // 分析タイプ別件数
  const typeCounts = new Map<string, number>();
  filtered.forEach((r) => {
    typeCounts.set(r.analysisLabel, (typeCounts.get(r.analysisLabel) || 0) + 1);
  });

  // フォルダ別件数
  const folderCounts = new Map<string, number>();
  filtered.forEach((r) => {
    const folder = r.folder || "未分類";
    folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
  });

  // よく使ったタグTop5
  const tagCounts = new Map<string, number>();
  filtered.forEach((r) => {
    (r.tags || []).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 各分析の概要
  const analysisEntries = filtered
    .map(
      (r) =>
        `- 【${r.analysisLabel}】${getDisplayTitle(r)}（${new Date(r.createdAt).toLocaleDateString("ja-JP")}）\n  ${r.content.slice(0, 100)}...`
    )
    .join("\n");

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period;

  const summary = `【対象期間】${periodLabel}（${filtered.length}件の分析）

【分析タイプ別件数】
${Array.from(typeCounts.entries())
  .map(([type, count]) => `- ${type}: ${count}件`)
  .join("\n")}

【フォルダ別件数】
${Array.from(folderCounts.entries())
  .map(([folder, count]) => `- ${folder}: ${count}件`)
  .join("\n")}

【よく使ったタグTop5】
${topTags.length > 0 ? topTags.map(([tag, count]) => `- ${tag}: ${count}回`).join("\n") : "- タグなし"}

【各分析の概要】
${analysisEntries}`;

  return { summary, count: filtered.length };
}

function getReportPrompt(reportType: ReportType, summaryData: string, philosophyContext: string): string {
  const learningPrompt = `以下は指定期間中に行ったAI分析の記録です。
この期間の人材育成・学習活動を振り返り、以下の形式でレポートを作成してください。

${summaryData}

${philosophyContext}

## 期間サマリー
（件数・傾向の概要）

## 今期の学習・育成のハイライト
（特に重要だった分析・気づき）

## 見えてきた課題と改善提案
（リードマネジメントの観点から）

## 次期に向けたアクション提案
（具体的な3〜5つのアクション）

## 成長の軌跡
（この期間でチーム・個人がどう成長したか）`;

  const businessPrompt = `以下は指定期間中に行ったAI分析の記録です。
経営・戦略の観点でこの期間を振り返り、以下の形式でレポートを作成してください。

${summaryData}

${philosophyContext}

## 経営活動サマリー
## 今期の重点取り組みと成果
## リスクと課題
## 次期優先アクション（KPI付き）
## 成長指標の推移`;

  const comprehensivePrompt = `以下は指定期間中に行ったAI分析の記録です。
学習・育成と経営・戦略の両面からこの期間を包括的に振り返り、以下の形式でレポートを作成してください。

${summaryData}

${philosophyContext}

## 期間サマリー
（件数・傾向の概要）

## 学習・育成のハイライト
（特に重要だった分析・気づき）

## 経営活動の重点取り組みと成果

## 見えてきた課題と改善提案
（リードマネジメントの観点から）

## リスクと課題

## 次期に向けたアクション提案
（具体的な3〜5つのアクション、KPI付き）

## 成長の軌跡
（この期間でチーム・個人がどう成長したか）

## 成長指標の推移`;

  switch (reportType) {
    case "learning":
      return learningPrompt;
    case "business":
      return businessPrompt;
    case "comprehensive":
      return comprehensivePrompt;
  }
}

interface MonthlyReportPanelProps {
  clinicSettings?: ClinicSettings;
}

export function MonthlyReportPanel({ clinicSettings }: MonthlyReportPanelProps) {
  const [period, setPeriod] = useState<PeriodType>("this_month");
  const [reportType, setReportType] = useState<ReportType>("learning");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const philosophyContext = clinicSettings ? buildPhilosophyContext(clinicSettings) : "";

  const selectClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200";

  const handleGenerate = async () => {
    const { summary, count } = buildSummaryData(period);
    if (count === 0) {
      toastError("対象期間に保存された分析がありません。先にAI分析を行い、ストックに保存してください。");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const prompt = getReportPrompt(reportType, summary, philosophyContext);
      const data = await analyzeTextWithGemini(prompt);
      if (!data.success) throw new Error(data.error || "レポート生成に失敗しました");
      setResult(data.analysis);
      toastOk("レポートを生成しました");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "レポート生成に失敗しました");
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
    a.download = `report_${reportType}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToStock = () => {
    const reportLabel = REPORT_TYPE_OPTIONS.find((r) => r.value === reportType)?.label ?? reportType;
    const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period;
    saveAnalysis({
      fileName: `${reportLabel}（${periodLabel}）`,
      analysisType: "report",
      analysisLabel: reportLabel,
      content: result,
      tags: ["レポート", periodLabel],
      folder: "",
    });
    toastOk("ストックに保存しました");
  };

  const handleToGenspark = () => {
    window.dispatchEvent(
      new CustomEvent("reportToGenspark", { detail: { content: result } })
    );
    toastOk("Gensparkへ内容を送りました");
  };

  return (
    <div
      id="report-panel"
      className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl"
    >
      <h2 className="text-lg font-bold text-gray-700">
        定期レポート生成
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">
            対象期間
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodType)}
            className={selectClass}
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">
            レポート種別
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className={selectClass}
          >
            {REPORT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span>📊</span>
        )}
        {loading ? "生成中..." : "レポートを生成"}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-100 bg-white/80 p-4">
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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
            <button
              onClick={handleSaveToStock}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-400 to-purple-400 px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              <BookmarkPlus className="h-3.5 w-3.5" /> ストックに保存
            </button>
            <button
              onClick={handleToGenspark}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" /> Gensparkでスライド化
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
