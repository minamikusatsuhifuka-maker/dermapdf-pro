"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Trash2, Download, Search, ChevronDown, ChevronUp, Sparkles, ExternalLink, X, Loader2, Tag, FolderOpen, Plus, Save, Pencil, User } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";
import { appendToMemoSheet, loadMemoSheets } from "@/lib/memo-storage";
import MemoPadPanel from "@/components/stock/memo-pad-panel";
import {
  loadAllAnalyses,
  saveAnalysis,
  deleteAnalysis,
  clearAllAnalyses,
  exportAnalysesAsJSON,
  exportAnalysesAsText,
  exportAnalysesAsDocx,
  exportAnalysesAsPdf,
  exportSingleAnalysisAsMarkdown,
  exportSingleAnalysisAsPdf,
  bulkExportAsMarkdown,
  bulkExportAsText,
  bulkExportAsPdf,
  updateAnalysisTitle,
  updateAnalysisTags,
  updateAnalysisContent,
  revertAnalysisContent,
  getDisplayTitle,
  getTagsWithCount,
  renameFolder,
  toggleLock,
  duplicateAnalysis,
  bulkToggleLock,
  hasDeletePassword,
  verifyDeletePassword,
  buildFolderTree,
  getFlatFolderList,
  getFolderName,
  type AnalysisRecord,
  type FolderNode,
} from "@/lib/analysis-storage";
import { loadStaffProfiles, saveStaffRecord, type StaffProfile } from "@/lib/staff-storage";
import {
  TARGET_OPTIONS,
  LEVEL_OPTIONS,
  PURPOSE_OPTIONS,
  TONE_OPTIONS,
  getTechniqueFlags,
  generateGensparkPrompt,
} from "@/lib/genspark-prompt-generator";

const selectClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]";

const DEFAULT_FOLDERS = ["人材育成", "採用", "マニュアル", "リスク管理", "等級・評価", "経営戦略", "その他"];
const LOCK_FOLDER = "🔒 ロック済み";
const CUSTOM_FOLDERS_KEY = "dermapdf_custom_folders";
const FOLDER_ORDER_KEY = "dermapdf_folder_order";

function saveFolderOrder(order: string[]): void {
  localStorage.setItem(FOLDER_ORDER_KEY, JSON.stringify(order));
}

function loadFolderOrder(): string[] | null {
  try {
    const stored = localStorage.getItem(FOLDER_ORDER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function FolderTreeItem({
  node,
  activeFolder,
  onSelect,
  onAddSubfolder,
  onEdit,
  onDelete,
  editingFolderId,
  onRename,
  setEditingFolderId,
  folderFontSize,
}: {
  node: FolderNode;
  activeFolder: string | null;
  onSelect: (folder: string | null) => void;
  onAddSubfolder: (parentPath: string) => void;
  onEdit?: (folder: string) => void;
  onDelete?: (folder: string) => void;
  editingFolderId: string | null;
  onRename: (oldName: string, newName: string) => void;
  setEditingFolderId: (id: string | null) => void;
  folderFontSize: number;
}) {
  const [isOpen, setIsOpen] = useState(
    activeFolder === node.path || (activeFolder || "").startsWith(node.path + "/")
  );
  const hasChildren = node.children.length > 0;
  const isActive = activeFolder === node.path;
  const isEditing = editingFolderId === node.path;

  useEffect(() => {
    if (activeFolder === node.path || (activeFolder || "").startsWith(node.path + "/")) {
      setIsOpen(true);
    }
  }, [activeFolder, node.path]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          defaultValue={node.name}
          autoFocus
          className="w-24 rounded-full border border-[#378ADD] px-2 py-1 text-xs outline-none"
          onBlur={(e) => {
            const parent = node.path.includes("/") ? node.path.substring(0, node.path.lastIndexOf("/")) + "/" : "";
            onRename(node.path, parent + e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const parent = node.path.includes("/") ? node.path.substring(0, node.path.lastIndexOf("/")) + "/" : "";
              onRename(node.path, parent + e.currentTarget.value);
            }
            if (e.key === "Escape") setEditingFolderId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 w-full">
      {hasChildren && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-400 hover:text-gray-600 text-xs w-4 flex-shrink-0"
        >
          {isOpen ? "▾" : "▸"}
        </button>
      )}
      {!hasChildren && <span className="w-4 flex-shrink-0" />}

      <button
        onClick={() => onSelect(isActive ? null : node.path)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors flex-shrink-0 ${
          isActive
            ? "bg-[#378ADD] text-white border border-[#378ADD]"
            : node.totalCount === 0
              ? "bg-[#F0F7FD] text-[#7BAED4] border border-[#D4E8F7]"
              : "bg-[#E6F1FB] text-[#185FA5] border border-[#B5D4F4] hover:bg-[#d0e8f8] hover:border-[#85B7EB]"
        }`}
        style={{ fontSize: `${folderFontSize}px` }}
      >
        <span>{node.name}</span>
        <span className={`text-[10px] px-1 py-0.5 rounded-full font-bold ${
          isActive ? "bg-white/25 text-white" : "bg-[#B5D4F4] text-[#185FA5]"
        }`}>
          {node.totalCount}
        </span>
        {node.children.length > 0 && (
          <span
            className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              isActive ? "bg-white/20 text-white" : "bg-[#dbeafe] text-[#1d4ed8]"
            }`}
            title={`サブフォルダ ${node.children.length}個`}
          >
            <span>📁</span>
            <span>{node.children.length}</span>
          </span>
        )}
      </button>

      {hasChildren && isOpen && (
        <>
          <span className="text-gray-200 text-sm flex-shrink-0">|</span>
          {node.children.map((child) => {
            const childActive = activeFolder === child.path;
            const childEditing = editingFolderId === child.path;

            if (childEditing) {
              return (
                <input
                  key={child.path}
                  type="text"
                  defaultValue={child.name}
                  autoFocus
                  className="w-20 rounded-full border border-[#378ADD] px-2 py-0.5 text-xs outline-none"
                  onBlur={(e) => {
                    const parent = child.path.substring(0, child.path.lastIndexOf("/")) + "/";
                    onRename(child.path, parent + e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const parent = child.path.substring(0, child.path.lastIndexOf("/")) + "/";
                      onRename(child.path, parent + e.currentTarget.value);
                    }
                    if (e.key === "Escape") setEditingFolderId(null);
                  }}
                />
              );
            }

            return (
              <div key={child.path} className="inline-flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => onSelect(childActive ? null : child.path)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-colors flex-shrink-0 ${
                    childActive
                      ? "bg-[#1D9E75] text-white border border-[#1D9E75]"
                      : child.totalCount === 0
                        ? "bg-[#F0FAF5] text-[#6DB89A] border border-[#C5E8D8]"
                        : "bg-[#E1F5EE] text-[#0F6E56] border border-[#9FE1CB] hover:bg-[#c8ede2] hover:border-[#5DCAA5]"
                  }`}
                  style={{ fontSize: `${folderFontSize}px` }}
                >
                  <span>{child.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    childActive ? "bg-white/25 text-white" : "bg-[#9FE1CB] text-[#0F6E56]"
                  }`}>
                    {child.totalCount}
                  </span>
                  {child.children.length > 0 && (
                    <span className="text-[9px]">▸</span>
                  )}
                </button>
                {child.isCustom && (
                  <>
                    <button
                      onClick={() => onEdit?.(child.path)}
                      className="text-gray-300 hover:text-[#378ADD] transition-colors"
                      title="名前変更"
                    >
                      <Pencil className="h-2 w-2" />
                    </button>
                    <button
                      onClick={() => {
                        const count = child.totalCount;
                        const msg = count > 0
                          ? `「${child.name}」を削除しますか？\n\nこのサブフォルダ内の${count}件のカードはフォルダなし（未分類）に移動されます。`
                          : `「${child.name}」を削除しますか？`;
                        if (window.confirm(msg)) {
                          onDelete?.(child.path);
                        }
                      }}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                      title="削除"
                    >
                      <Trash2 className="h-2 w-2" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}

      <button
        onClick={() => onAddSubfolder(node.path)}
        className="text-gray-300 hover:text-[#378ADD] text-xs px-1 flex-shrink-0 transition-colors"
        title={`「${node.name}」にサブフォルダを追加`}
      >
        +
      </button>

      {node.isCustom && (
        <>
          <button
            onClick={() => onEdit?.(node.path)}
            className="rounded p-0.5 text-gray-400 hover:text-[#378ADD] transition-colors flex-shrink-0"
            title="フォルダ名を変更"
          >
            <Pencil className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => {
              const count = node.totalCount;
              const subCount = node.children.length;
              let msg = `「${node.name}」を削除しますか？`;
              if (subCount > 0) msg += `\n\nサブフォルダ${subCount}個も一緒に削除されます。`;
              if (count > 0) msg += `\n\nこのフォルダ内の${count}件のカードはフォルダなし（未分類）に移動されます。`;
              if (window.confirm(msg)) {
                onDelete?.(node.path);
              }
            }}
            className="rounded p-0.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
            title="フォルダを削除"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </>
      )}
    </div>
  );
}

function TagFolderEditor({
  record,
  allFolders,
  folderTree,
  onSave,
  onClose,
}: {
  record: AnalysisRecord;
  allFolders: string[];
  folderTree: FolderNode[];
  onSave: (tags: string[], folder: string) => void;
  onClose: () => void;
}) {
  const [folder, setFolder] = useState(record.folder || "");
  const [tags, setTags] = useState<string[]>(record.tags || []);
  const [tagInput, setTagInput] = useState("");

  const flatFolders = getFlatFolderList(folderTree);

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  return (
    <div className="space-y-3 border-t border-gray-100 bg-gray-50/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <Tag className="h-3.5 w-3.5" /> タグ・フォルダ編集
        </h4>
        <button onClick={onClose} className="rounded p-1 hover:bg-gray-200">
          <X className="h-3 w-3 text-gray-400" />
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">フォルダ</label>
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className={selectClass}
        >
          <option value="">未分類</option>
          {flatFolders.map((f) => (
            <option key={f.path} value={f.path}>{f.displayName}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">タグ</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#E6F1FB] px-2 py-0.5 text-xs text-[#185FA5]">
              {t}
              <button onClick={() => removeTag(t)} className="hover:text-red-500">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTag(); }
            }}
            placeholder="タグを入力（Enterで追加）"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
          />
          <button
            onClick={addTag}
            className="rounded-lg bg-[#E6F1FB] px-3 py-1.5 text-xs font-medium text-[#185FA5] hover:bg-[#E6F1FB]"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      <button
        onClick={() => onSave(tags, folder)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#378ADD] hover:bg-[#185FA5] px-3 py-2 text-xs font-bold text-white shadow-sm"
      >
        <Save className="h-3 w-3" /> 保存
      </button>
    </div>
  );
}

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
    <div className="space-y-3 border-t border-[#B5D4F4] bg-[#E6F1FB]/30 px-4 py-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[#185FA5]">
          <Sparkles className="h-4 w-4" /> Gensparkプロンプト生成
        </h4>
        <button onClick={onClose} className="rounded p-1 hover:bg-[#E6F1FB]">
          <X className="h-3.5 w-3.5 text-[#378ADD]" />
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
              <span className="rounded-full border border-[#B5D4F4] bg-[#E6F1FB] px-2 py-0.5 text-[10px] text-[#185FA5]">感情の動線設計</span>
            )}
            {appliesCatch && (
              <span className="rounded-full border border-[#B5D4F4] bg-[#E6F1FB] px-2 py-0.5 text-[10px] text-[#185FA5]">1スライド1メッセージ</span>
            )}
            {appliesBeforeAfter && (
              <span className="rounded-full border border-[#B5D4F4] bg-[#E6F1FB] px-2 py-0.5 text-[10px] text-[#185FA5]">Before/After比較</span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D9E75] hover:bg-[#0F6E56] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "生成中..." : "プロンプトを生成"}
      </button>

      {prompt && (
        <div className="space-y-2">
          <textarea readOnly value={prompt} rows={8} className="w-full rounded-xl border border-[#B5D4F4] bg-white/80 px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopyAndOpen}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D9E75] hover:bg-[#0F6E56] px-3 py-1.5 text-xs font-medium text-white shadow-sm"
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

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const FLOAT_COLORS = [
  { color: "#e24b4b", label: "赤" },
  { color: "#378ADD", label: "青" },
  { color: "#1D9E75", label: "緑" },
  { color: "#f59e0b", label: "橙" },
];
const FLOAT_HIGHLIGHTS = [
  { color: "#fef08a", label: "黄" },
  { color: "#bae6fd", label: "水" },
  { color: "#fecdd3", label: "桃" },
];

export function AnalysisStockPanel() {
  const [mainTab, setMainTab] = useState<"stock" | "memo">("stock");
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeGensparkId, setActiveGensparkId] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [showTagList, setShowTagList] = useState(false);
  const [staffLinkId, setStaffLinkId] = useState<string | null>(null);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);

  // フォルダ並び替え（D&D）
  const [folderOrder, setFolderOrder] = useState<string[]>([]);
  const [draggingFolder, setDraggingFolder] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const dragFolderRef = useRef<string | null>(null);
  const dragOverFolderRef = useRef<string | null>(null);

  // パスワード確認モーダル
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  // 一括選択
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // フローティングツールバー
  const [floatingToolbar, setFloatingToolbar] = useState<{
    x: number; y: number; height: number; text: string; recordId: string;
  } | null>(null);

  // メモプレビューポップアップ
  const [memoPopup, setMemoPopup] = useState<{
    content: string;
    sheetName: string;
    x: number;
    y: number;
  } | null>(null);

  // contentEditable ref管理（Reactの再レンダリングによるDOM上書き防止）
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // カード高さ・フォントサイズ
  const [fontSize, setFontSize] = useState(13);
  const [folderFontSize, setFolderFontSize] = useState(12);
  const [globalHeight, setGlobalHeight] = useState(240);
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});

  const loadCustomFolders = useCallback((): string[] => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_FOLDERS_KEY) || "[]");
    } catch {
      return [];
    }
  }, []);

  const saveCustomFolders = useCallback((folders: string[]) => {
    localStorage.setItem(CUSTOM_FOLDERS_KEY, JSON.stringify(folders));
    setCustomFolders(folders);
  }, []);

  const reload = useCallback(() => {
    const all = loadAllAnalyses();
    setRecords(all);
    setStaffProfiles(loadStaffProfiles());
    // カスタムフォルダを収集（localStorage + レコードから）
    const saved = loadCustomFolders();
    const existingFolders = new Set(all.map((r) => r.folder).filter(Boolean));
    const fromRecords = Array.from(existingFolders).filter((f) => !DEFAULT_FOLDERS.includes(f));
    const merged = Array.from(new Set([...saved, ...fromRecords]));
    setCustomFolders(merged);
  }, [loadCustomFolders]);

  useEffect(() => {
    reload();
    window.addEventListener("storage", reload);
    window.addEventListener("analysisStockUpdated", reload);
    window.addEventListener("staffUpdated", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("analysisStockUpdated", reload);
      window.removeEventListener("staffUpdated", reload);
    };
  }, [reload]);

  // フォルダ順序をlocalStorageから復元
  useEffect(() => {
    const savedOrder = loadFolderOrder();
    if (savedOrder) setFolderOrder(savedOrder);
  }, []);

  // フォントサイズをlocalStorageから復元・保存
  useEffect(() => {
    const saved = localStorage.getItem("dermapdf_stock_fontsize");
    if (saved) setFontSize(Number(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("dermapdf_stock_fontsize", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    const saved = localStorage.getItem("dermapdf_folder_fontsize");
    if (saved) setFolderFontSize(Number(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("dermapdf_folder_fontsize", String(folderFontSize));
  }, [folderFontSize]);

  const setCardHeight = (id: string, h: number) => {
    setContentHeights((prev) => ({ ...prev, [id]: h }));
  };

  // 展開コンテンツ上の mouseup でフローティングツールバーを表示
  const handleContentMouseUp = useCallback((e: React.MouseEvent, recordId: string) => {
    e.stopPropagation();
    e.preventDefault(); // デフォルト動作を止める

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (text.length < 2) return;

    const x = e.clientX;
    const y = e.clientY;

    const toolbarW = 320;
    let finalX = x;
    if (finalX - toolbarW / 2 < 10) finalX = toolbarW / 2 + 10;
    if (finalX + toolbarW / 2 > window.innerWidth - 10) finalX = window.innerWidth - toolbarW / 2 - 10;

    setFloatingToolbar({ x: finalX, y, height: 0, text, recordId });
  }, []);

  // ツールバー外のクリックで閉じる（ツールバー・メモポップアップ自身は除外）
  useEffect(() => {
    const hide = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest("[data-floating-toolbar]")) return;
      if (target.closest("[data-memo-popup]")) return;
      setFloatingToolbar(null);
    };
    document.addEventListener("mousedown", hide);
    return () => document.removeEventListener("mousedown", hide);
  }, []);

  // 書式適用後にコンテンツを保存
  const applyFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (floatingToolbar) {
      const el = document.querySelector(`[data-record-id="${floatingToolbar.recordId}"]`);
      if (el) {
        updateAnalysisContent(floatingToolbar.recordId, el.innerHTML);
      }
    }
  }, [floatingToolbar]);

  // contentEditable の onInput を debounce で自動保存
  const debouncedSave = useMemo(
    () => debounce((id: string, html: string) => {
      updateAnalysisContent(id, html);
    }, 500),
    []
  );

  const allFolders = Array.from(new Set([...DEFAULT_FOLDERS, ...customFolders]));

  // フォルダツリー構築
  const folderTree = useMemo(() => buildFolderTree(records, customFolders), [records, customFolders]);

  // 全フォルダリストを順序に従って並び替え（すべて・ロック済みは固定）
  const orderedFolders = useMemo(() => {
    const draggable = [...allFolders];
    if (folderOrder.length === 0) return ["すべて", LOCK_FOLDER, ...draggable];
    const ordered = folderOrder.filter((f) => draggable.includes(f));
    const newFolders = draggable.filter((f) => !folderOrder.includes(f));
    return ["すべて", LOCK_FOLDER, ...ordered, ...newFolders];
  }, [folderOrder, allFolders]);

  // ドラッグイベントハンドラ
  const handleFolderDragStart = (folder: string) => {
    dragFolderRef.current = folder;
    setDraggingFolder(folder);
  };

  const handleFolderDragOver = (e: React.DragEvent, folder: string) => {
    e.preventDefault();
    dragOverFolderRef.current = folder;
    setDragOverFolder(folder);
  };

  const handleFolderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragFolderRef.current;
    const to = dragOverFolderRef.current;
    if (!from || !to || from === to) return;

    // 固定フォルダを除いた並び順で操作
    const draggableOrder = orderedFolders.filter((f) => f !== "すべて" && f !== LOCK_FOLDER);
    const fromIdx = draggableOrder.indexOf(from);
    const toIdx = draggableOrder.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return;
    draggableOrder.splice(fromIdx, 1);
    draggableOrder.splice(toIdx, 0, from);

    setFolderOrder(draggableOrder);
    saveFolderOrder(draggableOrder);
    dragFolderRef.current = null;
    dragOverFolderRef.current = null;
    setDraggingFolder(null);
    setDragOverFolder(null);
  };

  const handleFolderDragEnd = () => {
    dragFolderRef.current = null;
    dragOverFolderRef.current = null;
    setDraggingFolder(null);
    setDragOverFolder(null);
  };

  // フォルダごとの件数を計算
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      const folder = r.folder || "";
      if (folder) {
        counts[folder] = (counts[folder] || 0) + 1;
      }
    });
    counts[LOCK_FOLDER] = records.filter((r) => r.locked).length;
    return counts;
  }, [records]);

  // フォルダフィルタ + 検索フィルタ（サブフォルダも含む）
  const folderFiltered = activeFolder === LOCK_FOLDER
    ? records.filter((r) => r.locked)
    : activeFolder
      ? records.filter((r) => r.folder === activeFolder || (r.folder || "").startsWith(activeFolder + "/"))
      : records;

  const filtered = search
    ? folderFiltered.filter((r) => {
        const q = search.toLowerCase();
        return (
          getDisplayTitle(r).toLowerCase().includes(q) ||
          r.fileName.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.analysisLabel.toLowerCase().includes(q) ||
          (r.folder || "").toLowerCase().includes(q) ||
          (r.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      })
    : folderFiltered;

  const handleAddFolder = () => {
    const trimmed = newFolderName.trim();
    if (trimmed && !allFolders.includes(trimmed)) {
      saveCustomFolders([...customFolders, trimmed]);
    }
    setNewFolderName("");
    setShowAddFolder(false);
  };

  const handleAddSubfolder = (parentPath: string) => {
    const name = prompt(`「${getFolderName(parentPath)}」にサブフォルダ名を入力：`);
    if (!name?.trim()) return;
    const newPath = `${parentPath}/${name.trim()}`;
    if (!customFolders.includes(newPath)) {
      saveCustomFolders([...customFolders, newPath]);
    }
    setActiveFolder(newPath);
  };

  const handleRenameFolder = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingFolderId(null);
      return;
    }
    renameFolder(oldName, trimmed);
    const updated = customFolders.map((f) => (f === oldName ? trimmed : f));
    saveCustomFolders(updated);
    if (activeFolder === oldName) setActiveFolder(trimmed);
    setEditingFolderId(null);
  };

  const handleDeleteFolder = (path: string) => {
    // カスタムフォルダリストから削除（パス自身とサブフォルダも）
    const updated = customFolders.filter((f) => f !== path && !f.startsWith(path + "/"));
    saveCustomFolders(updated);

    // このフォルダ配下のカードのfolderを''にリセット
    const allRecords = loadAllAnalyses();
    const updatedRecords = allRecords.map((r) => {
      if (r.folder === path || (r.folder || "").startsWith(path + "/")) {
        return { ...r, folder: "" };
      }
      return r;
    });
    localStorage.setItem("dermapdf_analysis_stock", JSON.stringify(updatedRecords));

    // アクティブフォルダが削除対象なら解除
    if (activeFolder === path || (activeFolder || "").startsWith(path + "/")) {
      setActiveFolder(null);
    }

    // 再読み込み
    setRecords(updatedRecords);
  };

  const handleDelete = (record: AnalysisRecord) => {
    if (record.locked) return;
    if (hasDeletePassword()) {
      setPendingDeleteId(record.id);
      setIsBulkDelete(false);
      setPasswordInput("");
      setPasswordError("");
      setShowPasswordModal(true);
    } else {
      if (confirm("削除しますか？")) {
        deleteAnalysis(record.id);
        if (activeGensparkId === record.id) setActiveGensparkId(null);
        reload();
        toastOk("削除しました");
      }
    }
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

  // 一括操作
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const bulkSetFolder = (folder: string) => {
    const count = selectedIds.size;
    Array.from(selectedIds).forEach((id) => {
      const rec = records.find((r) => r.id === id);
      updateAnalysisTags(id, rec?.tags || [], folder);
    });
    setSelectedIds(new Set());
    reload();
    toastOk(`${count}件を「${folder}」フォルダに移動しました`);
  };

  const bulkAddTag = (tag: string) => {
    const count = selectedIds.size;
    Array.from(selectedIds).forEach((id) => {
      const rec = records.find((r) => r.id === id);
      if (!rec) return;
      const currentTags = rec.tags || [];
      if (!currentTags.includes(tag)) {
        updateAnalysisTags(id, [...currentTags, tag], rec.folder || "");
      }
    });
    reload();
    toastOk(`${count}件に「${tag}」タグを追加しました`);
  };

  const bulkDelete = () => {
    const deletableIds = Array.from(selectedIds).filter(
      (id) => !records.find((r) => r.id === id)?.locked
    );
    if (deletableIds.length === 0) {
      toastError("選択中のアイテムは全てロックされています");
      return;
    }
    if (hasDeletePassword()) {
      setIsBulkDelete(true);
      setPendingDeleteId(null);
      setPasswordInput("");
      setPasswordError("");
      setShowPasswordModal(true);
    } else {
      if (confirm(`${deletableIds.length}件を削除しますか？`)) {
        deletableIds.forEach((id) => deleteAnalysis(id));
        setSelectedIds(new Set());
        setActiveGensparkId(null);
        reload();
        toastOk(`${deletableIds.length}件を削除しました`);
      }
    }
  };

  const confirmDelete = () => {
    if (!verifyDeletePassword(passwordInput)) {
      setPasswordError("パスワードが違います");
      setPasswordInput("");
      return;
    }
    if (isBulkDelete) {
      const deletableIds = Array.from(selectedIds).filter(
        (id) => !records.find((r) => r.id === id)?.locked
      );
      deletableIds.forEach((id) => deleteAnalysis(id));
      setSelectedIds(new Set());
      setActiveGensparkId(null);
      reload();
      toastOk(`${deletableIds.length}件を削除しました`);
    } else if (pendingDeleteId) {
      deleteAnalysis(pendingDeleteId);
      if (activeGensparkId === pendingDeleteId) setActiveGensparkId(null);
      reload();
      toastOk("削除しました");
    }
    setShowPasswordModal(false);
    setPasswordInput("");
    setPendingDeleteId(null);
  };

  return (
    <div
      id="analysis-stock"
      className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl"
    >
      {/* タイトル行 */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-700">
          保存済み分析 ({records.length}件)
        </h2>
      </div>

      {/* メインタブ */}
      <div className="flex gap-2 border-b border-gray-100 mb-4">
        <button
          onClick={() => setMainTab("stock")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mainTab === "stock"
              ? "border-[#378ADD] text-[#378ADD]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 分析ストック
          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
            {records.length}
          </span>
        </button>
        <button
          onClick={() => setMainTab("memo")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mainTab === "memo"
              ? "border-[#378ADD] text-[#378ADD]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📝 メモ帳
        </button>
      </div>

      {mainTab === "memo" && <MemoPadPanel />}

      {mainTab === "stock" && (<>

      {/* ストック用ヘッダーボタン群 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 高さ一括変更 */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>高さ</span>
          {([
            { label: "S", value: 160 },
            { label: "M", value: 280 },
            { label: "L", value: 500 },
            { label: "XL", value: 900 },
          ] as const).map((opt) => (
            <button
              key={opt.label}
              onClick={() => { setGlobalHeight(opt.value); setContentHeights({}); }}
              className={`flex h-6 w-6 items-center justify-center rounded border text-[10px] font-bold transition-colors ${
                globalHeight === opt.value
                  ? "border-[#378ADD] bg-[#E6F1FB] text-[#185FA5]"
                  : "border-gray-200 text-gray-500 hover:border-[#B5D4F4]"
              }`}
              title={`カードの高さを${opt.label === "S" ? "小" : opt.label === "M" ? "中" : opt.label === "L" ? "大" : "特大"}に設定`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* フォントサイズ変更 */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>文字</span>
          <button
            onClick={() => setFontSize((f) => Math.max(10, f - 1))}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 font-bold hover:border-[#B5D4F4]"
            title="本文の文字サイズを小さく"
          >
            A-
          </button>
          <span className="w-8 text-center">{fontSize}px</span>
          <button
            onClick={() => setFontSize((f) => Math.min(20, f + 1))}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 font-bold hover:border-[#B5D4F4]"
            title="本文の文字サイズを大きく"
          >
            A+
          </button>
        </div>

        {/* フォルダフォントサイズ */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span className="text-gray-400">📁</span>
          <button
            onClick={() => setFolderFontSize((f) => Math.max(9, f - 1))}
            className="flex h-5 w-5 items-center justify-center rounded border border-gray-200 text-[10px] font-bold hover:border-[#B5D4F4]"
            title="フォルダタブの文字サイズを小さく"
          >
            A-
          </button>
          <span className="w-7 text-center text-[10px]">{folderFontSize}px</span>
          <button
            onClick={() => setFolderFontSize((f) => Math.min(16, f + 1))}
            className="flex h-5 w-5 items-center justify-center rounded border border-gray-200 text-[10px] font-bold hover:border-[#B5D4F4]"
            title="フォルダタブの文字サイズを大きく"
          >
            A+
          </button>
        </div>

        <button
          onClick={exportAnalysesAsJSON}
          disabled={records.length === 0}
          className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80 disabled:opacity-40"
          title="全分析をJSONファイルでエクスポート"
        >
          <Download className="h-3 w-3" /> JSON
        </button>
        <button
          onClick={exportAnalysesAsText}
          disabled={records.length === 0}
          className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80 disabled:opacity-40"
          title="全分析をテキストファイルでエクスポート"
        >
          <Download className="h-3 w-3" /> テキスト
        </button>
        <button
          onClick={() => exportAnalysesAsDocx()}
          disabled={records.length === 0}
          className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80 disabled:opacity-40"
          title="全分析をWordファイルでエクスポート"
        >
          <Download className="h-3 w-3" /> Word
        </button>
        <button
          onClick={() => exportAnalysesAsPdf()}
          disabled={records.length === 0}
          className="inline-flex items-center gap-1 rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-white/80 disabled:opacity-40"
          title="全分析をPDFファイルでエクスポート"
        >
          <Download className="h-3 w-3" /> PDF
        </button>
        {records.some((r) => r.analysisType === "partial") && (
          <button
            onClick={() => {
              if (!confirm("「部分抽出」カードを全て削除しますか？")) return;
              const partialIds = records.filter((r) => r.analysisType === "partial").map((r) => r.id);
              partialIds.forEach((id) => deleteAnalysis(id));
              reload();
              toastOk(`部分抽出カード${partialIds.length}件を削除しました`);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600 shadow-sm hover:bg-orange-100"
            title="「部分抽出」カードを一括削除"
          >
            <Trash2 className="h-3 w-3" /> 部分抽出を削除
          </button>
        )}
        {showConfirmClear ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleClearAll}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white"
              title="本当に全件削除する"
            >
              本当に全削除
            </button>
            <button
              onClick={() => setShowConfirmClear(false)}
              className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600"
              title="キャンセル"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmClear(true)}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-100 disabled:opacity-40"
            title="保存済み分析を全て削除する"
          >
            <Trash2 className="h-3 w-3" /> 全削除
          </button>
        )}
      </div>

      {/* フォルダツリー */}
      <div className="space-y-1 pb-2">
        {/* 固定タブ: すべて + ロック済み */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <button
            onClick={() => setActiveFolder(null)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
              activeFolder === null
                ? "bg-[#888780] text-white"
                : "bg-[#F1EFE8] text-[#5F5E5A] border border-[#D3D1C7] hover:bg-[#E8E6DF]"
            }`}
            style={{ fontSize: `${folderFontSize}px` }}
          >
            <span>📚 すべて</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeFolder === null ? "bg-white/25 text-white" : "bg-[#D3D1C7] text-[#5F5E5A]"
            }`}>
              {records.length}
            </span>
          </button>
          <button
            onClick={() => setActiveFolder(activeFolder === LOCK_FOLDER ? null : LOCK_FOLDER)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
              activeFolder === LOCK_FOLDER
                ? "bg-amber-500 text-white"
                : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            }`}
            style={{ fontSize: `${folderFontSize}px` }}
          >
            <span>🔒 ロック済み</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeFolder === LOCK_FOLDER
                ? "bg-white/20 text-white"
                : "bg-amber-200 text-amber-800"
            }`}>
              {folderCounts[LOCK_FOLDER] || 0}
            </span>
          </button>
        </div>

        {/* 階層フォルダツリー */}
        <div className="space-y-0.5">
          {folderTree.map((node) => (
            <FolderTreeItem
              key={node.path}
              node={node}
              activeFolder={activeFolder}
              onSelect={setActiveFolder}
              onAddSubfolder={handleAddSubfolder}
              onEdit={(f) => setEditingFolderId(f)}
              onDelete={handleDeleteFolder}
              editingFolderId={editingFolderId}
              onRename={handleRenameFolder}
              setEditingFolderId={setEditingFolderId}
              folderFontSize={folderFontSize}
            />
          ))}
        </div>

        {/* フォルダ追加 */}
        <div className="flex items-center gap-1.5 pt-1">
          {showAddFolder ? (
            <div className="inline-flex shrink-0 items-center gap-1">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddFolder(); if (e.key === "Escape") setShowAddFolder(false); }}
                placeholder="フォルダ名"
                autoFocus
                className="w-24 rounded-full border border-gray-200 px-2 py-1 text-xs focus:border-[#B5D4F4] focus:outline-none"
              />
              <button onClick={handleAddFolder} className="rounded-full bg-[#E6F1FB] px-2 py-1 text-xs text-[#185FA5] hover:bg-[#E6F1FB]">追加</button>
              <button onClick={() => setShowAddFolder(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddFolder(true)}
              className="shrink-0 rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-400 hover:border-[#B5D4F4] hover:text-[#378ADD]"
            >
              <Plus className="mr-0.5 inline h-3 w-3" /> フォルダ追加
            </button>
          )}
        </div>
      </div>

      {/* 検索 + タグ一覧ボタン */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ファイル名・内容・分析タイプ・タグ・フォルダで検索..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
          />
        </div>
        <button
          onClick={() => setShowTagList(!showTagList)}
          className="flex items-center gap-1 px-3 py-2 text-xs border rounded-lg hover:border-[#B5D4F4] whitespace-nowrap"
        >
          🏷 タグ ({getTagsWithCount().length}種)
        </button>
      </div>

      {/* タグ一覧パネル */}
      {showTagList && (() => {
        const tagsWithCount = getTagsWithCount();
        return (
          <div className="border border-[#B5D4F4] rounded-lg bg-[#E6F1FB] p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#185FA5]">🏷 タグ一覧（五十音順）</span>
              <button onClick={() => setShowTagList(false)} className="text-gray-400 text-xs">✕ 閉じる</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagsWithCount.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSearch(tag);
                    setShowTagList(false);
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-white border border-[#B5D4F4] rounded-full text-xs hover:bg-[#E6F1FB] transition-colors"
                >
                  <span className="text-[#185FA5]">{tag}</span>
                  <span className="text-gray-400 text-[10px]">({count})</span>
                </button>
              ))}
              {tagsWithCount.length === 0 && (
                <span className="text-xs text-gray-400">タグがまだ登録されていません</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* 選択操作バー */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={selectedIds.size === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-gray-300 text-[#378ADD] focus:ring-[#B5D4F4] cursor-pointer"
          />
          <span className="text-xs text-gray-500">
            {selectedIds.size > 0 ? `${selectedIds.size}件選択中` : "全選択"}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-400 underline hover:text-gray-600"
            >
              選択解除
            </button>
          )}
        </div>
      )}

      {/* 一括操作パネル */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] p-3">
          {/* 1行目: ラベル + フォルダ + タグ */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#185FA5]">
              📋 {selectedIds.size}件を一括操作：
            </span>

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-600">📁</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) bulkSetFolder(e.target.value);
                }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-[#B5D4F4]"
                title="選択した項目をフォルダに移動"
              >
                <option value="">フォルダ選択...</option>
                {getFlatFolderList(folderTree).map((f) => (
                  <option key={f.path} value={f.path}>{f.displayName}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-600">🏷</span>
              <input
                type="text"
                placeholder="タグ名を入力してEnter"
                className="w-32 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#B5D4F4]"
                title="選択した項目にタグを追加"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    bulkAddTag(e.currentTarget.value.trim());
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
          </div>

          {/* 2行目: ロック + 複製 + ダウンロード + 削除 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                bulkToggleLock(Array.from(selectedIds), true);
                reload();
                toastOk(`${selectedIds.size}件をロックしました`);
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
              title={`選択した${selectedIds.size}件をロック`}
            >
              🔒 一括ロック
            </button>
            <button
              onClick={() => {
                bulkToggleLock(Array.from(selectedIds), false);
                reload();
                toastOk(`${selectedIds.size}件のロックを解除しました`);
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title={`選択した${selectedIds.size}件のロックを解除`}
            >
              🔓 一括解除
            </button>
            <button
              onClick={() => {
                let count = 0;
                Array.from(selectedIds).forEach((id) => {
                  if (duplicateAnalysis(id)) count++;
                });
                setSelectedIds(new Set());
                reload();
                toastOk(`${count}件を複製しました`);
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              title={`選択した${selectedIds.size}件を複製`}
            >
              📋 一括複製
            </button>

            <span className="text-gray-300">|</span>

            <button
              onClick={() => {
                const selected = records.filter((r) => selectedIds.has(r.id));
                bulkExportAsMarkdown(selected);
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-[#E6F1FB] border border-[#B5D4F4] text-[#185FA5] rounded-lg hover:bg-[#d0e8f8] transition-colors"
              title={`選択した${selectedIds.size}件を個別のMDファイルとしてダウンロード`}
            >
              ⬇️ MD一括
            </button>
            <button
              onClick={() => {
                const selected = records.filter((r) => selectedIds.has(r.id));
                bulkExportAsText(selected);
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title={`選択した${selectedIds.size}件を個別のテキストファイルとしてダウンロード`}
            >
              ⬇️ テキスト一括
            </button>
            <button
              onClick={() => {
                const selected = records.filter((r) => selectedIds.has(r.id));
                bulkExportAsPdf(selected);
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              title={`選択した${selectedIds.size}件を個別のPDFファイルとしてダウンロード`}
            >
              ⬇️ PDF一括
            </button>

            <span className="flex-1" />

            <button
              onClick={bulkDelete}
              className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
              title={`選択した項目を削除（ロック済みは除外）`}
            >
              🗑 選択削除
            </button>
          </div>
        </div>
      )}

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
                className={`overflow-hidden rounded-xl border ${
                  selectedIds.has(r.id)
                    ? "border-[#B5D4F4] bg-[#E6F1FB]"
                    : "border-gray-100 bg-white/60"
                }`}
              >
                <div
                  className="flex items-start gap-2 px-4 py-3 cursor-pointer select-none hover:bg-blue-50/30 transition-colors"
                  onClick={() => editingId !== r.id && setExpandedId(isExpanded ? null : r.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-[#378ADD] focus:ring-[#B5D4F4]"
                  />
                  <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                  <span className="rounded-full bg-[#E6F1FB] px-2 py-0.5 text-xs font-medium text-[#185FA5] border border-[#B5D4F4]">
                    {r.analysisLabel}
                  </span>
                  {r.folder && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      <FolderOpen className="mr-0.5 inline h-2.5 w-2.5" />
                      {r.folder}
                    </span>
                  )}
                  {r.locked && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full border border-amber-200">
                      🔒 ロック
                    </span>
                  )}
                  {(r.title || r.fileName).includes("(コピー)") && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-400 rounded-full border border-blue-100">
                      📋 コピー
                    </span>
                  )}
                  {editingId === r.id ? (
                    <input
                      type="text"
                      defaultValue={getDisplayTitle(r)}
                      autoFocus
                      placeholder={r.fileName}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-sm font-semibold border-b border-[#378ADD] outline-none bg-transparent w-full max-w-xs"
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
                        onClick={(e) => { e.stopPropagation(); setEditingId(r.id); }}
                        className="ml-1 text-gray-400 hover:text-[#378ADD] transition-colors"
                        title="タイトルを編集（クリックで変更）"
                      >
                        ✏️
                      </button>
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleString("ja-JP")}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingTagId(editingTagId === r.id ? null : r.id); }}
                    className="rounded p-1 hover:bg-gray-100"
                    title="タグ・フォルダ編集"
                  >
                    <Tag className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveGensparkId(isGensparkActive ? null : r.id); }}
                    className="rounded bg-[#1D9E75] hover:bg-[#0F6E56] px-2 py-1 text-[10px] font-semibold text-white transition-opacity"
                    title="Gensparkでプレゼン資料を作成"
                  >
                    Gensparkへ
                  </button>
                  {staffProfiles.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setStaffLinkId(staffLinkId === r.id ? null : r.id); }}
                      className="rounded p-1 hover:bg-green-50"
                      title="スタッフカルテに記録"
                    >
                      <User className="h-3.5 w-3.5 text-green-500" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopy(r.content); }}
                    className="rounded p-1 hover:bg-gray-100"
                    title="内容をクリップボードにコピー"
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); exportSingleAnalysisAsMarkdown(r); }}
                    className="rounded p-1 text-gray-400 hover:text-[#378ADD] transition-colors"
                    title="Markdownファイルでダウンロード"
                  >
                    <span className="text-xs font-bold">MD</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); exportSingleAnalysisAsPdf(r); }}
                    className="rounded p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="PDFファイルでダウンロード"
                  >
                    <span className="text-xs font-bold">PDF</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const copied = duplicateAnalysis(r.id);
                      if (copied) {
                        reload();
                        toastOk(`「${copied.title}」を複製しました`);
                      }
                    }}
                    className="rounded p-1 text-gray-300 hover:text-blue-500 transition-colors"
                    title="このカードを複製"
                  >
                    📋
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const wasLocked = r.locked;
                      toggleLock(r.id);
                      reload();
                      if (!wasLocked) {
                        toastOk("🔒 ロックしました。「🔒 ロック済み」フォルダで確認できます");
                      }
                    }}
                    className={`rounded p-1 transition-colors ${
                      r.locked
                        ? "text-amber-500 hover:text-amber-600"
                        : "text-gray-300 hover:text-gray-500"
                    }`}
                    title={r.locked ? "ロックを解除する" : "ロックする（削除を防止）"}
                  >
                    {r.locked ? "🔒" : "🔓"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
                    disabled={r.locked}
                    className={`rounded p-1 transition-colors ${
                      r.locked
                        ? "text-gray-200 cursor-not-allowed"
                        : "hover:bg-red-50"
                    }`}
                    title={r.locked ? "ロック中のため削除できません" : "削除する"}
                  >
                    <Trash2 className={`h-3.5 w-3.5 ${r.locked ? "text-gray-200" : "text-red-400"}`} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : r.id); }}
                    className="rounded p-1 hover:bg-gray-100"
                    title={isExpanded ? "折りたたむ" : "展開して内容を表示"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </button>
                  </div>
                </div>

                {/* タグバッジ表示 */}
                {(r.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 px-4 pb-1">
                    {r.tags.map((t) => (
                      <span key={t} className="rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[10px] font-medium text-[#185FA5] border border-[#B5D4F4]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {!isExpanded && !isGensparkActive && editingTagId !== r.id && (
                  <p className="truncate px-4 pb-3 text-xs text-gray-500">
                    {r.content.slice(0, 100)}...
                  </p>
                )}

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                    {/* 個別カード高さプリセット */}
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span>📏 高さ：</span>
                      {([
                        { label: "小", value: 120 },
                        { label: "中", value: 240 },
                        { label: "大", value: 480 },
                        { label: "特大", value: 800 },
                      ] as const).map((opt) => {
                        const current = contentHeights[r.id] || globalHeight;
                        return (
                          <button
                            key={opt.label}
                            onClick={() => setCardHeight(r.id, opt.value)}
                            className={`rounded border px-1.5 py-0.5 transition-colors ${
                              current === opt.value
                                ? "border-[#378ADD] bg-[#E6F1FB] text-[#378ADD]"
                                : "border-gray-200 hover:border-[#B5D4F4]"
                            }`}
                          >
                            {opt.label}({opt.value}px)
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <div
                        ref={(el) => {
                          if (el && !contentRefs.current[r.id]) {
                            contentRefs.current[r.id] = el;
                            el.innerHTML = r.content || "";
                          }
                        }}
                        data-stock-content="true"
                        data-record-id={r.id}
                        contentEditable
                        suppressContentEditableWarning
                        onMouseUp={(e) => handleContentMouseUp(e, r.id)}
                        onClick={(e) => e.stopPropagation()}
                        onInput={(e) => {
                          debouncedSave(r.id, (e.target as HTMLDivElement).innerHTML);
                        }}
                        className="overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50/50 p-3 text-gray-700 outline-none cursor-text focus:border-[#B5D4F4] focus:ring-1 focus:ring-[#B5D4F4]"
                        style={{
                          height: `${contentHeights[r.id] || globalHeight}px`,
                          minHeight: "80px",
                          maxHeight: "2000px",
                          fontSize: `${fontSize}px`,
                          lineHeight: "1.7",
                          wordBreak: "break-word",
                          userSelect: "text",
                          WebkitUserSelect: "text",
                        }}
                      />
                      {r.updatedAt && (
                        <div className="mt-1 flex items-center justify-end gap-2">
                          <span className="text-[10px] text-gray-400">
                            編集済み: {new Date(r.updatedAt).toLocaleString("ja-JP")}
                          </span>
                          {r.originalContent && (
                            <button
                              onClick={() => {
                                revertAnalysisContent(r.id);
                                reload();
                                toastOk("元の内容に戻しました");
                              }}
                              className="text-[10px] text-[#378ADD] underline hover:text-[#378ADD]"
                            >
                              ↩️ 元に戻す
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {editingTagId === r.id && (
                  <TagFolderEditor
                    record={r}
                    allFolders={allFolders}
                    folderTree={folderTree}
                    onSave={(tags, folder) => {
                      updateAnalysisTags(r.id, tags, folder);
                      setEditingTagId(null);
                      reload();
                      toastOk("タグ・フォルダを保存しました");
                    }}
                    onClose={() => setEditingTagId(null)}
                  />
                )}

                {staffLinkId === r.id && (
                  <div className="border-t border-green-100 bg-green-50/50 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-green-700">スタッフカルテに記録</span>
                      <button onClick={() => setStaffLinkId(null)} className="text-gray-400 text-xs">✕ 閉じる</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {staffProfiles.map((sp) => (
                        <button
                          key={sp.id}
                          onClick={() => {
                            saveStaffRecord({
                              staffId: sp.id,
                              date: new Date().toISOString().split("T")[0],
                              type: "memo",
                              typeLabel: "メモ",
                              content: `【${r.analysisLabel}】${getDisplayTitle(r)}\n${r.content.slice(0, 200)}...`,
                              analysisId: r.id,
                            });
                            setStaffLinkId(null);
                            toastOk(`${sp.name}のカルテに記録しました`);
                          }}
                          className="rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                        >
                          {sp.name}{sp.role ? `（${sp.role}）` : ""}
                        </button>
                      ))}
                    </div>
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

      </>)}

      {/* フローティングツールバー */}
      {floatingToolbar && (
        <div
          data-floating-toolbar="true"
          className="fixed z-[9999] flex items-center gap-0.5 bg-gray-900 text-white rounded-xl shadow-2xl px-2 py-1.5 text-xs select-none"
          style={{
            left: floatingToolbar.x,
            top: floatingToolbar.y,
            transform: "translate(-50%, calc(-100% - 8px))",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* 書式ボタン */}
          <button
            onMouseDown={(e) => { e.preventDefault(); applyFormat("bold"); }}
            className="w-6 h-6 font-bold hover:bg-gray-700 rounded flex items-center justify-center"
          >
            B
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); applyFormat("italic"); }}
            className="w-6 h-6 italic hover:bg-gray-700 rounded flex items-center justify-center"
          >
            I
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); applyFormat("underline"); }}
            className="w-6 h-6 underline hover:bg-gray-700 rounded flex items-center justify-center"
          >
            U
          </button>
          <span className="w-px h-4 bg-gray-600 mx-0.5" />
          {/* 文字色 */}
          {FLOAT_COLORS.map(({ color, label }) => (
            <button
              key={color}
              onMouseDown={(e) => { e.preventDefault(); applyFormat("foreColor", color); }}
              className="w-4 h-4 rounded-full border border-gray-500 hover:scale-125 transition-transform"
              style={{ background: color }}
              title={`文字色: ${label}`}
            />
          ))}
          <span className="w-px h-4 bg-gray-600 mx-0.5" />
          {/* ハイライト */}
          {FLOAT_HIGHLIGHTS.map(({ color, label }) => (
            <button
              key={color}
              onMouseDown={(e) => { e.preventDefault(); applyFormat("backColor", color); }}
              className="w-4 h-4 rounded-full border border-gray-500 hover:scale-125 transition-transform"
              style={{ background: color }}
              title={`ハイライト: ${label}`}
            />
          ))}
          <span className="w-px h-4 bg-gray-600 mx-0.5" />
          {/* 書式クリア */}
          <button
            onMouseDown={(e) => { e.preventDefault(); applyFormat("removeFormat"); }}
            className="px-1.5 h-6 text-[10px] text-gray-300 hover:bg-gray-700 rounded"
          >
            ✕
          </button>
          <span className="w-px h-4 bg-gray-600 mx-0.5" />
          {/* メモ帳に追記ボタン */}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              const sheets = loadMemoSheets();
              const activeSheet = sheets[0];
              if (activeSheet) {
                const updated = appendToMemoSheet(activeSheet.id, floatingToolbar.text);
                const updatedSheet = updated.find((s: { id: string }) => s.id === activeSheet.id);
                window.dispatchEvent(new Event("memo-updated"));

                // ツールバー位置を保存してからポップアップ表示
                setMemoPopup({
                  content: updatedSheet?.content || "",
                  sheetName: updatedSheet?.name || "メモ",
                  x: floatingToolbar.x + 40,  // ツールバーより少し右
                  y: floatingToolbar.y - 10,  // ツールバーとほぼ同じ高さ
                });
              }
              setFloatingToolbar(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="flex items-center gap-1 px-2 h-6 bg-[#378ADD] hover:bg-[#185FA5] rounded-lg text-[10px] font-medium ml-0.5"
          >
            <span>📝</span>
            <span>メモに追記</span>
          </button>
          {/* 矢印（下向き） */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #111827",
            }}
          />
        </div>
      )}

      {/* メモプレビューポップアップ（選択範囲の近く、ツールバーの下に表示） */}
      {memoPopup && (
        <div
          data-memo-popup="true"
          className="fixed z-[9998] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
          style={{
            left: memoPopup.x,
            top: memoPopup.y,
            transform: "translate(0, -100%)",
            width: "200px",
            maxHeight: "160px",
          }}
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#E6F1FB] border-b border-[#B5D4F4]">
            <div className="flex items-center gap-1 text-xs font-medium text-[#185FA5]">
              <span>📝</span>
              <span>{memoPopup.sheetName}</span>
              <span className="text-[10px] text-[#378ADD] bg-white px-1.5 py-0.5 rounded-full">追記</span>
            </div>
            <button
              onClick={() => setMemoPopup(null)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          </div>
          <div
            className="p-2.5 text-xs text-gray-600 leading-relaxed overflow-y-auto"
            style={{ maxHeight: "140px" }}
          >
            <div className="whitespace-pre-wrap break-words">
              {memoPopup.content.length > 150
                ? "..." + memoPopup.content.slice(-150)
                : memoPopup.content}
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-1 border-t border-gray-100 bg-gray-50">
            <span className="text-[10px] text-gray-400">
              {memoPopup.content.length}文字
            </span>
            <button
              onClick={() => { setMemoPopup(null); setMainTab("memo"); }}
              className="text-[10px] text-[#378ADD] hover:underline"
            >
              メモ帳を開く →
            </button>
          </div>
        </div>
      )}

      {/* パスワード確認モーダル */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 mx-4">
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">🔐</div>
              <h3 className="text-sm font-bold text-gray-800">削除の確認</h3>
              <p className="text-xs text-gray-500 mt-1">
                {isBulkDelete
                  ? `${Array.from(selectedIds).filter((id) => !records.find((r) => r.id === id)?.locked).length}件を削除するにはパスワードを入力してください`
                  : "削除するにはパスワードを入力してください"}
              </p>
            </div>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && confirmDelete()}
              placeholder="パスワードを入力"
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#378ADD] focus:ring-2 focus:ring-[#B5D4F4] mb-2"
            />
            {passwordError && (
              <p className="text-xs text-red-500 mb-2">❌ {passwordError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-3 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
