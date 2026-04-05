"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Play } from "lucide-react";
import type { AnalysisType } from "@/components/ai/gemini-panel";

type WorkflowCategory = "clinical" | "management" | "hr" | "beauty";

interface WorkflowStep {
  title: string;
  description: string;
  analysisType: AnalysisType;
}

interface Workflow {
  id: string;
  title: string;
  category: WorkflowCategory;
  steps: WorkflowStep[];
}

const WORKFLOWS: Workflow[] = [
  // 診療
  {
    id: "clinical-summary",
    title: "診療文書サマリー作成",
    category: "clinical",
    steps: [
      { title: "文書要約", description: "診療文書の内容を要約", analysisType: "summary" },
      { title: "所見抽出", description: "重要な所見を抽出", analysisType: "findings" },
      { title: "ケアプラン作成", description: "ケアプランを自動生成", analysisType: "care_plan" },
    ],
  },
  {
    id: "clinical-consent",
    title: "患者同意書ワークフロー",
    category: "clinical",
    steps: [
      { title: "内容分析", description: "文書内容を分析", analysisType: "summary" },
      { title: "同意書生成", description: "患者同意書を生成", analysisType: "patient_consent" },
    ],
  },
  // 経営
  {
    id: "biz-strategy",
    title: "経営戦略レポート",
    category: "management",
    steps: [
      { title: "概要把握", description: "文書の概要を把握", analysisType: "summary" },
      { title: "SWOT分析", description: "SWOT分析を実施", analysisType: "swot" },
      { title: "戦略提言", description: "経営戦略を提言", analysisType: "business_strategy" },
      { title: "KPI設計", description: "KPIを設計", analysisType: "kpi_plan" },
    ],
  },
  {
    id: "biz-plan",
    title: "経営計画書作成",
    category: "management",
    steps: [
      { title: "現状分析", description: "現状を分析", analysisType: "summary" },
      { title: "経営計画書", description: "計画書を作成", analysisType: "management_plan" },
    ],
  },
  // 人材
  {
    id: "hr-grade",
    title: "等級制度構築",
    category: "hr",
    steps: [
      { title: "現状分析", description: "現制度を分析", analysisType: "grade_analyze" },
      { title: "制度設計", description: "新制度を設計", analysisType: "grade_design" },
      { title: "ブリーフィング", description: "人事向け説明資料", analysisType: "training_summary" },
    ],
  },
  {
    id: "hr-staff",
    title: "スタッフ育成プラン",
    category: "hr",
    steps: [
      { title: "分析", description: "状況を分析", analysisType: "summary" },
      { title: "指導メモ", description: "指導メモを作成", analysisType: "staff_guidance" },
      { title: "目標応援", description: "モチベーション向上", analysisType: "goal_cheer" },
    ],
  },
  // 美容
  {
    id: "beauty-marketing",
    title: "美容マーケティング",
    category: "beauty",
    steps: [
      { title: "成分分析", description: "成分を分析", analysisType: "ingredients" },
      { title: "コピー作成", description: "マーケティングコピー", analysisType: "marketing_copy" },
    ],
  },
  {
    id: "beauty-briefing",
    title: "スタッフ向けブリーフィング",
    category: "beauty",
    steps: [
      { title: "要約", description: "文書を要約", analysisType: "summary" },
      { title: "スタッフ説明", description: "スタッフ向け説明", analysisType: "staff_guidance" },
    ],
  },
];

const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  clinical: "診療",
  management: "経営",
  hr: "人材",
  beauty: "美容",
};

interface WorkflowPanelProps {
  onSelectAnalysisType: (type: AnalysisType) => void;
}

export function WorkflowPanel({ onSelectAnalysisType }: WorkflowPanelProps) {
  const [activeTab, setActiveTab] = useState<WorkflowCategory>("clinical");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = WORKFLOWS.filter((w) => w.category === activeTab);

  return (
    <div className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      <h2 className="text-lg font-bold text-gray-700">ワークフロー</h2>

      {/* タブ */}
      <div className="flex gap-1 rounded-lg bg-gray-100/60 p-1">
        {(Object.entries(CATEGORY_LABELS) as [WorkflowCategory, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setExpandedId(null);
              }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* ワークフローカード */}
      <div className="space-y-2">
        {filtered.map((workflow) => {
          const isExpanded = expandedId === workflow.id;
          return (
            <div
              key={workflow.id}
              className="rounded-xl border border-gray-100 bg-white/60 overflow-hidden"
            >
              {/* ヘッダー */}
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : workflow.id)
                }
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50/50"
              >
                {workflow.title}
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {/* ステップ（アコーディオン） */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                  {workflow.steps.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-gray-50/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#378ADD] text-xs font-bold text-white">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {step.title}
                          </p>
                          <p className="text-xs text-gray-400">
                            {step.description}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          onSelectAnalysisType(step.analysisType)
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1D9E75] hover:bg-[#0F6E56] px-3 py-1 text-xs font-medium text-white shadow-sm"
                      >
                        <Play className="h-3 w-3" /> 実行
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
