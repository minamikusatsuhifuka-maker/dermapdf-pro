"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Scissors, Eraser } from "lucide-react";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropOverlayProps {
  imageUrl: string;
  onCrop: (rect: Rect) => void;
  onCropAndRemoveBg?: (rect: Rect) => void;
  onClose: () => void;
}

export function CropOverlay({
  imageUrl,
  onCrop,
  onCropAndRemoveBg,
  onClose,
}: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [rect, setRect] = useState<Rect | null>(null);

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const bounds = container.getBoundingClientRect();
      const clientX =
        "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - bounds.left,
        y: clientY - bounds.top,
      };
    },
    []
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const pos = getPos(e);
      setStart(pos);
      setDragging(true);
      setRect(null);
    },
    [getPos]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!dragging) return;
      const pos = getPos(e);
      setRect({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y),
      });
    },
    [dragging, start, getPos]
  );

  const handleEnd = useCallback(() => {
    setDragging(false);
  }, []);

  // ESCキーで閉じる
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // 画像の自然サイズに対する比率を計算
  const getNormalizedRect = (): Rect | null => {
    if (!rect || !containerRef.current) return null;
    const container = containerRef.current;
    const img = container.querySelector("img");
    if (!img) return null;
    return {
      x: rect.x / img.clientWidth,
      y: rect.y / img.clientHeight,
      width: rect.width / img.clientWidth,
      height: rect.height / img.clientHeight,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-col items-center gap-4 p-4">
        {/* 画像+選択エリア */}
        <div
          ref={containerRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="relative max-h-[70vh] max-w-[90vw] cursor-crosshair select-none"
        >
          <img
            src={imageUrl}
            alt="トリミング対象"
            className="max-h-[70vh] max-w-[90vw] rounded-lg object-contain"
            draggable={false}
          />
          {/* 選択矩形 */}
          {rect && rect.width > 2 && rect.height > 2 && (
            <div
              className="absolute border-2 border-dashed border-slate-400 bg-slate-400/10"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
              }}
            />
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex gap-3">
          <button
            disabled={!rect || rect.width < 5}
            onClick={() => {
              const nr = getNormalizedRect();
              if (nr) onCrop(nr);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4f6272] hover:bg-[#3d5260] px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-opacity disabled:opacity-40"
          >
            <Scissors className="h-4 w-4" /> トリミング
          </button>
          {onCropAndRemoveBg && (
            <button
              disabled={!rect || rect.width < 5}
              onClick={() => {
                const nr = getNormalizedRect();
                if (nr) onCropAndRemoveBg(nr);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5c7a6e] hover:bg-[#4a6459] px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-opacity disabled:opacity-40"
            >
              <Eraser className="h-4 w-4" /> トリミング＋背景除去
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
