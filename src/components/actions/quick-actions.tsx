"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileDown,
  Maximize,
  Crop,
  Eraser,
  BrainCircuit,
  Presentation,
  MessageSquare,
  GripVertical,
} from "lucide-react";

const STORAGE_KEY = "dermapdf-quick-action-order";

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: "edit" | "ai";
  color: string;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  // 編集ツール
  { id: "compress", label: "圧縮", icon: <FileDown className="h-4 w-4" />, category: "edit", color: "from-rose-400 to-rose-500" },
  { id: "resize", label: "リサイズ", icon: <Maximize className="h-4 w-4" />, category: "edit", color: "from-rose-400 to-rose-500" },
  { id: "crop", label: "トリミング", icon: <Crop className="h-4 w-4" />, category: "edit", color: "from-rose-400 to-rose-500" },
  { id: "remove-bg", label: "背景除去", icon: <Eraser className="h-4 w-4" />, category: "edit", color: "from-rose-400 to-rose-500" },
  // AI活用
  { id: "gemini", label: "Gemini AI分析", icon: <BrainCircuit className="h-4 w-4" />, category: "ai", color: "from-purple-400 to-purple-500" },
  { id: "presentation", label: "プレゼン生成", icon: <Presentation className="h-4 w-4" />, category: "ai", color: "from-purple-400 to-purple-500" },
  { id: "message", label: "メッセージ生成", icon: <MessageSquare className="h-4 w-4" />, category: "ai", color: "from-purple-400 to-purple-500" },
];

interface QuickActionsProps {
  onAction: (actionId: string) => void;
}

export function QuickActions({ onAction }: QuickActionsProps) {
  const [actions, setActions] = useState<QuickAction[]>(DEFAULT_ACTIONS);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // localStorageから並び順を復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const order: string[] = JSON.parse(saved);
        const sorted = [...DEFAULT_ACTIONS].sort((a, b) => {
          const ai = order.indexOf(a.id);
          const bi = order.indexOf(b.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
        setActions(sorted);
      }
    } catch { /* ignore */ }
  }, []);

  const saveOrder = useCallback((items: QuickAction[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((a) => a.id)));
    } catch { /* ignore */ }
  }, []);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...actions];
    const dragged = items.splice(dragItem.current, 1)[0];
    items.splice(dragOverItem.current, 0, dragged);
    dragItem.current = null;
    dragOverItem.current = null;
    setActions(items);
    saveOrder(items);
  };

  const editActions = actions.filter((a) => a.category === "edit");
  const aiActions = actions.filter((a) => a.category === "ai");

  const renderGroup = (title: string, items: QuickAction[]) => (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((action) => {
          const globalIndex = actions.indexOf(action);
          return (
            <button
              key={action.id}
              draggable
              onDragStart={() => handleDragStart(globalIndex)}
              onDragEnter={() => handleDragEnter(globalIndex)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => onAction(action.id)}
              className={`inline-flex cursor-grab items-center gap-2 rounded-xl bg-gradient-to-r ${action.color} px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform active:cursor-grabbing active:scale-95`}
            >
              <GripVertical className="h-3 w-3 opacity-50" />
              {action.icon}
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      <h2 className="text-lg font-bold text-gray-700">クイックアクション</h2>
      {renderGroup("編集ツール", editActions)}
      {renderGroup("AI活用", aiActions)}
    </div>
  );
}
