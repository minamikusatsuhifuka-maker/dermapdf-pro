"use client";

import { useState, useEffect, useRef } from "react";
import {
  type MemoSheet,
  loadMemoSheets,
  createMemoSheet,
  updateMemoSheet,
  deleteMemoSheet,
  renameMemoSheet,
} from "@/lib/memo-storage";

export default function MemoPadPanel() {
  const [sheets, setSheets] = useState<MemoSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>("");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loaded = loadMemoSheets();
    setSheets(loaded);
    setActiveSheetId(loaded[0]?.id || "");
  }, []);

  // memo-updated イベントを受け取って最新データを反映
  useEffect(() => {
    const handler = () => {
      const loaded = loadMemoSheets();
      setSheets(loaded);
    };
    window.addEventListener("memo-updated", handler);
    return () => window.removeEventListener("memo-updated", handler);
  }, []);

  const activeSheet = sheets.find((s) => s.id === activeSheetId);

  const handleContentChange = (content: string) => {
    const updated = updateMemoSheet(activeSheetId, content);
    setSheets(updated);
  };

  const handleAddSheet = () => {
    const name = `メモ ${sheets.length + 1}`;
    const updated = createMemoSheet(name);
    setSheets(updated);
    setActiveSheetId(updated[updated.length - 1].id);
  };

  const handleDeleteSheet = (id: string) => {
    if (sheets.length <= 1) return;
    if (!confirm(`「${sheets.find((s) => s.id === id)?.name}」を削除しますか？`)) return;
    const updated = deleteMemoSheet(id);
    setSheets(updated);
    if (activeSheetId === id) setActiveSheetId(updated[0]?.id || "");
  };

  const handleRename = (id: string) => {
    if (!nameInput.trim()) return;
    const updated = renameMemoSheet(id, nameInput.trim());
    setSheets(updated);
    setEditingNameId(null);
  };

  const handleDownload = (format: "txt" | "md") => {
    if (!activeSheet) return;
    const blob = new Blob([activeSheet.content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activeSheet.name}_${new Date().toISOString().split("T")[0]}.${format}`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* シートタブ */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {sheets.map((sheet) => (
          <div key={sheet.id} className="flex items-center gap-0.5">
            {editingNameId === sheet.id ? (
              <div className="flex items-center gap-1">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(sheet.id);
                    if (e.key === "Escape") setEditingNameId(null);
                  }}
                  className="text-xs border border-[#B5D4F4] rounded px-2 py-0.5 w-24 outline-none"
                  autoFocus
                />
                <button
                  onClick={() => handleRename(sheet.id)}
                  className="text-xs text-[#378ADD]"
                >
                  ✓
                </button>
                <button
                  onClick={() => setEditingNameId(null)}
                  className="text-xs text-gray-400"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveSheetId(sheet.id)}
                onDoubleClick={() => {
                  setEditingNameId(sheet.id);
                  setNameInput(sheet.name);
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeSheetId === sheet.id
                    ? "bg-[#378ADD] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title="ダブルクリックで名前変更"
              >
                📝 {sheet.name}
              </button>
            )}
            {sheets.length > 1 && (
              <button
                onClick={() => handleDeleteSheet(sheet.id)}
                className="text-gray-300 hover:text-red-400 text-xs"
                title="このシートを削除"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddSheet}
          className="text-xs text-[#378ADD] hover:bg-[#E6F1FB] px-2 py-1 rounded-full border border-dashed border-[#B5D4F4]"
        >
          + 新しいシート
        </button>
        {/* ダウンロード */}
        {activeSheet && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => handleDownload("txt")}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded"
            >
              ⬇️ TXT
            </button>
            <button
              onClick={() => handleDownload("md")}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded"
            >
              ⬇️ MD
            </button>
          </div>
        )}
      </div>

      {/* メモ編集エリア */}
      {activeSheet && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>
              テキストを自由に書き込めます・選択部分のストックはここに追記されます
            </span>
            <span>
              最終更新: {new Date(activeSheet.updatedAt).toLocaleString("ja-JP")}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            data-memo-textarea="true"
            value={activeSheet.content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={
              "ここにメモを入力...\n\n分析カードからテキストを選択して📌ストックすると、ここに自動で追記されます。"
            }
            className="w-full min-h-[400px] p-3 text-sm leading-relaxed border border-gray-200 rounded-xl outline-none resize-y focus:border-[#378ADD] transition-colors text-gray-700"
            style={{ fontFamily: "inherit" }}
          />
          <div className="text-[10px] text-gray-300 text-right">
            {activeSheet.content.length}文字
          </div>
        </div>
      )}
    </div>
  );
}
