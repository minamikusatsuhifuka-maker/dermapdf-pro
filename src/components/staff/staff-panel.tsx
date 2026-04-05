"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Plus, X, Trash2, ChevronDown, ChevronUp, Loader2, Copy, BookmarkPlus, Download } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";
import {
  loadStaffProfiles,
  saveStaffProfile,
  updateStaffProfile,
  deleteStaffProfile,
  loadStaffRecords,
  saveStaffRecord,
  deleteStaffRecord,
  exportStaffAsCSV,
  exportStaffRecordsAsCSV,
  type StaffProfile,
  type StaffRecord,
} from "@/lib/staff-storage";
import { loadAllAnalyses, saveAnalysis, getDisplayTitle, type AnalysisRecord } from "@/lib/analysis-storage";
import { analyzeTextWithGemini } from "@/lib/gemini-client";
import { type ClinicSettings, buildPhilosophyContext } from "@/components/settings/settings-modal";

const NEEDS_OPTIONS = [
  { value: "survival", label: "生存" },
  { value: "love_belonging", label: "愛・所属" },
  { value: "power", label: "力・承認" },
  { value: "freedom", label: "自由" },
  { value: "fun", label: "楽しみ" },
];

const RECORD_TYPE_OPTIONS: { value: StaffRecord["type"]; label: string }[] = [
  { value: "oneon1", label: "1on1記録" },
  { value: "feedback", label: "フィードバック" },
  { value: "goal", label: "目標設定" },
  { value: "memo", label: "メモ" },
  { value: "achievement", label: "達成・表彰" },
];

const selectClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200";

// スタッフ追加/編集フォーム
function StaffForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: StaffProfile;
  onSave: (data: Omit<StaffProfile, "id" | "createdAt">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [role, setRole] = useState(initial?.role || "");
  const [joinDate, setJoinDate] = useState(initial?.joinDate || "");
  const [dominantNeeds, setDominantNeeds] = useState<string[]>(initial?.dominantNeeds || []);
  const [qualityWorld, setQualityWorld] = useState(initial?.qualityWorld || "");
  const [growthMemo, setGrowthMemo] = useState(initial?.growthMemo || "");
  const [currentGoal, setCurrentGoal] = useState(initial?.currentGoal || "");
  const [goalDeadline, setGoalDeadline] = useState(initial?.goalDeadline || "");

  const toggleNeed = (need: string) => {
    setDominantNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) { toastError("名前を入力してください"); return; }
    onSave({ name, role, joinDate, dominantNeeds, qualityWorld, growthMemo, currentGoal, goalDeadline });
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">{initial ? "スタッフ編集" : "スタッフ追加"}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">名前 *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={selectClass} placeholder="山田 花子" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">役職</label>
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} className={selectClass} placeholder="受付リーダー" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">入社日</label>
          <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className={selectClass} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">優位な欲求</label>
        <div className="flex flex-wrap gap-2">
          {NEEDS_OPTIONS.map((n) => (
            <button
              key={n.value}
              onClick={() => toggleNeed(n.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                dominantNeeds.includes(n.value)
                  ? "bg-[#4f6272] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">上質世界メモ</label>
        <textarea value={qualityWorld} onChange={(e) => setQualityWorld(e.target.value)} rows={2} className={selectClass} placeholder="この人が大切にしていること..." />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">成長・特性メモ</label>
        <textarea value={growthMemo} onChange={(e) => setGrowthMemo(e.target.value)} rows={2} className={selectClass} placeholder="得意なこと、課題など..." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">現在の目標</label>
          <input type="text" value={currentGoal} onChange={(e) => setCurrentGoal(e.target.value)} className={selectClass} placeholder="接遇スコア90点以上" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">目標期限</label>
          <input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} className={selectClass} />
        </div>
      </div>
      <button onClick={handleSubmit} className="w-full rounded-lg bg-[#4f6272] hover:bg-[#3d5260] px-4 py-2 text-sm font-bold text-white">
        {initial ? "更新" : "追加"}
      </button>
    </div>
  );
}

// スタッフカルテモーダル
function StaffKarteModal({
  staff,
  clinicSettings,
  onClose,
  onUpdate,
}: {
  staff: StaffProfile;
  clinicSettings?: ClinicSettings;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"records" | "profile" | "goals">("records");
  const [records, setRecords] = useState<StaffRecord[]>([]);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [editing, setEditing] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // 記録追加フォーム
  const [recordType, setRecordType] = useState<StaffRecord["type"]>("oneon1");
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split("T")[0]);
  const [recordContent, setRecordContent] = useState("");
  const [recordAnalysisId, setRecordAnalysisId] = useState("");

  const analyses = loadAllAnalyses();
  const philosophyContext = clinicSettings ? buildPhilosophyContext(clinicSettings) : "";

  const reloadRecords = useCallback(() => {
    setRecords(loadStaffRecords(staff.id));
  }, [staff.id]);

  useEffect(() => {
    reloadRecords();
  }, [reloadRecords]);

  const handleAddRecord = () => {
    if (!recordContent.trim()) { toastError("内容を入力してください"); return; }
    const typeLabel = RECORD_TYPE_OPTIONS.find((o) => o.value === recordType)?.label || recordType;
    saveStaffRecord({
      staffId: staff.id,
      date: recordDate,
      type: recordType,
      typeLabel,
      content: recordContent,
      analysisId: recordAnalysisId || undefined,
    });
    setRecordContent("");
    setRecordAnalysisId("");
    setShowAddRecord(false);
    reloadRecords();
    toastOk("記録を追加しました");
  };

  const handleDeleteRecord = (id: string) => {
    deleteStaffRecord(id);
    reloadRecords();
    toastOk("記録を削除しました");
  };

  const needsLabels = staff.dominantNeeds
    .map((n) => NEEDS_OPTIONS.find((o) => o.value === n)?.label || n)
    .join("、");

  const recentRecordsSummary = records
    .slice(0, 5)
    .map((r) => `【${r.typeLabel}】${r.date}: ${r.content.slice(0, 100)}`)
    .join("\n");

  const handleGenerate1on1 = async () => {
    setAiLoading(true);
    setAiResult("");
    try {
      const prompt = `以下のスタッフ情報をもとに、リードマネジメント型の1on1面談アジェンダを作成してください。

【スタッフ名】${staff.name}
【役職】${staff.role}
【優位な欲求】${needsLabels || "未設定"}
【上質世界】${staff.qualityWorld || "未設定"}
【現在の目標】${staff.currentGoal || "未設定"}（期限: ${staff.goalDeadline || "未設定"}）
【成長メモ】${staff.growthMemo || "未設定"}

【最近の記録】
${recentRecordsSummary || "記録なし"}

${philosophyContext}

以下の形式で出力してください：
## アイスブレイク（承認・ねぎらいの言葉）
## 前回からの振り返り（気づきを問う）
## 今回のテーマ
## リードマネジメント的な問いかけ5選
## 次回までのアクション（本人が決める）`;

      const data = await analyzeTextWithGemini(prompt);
      if (!data.success) throw new Error(data.error);
      setAiResult(data.analysis);
      toastOk("1on1アジェンダを生成しました");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateCheer = async () => {
    setAiLoading(true);
    setAiResult("");
    try {
      const prompt = `以下のスタッフ情報をもとに、選択理論的な目標応援メッセージを作成してください。

【スタッフ名】${staff.name}
【役職】${staff.role}
【優位な欲求】${needsLabels || "未設定"}
【上質世界】${staff.qualityWorld || "未設定"}
【現在の目標】${staff.currentGoal || "未設定"}（期限: ${staff.goalDeadline || "未設定"}）
【成長メモ】${staff.growthMemo || "未設定"}

${philosophyContext}

個人の成長を承認し、チームの目標達成に向けた前向きなメッセージを3パターン出力してください。
外部からの強制ではなく、本人の内発的動機を引き出す視点で書いてください。`;

      const data = await analyzeTextWithGemini(prompt);
      if (!data.success) throw new Error(data.error);
      setAiResult(data.analysis);
      toastOk("応援メッセージを生成しました");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAiToStock = () => {
    saveAnalysis({
      fileName: `${staff.name}のAI生成結果`,
      analysisType: "staff_ai",
      analysisLabel: "スタッフAI生成",
      content: aiResult,
      tags: ["スタッフカルテ", staff.name],
      folder: "",
    });
    toastOk("ストックに保存しました");
  };

  const handleCopyAi = async () => {
    await navigator.clipboard.writeText(aiResult);
    toastOk("コピーしました");
  };

  const tabs = [
    { id: "records" as const, label: "記録一覧" },
    { id: "profile" as const, label: "プロフィール" },
    { id: "goals" as const, label: "目標管理" },
  ];

  const typeColorMap: Record<string, string> = {
    oneon1: "bg-blue-100 text-blue-700",
    feedback: "bg-green-100 text-green-700",
    goal: "bg-amber-100 text-amber-700",
    memo: "bg-gray-100 text-gray-600",
    achievement: "bg-pink-100 text-pink-700",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>

        {/* ヘッダー */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-700">{staff.name}</h2>
          <p className="text-sm text-gray-500">
            {staff.role && <span>{staff.role} ・ </span>}
            {staff.joinDate && <span>入社: {staff.joinDate}</span>}
          </p>
          {staff.dominantNeeds.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {staff.dominantNeeds.map((n) => (
                <span key={n} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                  {NEEDS_OPTIONS.find((o) => o.value === n)?.label || n}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => setEditing(true)}
            className="mt-2 text-xs text-slate-500 hover:underline"
          >
            プロフィールを編集
          </button>
        </div>

        {editing && (
          <div className="mb-4">
            <StaffForm
              initial={staff}
              onSave={(data) => {
                updateStaffProfile(staff.id, data);
                onUpdate();
                setEditing(false);
                toastOk("更新しました");
              }}
              onClose={() => setEditing(false)}
            />
          </div>
        )}

        {/* タブ */}
        <div className="mb-4 flex gap-1 border-b">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === t.id
                  ? "border-b-2 border-[#4f6272] text-slate-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 記録一覧タブ */}
        {activeTab === "records" && (
          <div className="space-y-3">
            <button
              onClick={() => setShowAddRecord(!showAddRecord)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-3 w-3" /> 記録を追加
            </button>

            {showAddRecord && (
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">種別</label>
                    <select value={recordType} onChange={(e) => setRecordType(e.target.value as StaffRecord["type"])} className={selectClass}>
                      {RECORD_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">日付</label>
                    <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className={selectClass} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">内容</label>
                  <textarea value={recordContent} onChange={(e) => setRecordContent(e.target.value)} rows={3} className={selectClass} placeholder="記録内容を入力..." />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">ストック分析と紐付け（任意）</label>
                  <select value={recordAnalysisId} onChange={(e) => setRecordAnalysisId(e.target.value)} className={selectClass}>
                    <option value="">-- 選択しない --</option>
                    {analyses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {getDisplayTitle(a)}（{a.analysisLabel}）
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={handleAddRecord} className="w-full rounded-lg bg-[#4f6272] px-3 py-2 text-xs font-bold text-white">
                  保存
                </button>
              </div>
            )}

            {records.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">まだ記録がありません</p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white p-3">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColorMap[r.type] || "bg-gray-100 text-gray-600"}`}>
                      {r.typeLabel}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">{r.date}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
                      {r.analysisId && (
                        <p className="mt-1 text-[10px] text-slate-500">
                          紐付き分析: {getDisplayTitle(analyses.find((a) => a.id === r.analysisId) as AnalysisRecord) || r.analysisId}
                        </p>
                      )}
                    </div>
                    <button onClick={() => handleDeleteRecord(r.id)} className="shrink-0 rounded p-1 hover:bg-red-50">
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* AI活用ボタン */}
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <button
                onClick={handleGenerate1on1}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#4f6272] hover:bg-[#3d5260] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                1on1アジェンダをAIで生成
              </button>
              <button
                onClick={handleGenerateCheer}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#5c7a6e] hover:bg-[#4a6459] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                目標応援メッセージを生成
              </button>
            </div>

            {aiResult && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
                <div className="prose prose-sm max-w-none text-gray-700">
                  <ReactMarkdown>{aiResult}</ReactMarkdown>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopyAi} className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80">
                    <Copy className="h-3 w-3" /> コピー
                  </button>
                  <button onClick={handleSaveAiToStock} className="inline-flex items-center gap-1 rounded-lg bg-[#4f6272] hover:bg-[#3d5260] px-3 py-1.5 text-xs font-medium text-white shadow-sm">
                    <BookmarkPlus className="h-3 w-3" /> ストックに保存
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* プロフィールタブ */}
        {activeTab === "profile" && (
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-500">優位な欲求</h4>
              {staff.dominantNeeds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {staff.dominantNeeds.map((n) => (
                    <span key={n} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {NEEDS_OPTIONS.find((o) => o.value === n)?.label || n}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">未設定</p>
              )}
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-500">上質世界メモ</h4>
              <p className="whitespace-pre-wrap">{staff.qualityWorld || "未設定"}</p>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-500">成長・特性メモ</h4>
              <p className="whitespace-pre-wrap">{staff.growthMemo || "未設定"}</p>
            </div>
          </div>
        )}

        {/* 目標管理タブ */}
        {activeTab === "goals" && (
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-500">現在の目標</h4>
              <p>{staff.currentGoal || "未設定"}</p>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-500">目標期限</h4>
              <p>{staff.goalDeadline || "未設定"}</p>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold text-gray-500">目標関連の記録</h4>
              {records.filter((r) => r.type === "goal" || r.type === "achievement").length === 0 ? (
                <p className="text-xs text-gray-400">目標関連の記録はありません</p>
              ) : (
                <div className="space-y-2">
                  {records
                    .filter((r) => r.type === "goal" || r.type === "achievement")
                    .map((r) => (
                      <div key={r.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColorMap[r.type]}`}>
                          {r.typeLabel}
                        </span>
                        <p className="mt-1 text-xs text-gray-400">{r.date}</p>
                        <p className="text-sm whitespace-pre-wrap">{r.content}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// メインパネル
interface StaffPanelProps {
  clinicSettings?: ClinicSettings;
}

export function StaffPanel({ clinicSettings }: StaffPanelProps) {
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setProfiles(loadStaffProfiles());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("staffUpdated", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("staffUpdated", reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  const handleAdd = (data: Omit<StaffProfile, "id" | "createdAt">) => {
    saveStaffProfile(data);
    setShowAddForm(false);
    reload();
    toastOk("スタッフを追加しました");
  };

  const handleDelete = (id: string) => {
    deleteStaffProfile(id);
    reload();
    toastOk("スタッフを削除しました");
  };

  const selectedStaff = profiles.find((p) => p.id === selectedStaffId);

  return (
    <div id="staff-panel" className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">
          スタッフカルテ ({profiles.length}人)
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => exportStaffAsCSV()}
            disabled={profiles.length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80 disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> スタッフCSV
          </button>
          <button
            onClick={() => exportStaffRecordsAsCSV()}
            disabled={profiles.length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80 disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> 記録CSV
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <Plus className="h-3 w-3" /> スタッフを追加
          </button>
        </div>
      </div>

      {showAddForm && (
        <StaffForm onSave={handleAdd} onClose={() => setShowAddForm(false)} />
      )}

      {profiles.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          スタッフが登録されていません
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-100 bg-white/60 p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-700">{p.name}</h3>
                  <p className="text-xs text-gray-500">
                    {p.role && <span>{p.role}</span>}
                    {p.joinDate && <span> ・ 入社: {p.joinDate}</span>}
                  </p>
                </div>
                <button onClick={() => handleDelete(p.id)} className="rounded p-1 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
              {p.dominantNeeds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.dominantNeeds.map((n) => (
                    <span key={n} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      {NEEDS_OPTIONS.find((o) => o.value === n)?.label || n}
                    </span>
                  ))}
                </div>
              )}
              {p.currentGoal && (
                <p className="text-xs text-gray-600">
                  目標: {p.currentGoal}
                  {p.goalDeadline && <span className="text-gray-400"> （期限: {p.goalDeadline}）</span>}
                </p>
              )}
              <button
                onClick={() => setSelectedStaffId(p.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#4f6272] hover:bg-[#3d5260] px-3 py-1.5 text-xs font-bold text-white"
              >
                カルテを開く
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedStaff && (
        <StaffKarteModal
          staff={selectedStaff}
          clinicSettings={clinicSettings}
          onClose={() => setSelectedStaffId(null)}
          onUpdate={() => {
            reload();
            // 更新後のprofileを再取得してモーダルに反映
            const updated = loadStaffProfiles().find((p) => p.id === selectedStaffId);
            if (!updated) setSelectedStaffId(null);
          }}
        />
      )}
    </div>
  );
}
