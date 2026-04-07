"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { loadMemoSheets, appendToMemoSheet, updateMemoSheet, type MemoSheet } from "@/lib/memo-storage";

// PiP小窓のHTML構造を生成
function buildPipHTML(sheets: MemoSheet[]): string {
  const activeSheet = sheets[0];
  const memoItems = activeSheet
    ? activeSheet.content.split("\n").filter((l) => l.trim()).map((line, i) => `
      <div class="memo-item" style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(59,130,246,0.15);font-size:12px;line-height:1.5;">
        <div class="memo-text" contenteditable="true" style="flex:1;outline:none;word-break:break-word;color:#1e3a5f;" data-index="${i}">${line}</div>
        <button class="btn-copy-item" data-index="${i}" style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:11px;color:#64748b;padding:2px;" title="コピー">📋</button>
        <button class="btn-del-item" data-index="${i}" style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:11px;color:#94a3b8;padding:2px;" title="削除">✕</button>
      </div>
    `).join("")
    : '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">メモはまだありません</div>';

  return `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:linear-gradient(135deg,#EBF4FF,#DBEAFE); color:#1e40af; overflow:hidden; display:flex; flex-direction:column; height:100vh; }
  #pip-header { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.8); border-bottom:1px solid rgba(59,130,246,0.2); flex-shrink:0; }
  #pip-header span { font-size:13px; font-weight:600; }
  #pip-toolbar { display:flex; flex-wrap:wrap; gap:3px; padding:6px 10px; background:rgba(255,255,255,0.6); border-bottom:1px solid rgba(59,130,246,0.15); flex-shrink:0; }
  #pip-toolbar button { min-width:24px; height:24px; border:1px solid rgba(59,130,246,0.25); border-radius:6px; background:#fff; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
  #pip-toolbar button:hover { background:#DBEAFE; }
  .color-btn { width:18px!important; height:18px!important; min-width:18px!important; border-radius:50%!important; border:2px solid rgba(0,0,0,0.15)!important; }
  #memo-list { flex:1; overflow-y:auto; background:rgba(255,255,255,0.5); }
  #pip-footer { display:flex; gap:6px; padding:8px 10px; background:rgba(255,255,255,0.8); border-top:1px solid rgba(59,130,246,0.2); flex-shrink:0; }
  #pip-footer button { flex:1; padding:6px 8px; border:none; border-radius:8px; font-size:11px; font-weight:500; cursor:pointer; transition:opacity 0.15s; }
  #pip-footer button:hover { opacity:0.85; }
  .btn-primary { background:#378ADD; color:#fff; }
  .btn-secondary { background:#e2e8f0; color:#475569; }
  .btn-danger { background:#fecdd3; color:#be123c; }
  .hdr-btn { background:none; border:1px solid rgba(59,130,246,0.3); border-radius:6px; padding:3px 8px; font-size:11px; cursor:pointer; color:#64748b; }
  .hdr-btn:hover { background:#DBEAFE; }
  .memo-item:hover { background:rgba(59,130,246,0.05); }
  #count { font-size:10px; color:#64748b; padding:0 10px 4px; text-align:right; flex-shrink:0; }
</style></head>
<body>
  <div id="pip-header">
    <span>📝 メモ小窓</span>
    <button class="hdr-btn" id="btn-clear-all">🗑 全消去</button>
  </div>
  <div id="pip-toolbar">
    <button id="btn-bold" style="font-weight:bold;">B</button>
    <button id="btn-italic" style="font-style:italic;">I</button>
    <button id="btn-underline" style="text-decoration:underline;">U</button>
    <button class="color-btn" id="fc-red" style="background:#ef4444;" title="赤"></button>
    <button class="color-btn" id="fc-blue" style="background:#3b82f6;" title="青"></button>
    <button class="color-btn" id="fc-green" style="background:#22c55e;" title="緑"></button>
    <button class="color-btn" id="fc-orange" style="background:#f59e0b;" title="橙"></button>
    <button class="color-btn" id="hl-yellow" style="background:#fef08a;" title="黄ハイライト"></button>
    <button class="color-btn" id="hl-sky" style="background:#bae6fd;" title="水ハイライト"></button>
    <button class="color-btn" id="hl-pink" style="background:#fecdd3;" title="桃ハイライト"></button>
    <button id="btn-remove" style="color:#94a3b8;">✕</button>
  </div>
  <div id="memo-list">${memoItems}</div>
  <div id="count">${activeSheet ? activeSheet.content.length : 0}文字</div>
  <div id="pip-footer">
    <button class="btn-primary" id="btn-save">📌 選択範囲を保存</button>
    <button class="btn-secondary" id="btn-copy-all">📋 全コピー</button>
  </div>
</body></html>`;
}

export function PipMemoPanel() {
  const [pipActive, setPipActive] = useState(false);
  const [memoCount, setMemoCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setMemoCount(loadMemoSheets()[0]?.content.split("\n").filter((l) => l.trim()).length || 0);
  }, []);

  // メモ更新イベントを監視
  useEffect(() => {
    const onUpdate = () => {
      const sheets = loadMemoSheets();
      const count = sheets[0]?.content.split("\n").filter((l) => l.trim()).length || 0;
      setMemoCount(count);
      // PiP小窓が開いていれば内容を更新
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        refreshPipContent(pipWindowRef.current);
      }
    };
    window.addEventListener("memo-updated", onUpdate);
    return () => window.removeEventListener("memo-updated", onUpdate);
  }, []);

  const refreshPipContent = useCallback((pw: Window) => {
    const sheets = loadMemoSheets();
    const activeSheet = sheets[0];
    if (!activeSheet) return;
    const list = pw.document.getElementById("memo-list");
    const countEl = pw.document.getElementById("count");
    if (!list) return;
    const lines = activeSheet.content.split("\n").filter((l) => l.trim());
    list.innerHTML = lines.length > 0
      ? lines.map((line, i) => `
        <div class="memo-item" style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(59,130,246,0.15);font-size:12px;line-height:1.5;">
          <div class="memo-text" contenteditable="true" style="flex:1;outline:none;word-break:break-word;color:#1e3a5f;" data-index="${i}">${line}</div>
          <button class="btn-copy-item" data-index="${i}" style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:11px;color:#64748b;padding:2px;" title="コピー">📋</button>
          <button class="btn-del-item" data-index="${i}" style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:11px;color:#94a3b8;padding:2px;" title="削除">✕</button>
        </div>
      `).join("")
      : '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">メモはまだありません</div>';
    if (countEl) countEl.textContent = `${activeSheet.content.length}文字`;
    // メモアイテムのイベント再登録
    bindMemoItemEvents(pw);
  }, []);

  const bindMemoItemEvents = useCallback((pw: Window) => {
    // 各メモアイテムのコピー・削除ボタン
    pw.document.querySelectorAll(".btn-copy-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number((btn as HTMLElement).dataset.index);
        const sheets = loadMemoSheets();
        const lines = sheets[0]?.content.split("\n").filter((l) => l.trim()) || [];
        if (lines[idx]) {
          navigator.clipboard.writeText(lines[idx]);
        }
      });
    });
    pw.document.querySelectorAll(".btn-del-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number((btn as HTMLElement).dataset.index);
        const sheets = loadMemoSheets();
        if (!sheets[0]) return;
        const lines = sheets[0].content.split("\n").filter((l) => l.trim());
        lines.splice(idx, 1);
        updateMemoSheet(sheets[0].id, lines.join("\n"));
        window.dispatchEvent(new Event("memo-updated"));
      });
    });
    // contentEditable の変更を保存
    pw.document.querySelectorAll(".memo-text").forEach((el) => {
      el.addEventListener("blur", () => {
        const sheets = loadMemoSheets();
        if (!sheets[0]) return;
        const items = pw.document.querySelectorAll(".memo-text");
        const newContent = Array.from(items).map((item) => (item as HTMLElement).innerText.trim()).filter(Boolean).join("\n");
        updateMemoSheet(sheets[0].id, newContent);
        window.dispatchEvent(new Event("memo-updated"));
      });
    });
  }, []);

  const openPip = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dPiP = (window as any).documentPictureInPicture;
    if (!dPiP) {
      alert("この機能にはChrome 116以降が必要です");
      return;
    }

    try {
      const pw: Window = await dPiP.requestWindow({ width: 320, height: 420 });
      pipWindowRef.current = pw;
      setPipActive(true);

      const sheets = loadMemoSheets();
      pw.document.open();
      pw.document.write(buildPipHTML(sheets));
      pw.document.close();

      // ツールバーイベント
      const exec = (cmd: string, val?: string) => pw.document.execCommand(cmd, false, val);
      pw.document.getElementById("btn-bold")?.addEventListener("click", () => exec("bold"));
      pw.document.getElementById("btn-italic")?.addEventListener("click", () => exec("italic"));
      pw.document.getElementById("btn-underline")?.addEventListener("click", () => exec("underline"));
      pw.document.getElementById("fc-red")?.addEventListener("click", () => exec("foreColor", "#ef4444"));
      pw.document.getElementById("fc-blue")?.addEventListener("click", () => exec("foreColor", "#3b82f6"));
      pw.document.getElementById("fc-green")?.addEventListener("click", () => exec("foreColor", "#22c55e"));
      pw.document.getElementById("fc-orange")?.addEventListener("click", () => exec("foreColor", "#f59e0b"));
      pw.document.getElementById("hl-yellow")?.addEventListener("click", () => exec("backColor", "#fef08a"));
      pw.document.getElementById("hl-sky")?.addEventListener("click", () => exec("backColor", "#bae6fd"));
      pw.document.getElementById("hl-pink")?.addEventListener("click", () => exec("backColor", "#fecdd3"));
      pw.document.getElementById("btn-remove")?.addEventListener("click", () => exec("removeFormat"));

      // 全消去
      pw.document.getElementById("btn-clear-all")?.addEventListener("click", () => {
        if (pw.confirm("メモを全て消去しますか？")) {
          const s = loadMemoSheets();
          if (s[0]) {
            updateMemoSheet(s[0].id, "");
            window.dispatchEvent(new Event("memo-updated"));
          }
        }
      });

      // 選択範囲を保存
      pw.document.getElementById("btn-save")?.addEventListener("click", () => {
        const sel = pw.getSelection();
        if (!sel || sel.isCollapsed) {
          const sel2 = window.getSelection();
          if (sel2 && !sel2.isCollapsed) {
            const text = sel2.toString().trim();
            if (text) {
              const s = loadMemoSheets();
              if (s[0]) {
                appendToMemoSheet(s[0].id, text);
                window.dispatchEvent(new Event("memo-updated"));
              }
            }
          }
          return;
        }
        const text = sel.toString().trim();
        if (text) {
          const s = loadMemoSheets();
          if (s[0]) {
            appendToMemoSheet(s[0].id, text);
            window.dispatchEvent(new Event("memo-updated"));
          }
        }
      });

      // 全コピー
      pw.document.getElementById("btn-copy-all")?.addEventListener("click", () => {
        const s = loadMemoSheets();
        if (s[0]) navigator.clipboard.writeText(s[0].content);
      });

      // メモアイテムイベント
      bindMemoItemEvents(pw);

      // 小窓が閉じられたとき
      pw.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipActive(false);
      });

    } catch (err) {
      console.error("PiP open failed:", err);
    }
  }, [bindMemoItemEvents]);

  const closePip = useCallback(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setPipActive(false);
  }, []);

  if (!isMounted) return null;

  return (
    <button
      onClick={pipActive ? closePip : openPip}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl text-white text-sm font-medium transition-all hover:scale-105 active:scale-95"
      style={{ background: pipActive ? "#1D9E75" : "#378ADD" }}
      title="メモ小窓を開く / 閉じる"
    >
      <span className="text-base">🪟</span>
      <span>{pipActive ? "小窓を閉じる" : "メモ小窓"}</span>
      {memoCount > 0 && (
        <span className="bg-white/25 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
          {memoCount}
        </span>
      )}
    </button>
  );
}
