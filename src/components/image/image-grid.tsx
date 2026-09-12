"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, FileOutput, BrainCircuit, Images, GripVertical, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageItem {
  id: string;
  name: string;
  url: string;
}

interface ImageGridProps {
  images: ImageItem[];
  onRemoveBg?: (ids: string[]) => void;
  onMergePdf?: (ids: string[]) => void;
  onMergePdfAndAnalyze?: (ids: string[]) => void;
  onAnalyzeImages?: (ids: string[]) => void;
  // 選択画像が変わるたびに親へ通知（選択画像のみの書き起こしで使用）。
  // ids は「画像のままAI分析」と同じ selectedArray（表示順・選択中のみ）。
  onSelectionChange?: (ids: string[]) => void;
  // いま有効な解析方式（表示だけ）。"images"＝画像のまま／"pdf"＝PDF統合。既定は "images"。
  // ボタンの挙動は従来どおり（押すと即その方式で準備＋AI分析パネルへ）。表示の排他だけを担う。
  analysisMode?: "images" | "pdf";
  // 基本分析の「🚀 実行」を画像グリッドのボタン行からも押せるようにする（同一ハンドラ）。
  onRun?: () => void;
  runDisabled?: boolean;
  runLoading?: boolean;
}

export function ImageGrid({
  images,
  onRemoveBg,
  onMergePdf,
  onMergePdfAndAnalyze,
  onAnalyzeImages,
  onSelectionChange,
  analysisMode = "images",
  onRun,
  runDisabled,
  runLoading,
}: ImageGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // DnD並べ替え後の表示順（画像id）。永続化なし（セッション内のみ）。
  // images に無いidは無視・orderに無い新規idは images の並びで末尾に付く。
  const [order, setOrder] = useState<string[]>([]);
  // ドラッグ中のサムネイルの表示順インデックス（null=ドラッグなし）
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // 既に見た画像id。新規追加分だけをデフォルト選択済みにするための記録。
  const knownIdsRef = useRef<Set<string>>(new Set());

  // 画像の追加・削除に選択状態を同期：
  // 新規に追加された画像はデフォルトで選択済み、既存画像の選択/解除状態は変えない。
  useEffect(() => {
    const currentIds = new Set(images.map((img) => img.id));
    const known = knownIdsRef.current;
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (currentIds.has(id)) next.add(id);
      for (const id of currentIds) if (!known.has(id)) next.add(id);
      return next;
    });
    knownIdsRef.current = currentIds;
  }, [images]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(images.map((img) => img.id)));
  const deselectAll = () => setSelected(new Set());

  // 表示順に並べた画像一覧。order を優先し、order に無い新規分は images の並びで末尾。
  const byId = new Map(images.map((img) => [img.id, img]));
  const orderedImages = [
    ...order
      .map((id) => byId.get(id))
      .filter((img): img is ImageItem => !!img),
    ...images.filter((img) => !order.includes(img.id)),
  ];

  // サムネイルを from → to へ移動（表示順インデックス）。並び順は解析の送信順に直結する。
  const moveImage = (from: number, to: number) => {
    if (from === to) return;
    const current = orderedImages.map((img) => img.id);
    if (from < 0 || from >= current.length || to < 0 || to >= current.length)
      return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
  };

  // 選択中の画像idを「表示の並び順」で返す。
  // 「画像のままAI分析」の送信順（チャンク順）・「PDFに統合」の統合ページ順に反映される。
  const selectedArray = orderedImages
    .filter((img) => selected.has(img.id))
    .map((img) => img.id);

  // 選択集合・表示順の変化を親へ通知（親から毎回新しい関数が来ても通知ループにしない）。
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  });
  const selectedKey = selectedArray.join(",");
  useEffect(() => {
    onSelectionChangeRef.current?.(selectedKey ? selectedKey.split(",") : []);
  }, [selectedKey]);

  return (
    <div className="space-y-4">
      {/* コントロールバー */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={selectAll}
          className="rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
        >
          全選択
        </button>
        <button
          onClick={deselectAll}
          className="rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
        >
          全解除
        </button>
        <span className="text-xs text-gray-400">
          {selected.size} / {images.length} 枚選択中
        </span>
        {/* 解析方式：既定は「画像のまま」。選択中は塗り＋✓、非選択は白抜きで排他表示。
            押したときの挙動は従来どおり（その方式で準備し、AI分析パネルを開く）。 */}
        <button
          disabled={selected.size === 0}
          aria-pressed={analysisMode === "images"}
          onClick={() => onAnalyzeImages?.(selectedArray)}
          title="選択中の画像をPDFに統合せず、画像のままAI分析へ渡す（既定の解析方式）"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium shadow-sm transition-colors disabled:opacity-40",
            analysisMode === "images"
              ? "bg-[#378ADD] text-white ring-2 ring-[#185FA5] ring-offset-1 hover:bg-[#185FA5]"
              : "border border-gray-200 bg-white text-gray-600 hover:border-[#378ADD] hover:text-[#185FA5]"
          )}
        >
          {analysisMode === "images" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Images className="h-3.5 w-3.5" />
          )}
          画像のままAI分析
        </button>
        {/* 基本分析の「🚀 実行」（下部・見出し右の実行ボタンと同一ハンドラ／同一disabled／同一ローディング） */}
        <button
          disabled={runDisabled}
          onClick={() => onRun?.()}
          title="いま選択中の分析タイプで実行（⌘+Enter / Ctrl+Enter・分析パネルの実行ボタンと同じ）"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#378ADD] hover:bg-[#185FA5] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity disabled:opacity-40"
        >
          {runLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span>🚀</span>
          )}
          {runLoading ? "分析中..." : "実行"}
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            disabled={selected.size === 0}
            onClick={() => onRemoveBg?.(selectedArray)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#378ADD] hover:bg-[#185FA5] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity disabled:opacity-40"
          >
            <Eraser className="h-3.5 w-3.5" /> 一括背景除去
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() => onMergePdf?.(selectedArray)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D9E75] hover:bg-[#0F6E56] px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity disabled:opacity-40"
          >
            <FileOutput className="h-3.5 w-3.5" /> PDFに統合
          </button>
          <button
            disabled={selected.size === 0}
            aria-pressed={analysisMode === "pdf"}
            onClick={() => onMergePdfAndAnalyze?.(selectedArray)}
            title="選択中の画像を1本のPDFに統合してからAI分析へ渡す"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium shadow-sm transition-colors disabled:opacity-40",
              analysisMode === "pdf"
                ? "bg-[#378ADD] text-white ring-2 ring-[#185FA5] ring-offset-1 hover:bg-[#185FA5]"
                : "border border-gray-200 bg-white text-gray-600 hover:border-[#378ADD] hover:text-[#185FA5]"
            )}
          >
            {analysisMode === "pdf" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <BrainCircuit className="h-3.5 w-3.5" />
            )}
            PDF統合してAI分析
          </button>
        </div>
      </div>

      {/* 画像グリッド（DnDで並べ替え可能・並び順は解析の送信順に反映） */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {orderedImages.map((img, idx) => {
          const isSelected = selected.has(img.id);
          return (
            <button
              key={img.id}
              onClick={() => toggle(img.id)}
              onDragOver={(e) => {
                if (dragIndex !== null) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) moveImage(dragIndex, idx);
                setDragIndex(null);
              }}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border-2 bg-white shadow-sm transition-all",
                isSelected
                  ? "border-[#378ADD] ring-2 ring-slate-200"
                  : "border-transparent hover:border-[#B5D4F4]",
                dragIndex === idx && "opacity-40"
              )}
            >
              <img
                src={img.url}
                alt={img.name}
                className="h-full w-full object-cover"
              />
              {/* ドラッグハンドル（⋮⋮）。ここからのドラッグ＝並べ替え。
                  クリックは選択トグルへ伝播させない＝短い操作は確実にトグル。 */}
              <span
                draggable
                onDragStart={(e) => {
                  setDragIndex(idx);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDragIndex(null)}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-1.5 right-1.5 flex h-5 w-5 cursor-grab items-center justify-center rounded-md bg-white/80 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                title="ドラッグで並べ替え（書き起こし順に反映）"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              {/* チェックボックス */}
              <div
                className={cn(
                  "absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-md border-2 text-white transition-colors",
                  isSelected
                    ? "border-[#378ADD] bg-[#378ADD]"
                    : "border-gray-300 bg-white/80"
                )}
              >
                {isSelected && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {/* ファイル名 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5 text-center text-xs text-white truncate">
                {img.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
