"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { loadMemoSheets, appendToMemoSheet, updateMemoSheet, type MemoSheet } from "@/lib/memo-storage";

// PiP小窓内にトースト通知を表示
function showToast(pw: Window, msg: string) {
  const el = pw.document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", bottom: "8px", left: "50%", transform: "translateX(-50%)",
    background: "#1e40af", color: "#fff", padding: "4px 12px", borderRadius: "8px",
    fontSize: "11px", zIndex: "9999", whiteSpace: "nowrap",
  });
  pw.document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// メモ行をHTML化（新しいもの上）
function buildMemoItemsHTML(sheet: MemoSheet | undefined): string {
  if (!sheet || !sheet.content.trim()) {
    return '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">メモはまだありません</div>';
  }
  const lines = sheet.content.split("\n").filter((l) => l.trim());
  // 新しいものを上に表示（逆順）
  return [...lines].reverse().map((line, i) => {
    const origIdx = lines.length - 1 - i;
    return `
      <div class="memo-item" style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(59,130,246,0.15);font-size:12px;line-height:1.5;">
        <div style="flex:1;word-break:break-word;color:#1e3a5f;">${line}</div>
        <button class="btn-copy-item" data-index="${origIdx}" style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:11px;color:#64748b;padding:2px;" title="コピー">📋</button>
        <button class="btn-del-item" data-index="${origIdx}" style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:11px;color:#94a3b8;padding:2px;" title="削除">✕</button>
      </div>`;
  }).join("");
}

// PiP小窓のHTML構造を生成
function buildPipHTML(sheets: MemoSheet[]): string {
  const activeSheet = sheets[0];
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
  #pip-editor-area { min-height:50px; border:1px solid rgba(59,130,246,0.3); border-radius:6px; padding:6px 8px; font-size:12px; outline:none; background:rgba(255,255,255,0.7); flex-shrink:0; margin:6px 10px; line-height:1.5; color:#1e3a5f; }
  #pip-editor-area:empty:before { content:attr(data-placeholder); color:#94a3b8; }
  #memo-list { flex:1; overflow-y:auto; background:rgba(255,255,255,0.5); }
  #pip-footer { display:flex; gap:6px; padding:8px 10px; background:rgba(255,255,255,0.8); border-top:1px solid rgba(59,130,246,0.2); flex-shrink:0; }
  #pip-footer button { flex:1; padding:6px 8px; border:none; border-radius:8px; font-size:11px; font-weight:500; cursor:pointer; transition:opacity 0.15s; }
  #pip-footer button:hover { opacity:0.85; }
  .btn-primary { background:#378ADD; color:#fff; }
  .btn-secondary { background:#e2e8f0; color:#475569; }
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
  <div id="pip-editor-area" contenteditable="true" data-placeholder="ここに入力またはテキストを選択して書式適用..."></div>
  <div id="memo-list">${buildMemoItemsHTML(activeSheet)}</div>
  <div id="count">${activeSheet ? activeSheet.content.length : 0}文字</div>
  <div id="pip-footer">
    <button class="btn-primary" id="btn-save">📌 エディタ内容を保存</button>
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
    if (list) {
      list.innerHTML = buildMemoItemsHTML(activeSheet);
      bindMemoItemEvents(pw);
    }
    if (countEl) countEl.textContent = `${activeSheet.content.length}文字`;
  }, []);

  const bindMemoItemEvents = useCallback((pw: Window) => {
    pw.document.querySelectorAll(".btn-copy-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number((btn as HTMLElement).dataset.index);
        const sheets = loadMemoSheets();
        const lines = sheets[0]?.content.split("\n").filter((l) => l.trim()) || [];
        if (lines[idx]) {
          window.navigator.clipboard.writeText(lines[idx])
            .then(() => showToast(pw, "✅ コピー"))
            .catch(() => {});
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
  }, []);

  const openPip = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dPiP = (window as any).documentPictureInPicture;
    if (!dPiP) {
      alert("この機能にはChrome 116以降が必要です");
      return;
    }

    try {
      const pw: Window = await dPiP.requestWindow({ width: 320, height: 480 });
      pipWindowRef.current = pw;
      setPipActive(true);

      const sheets = loadMemoSheets();
      pw.document.open();
      pw.document.write(buildPipHTML(sheets));
      pw.document.close();

      const d = pw.document;
      const editor = d.getElementById("pip-editor-area");

      // ツールバーボタン: onmousedown + preventDefault + フォーカス戻し + execCommand
      const setupBtn = (id: string, cmd: string, val?: string) => {
        const btn = d.getElementById(id);
        if (!btn) return;
        btn.onmousedown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (editor) editor.focus();
          pw.document.execCommand(cmd, false, val ?? undefined);
        };
      };
      setupBtn("btn-bold", "bold");
      setupBtn("btn-italic", "italic");
      setupBtn("btn-underline", "underline");
      setupBtn("fc-red", "foreColor", "#ef4444");
      setupBtn("fc-blue", "foreColor", "#3b82f6");
      setupBtn("fc-green", "foreColor", "#22c55e");
      setupBtn("fc-orange", "foreColor", "#f59e0b");
      setupBtn("hl-yellow", "backColor", "#fef08a");
      setupBtn("hl-sky", "backColor", "#bae6fd");
      setupBtn("hl-pink", "backColor", "#fecdd3");
      setupBtn("btn-remove", "removeFormat");

      // 全消去
      d.getElementById("btn-clear-all")?.addEventListener("click", () => {
        if (pw.confirm("メモを全て消去しますか？")) {
          const s = loadMemoSheets();
          if (s[0]) {
            updateMemoSheet(s[0].id, "");
            window.dispatchEvent(new Event("memo-updated"));
          }
        }
      });

      // エディタ内容を保存
      d.getElementById("btn-save")?.addEventListener("click", () => {
        if (!editor) return;
        const text = editor.innerText.trim();
        if (!text) {
          // エディタが空ならメインウィンドウの選択を保存
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) {
            const mainText = sel.toString().trim();
            if (mainText) {
              const s = loadMemoSheets();
              if (s[0]) {
                appendToMemoSheet(s[0].id, mainText);
                window.dispatchEvent(new Event("memo-updated"));
                showToast(pw, "✅ メインウィンドウから保存");
              }
            }
          }
          return;
        }
        const s = loadMemoSheets();
        if (s[0]) {
          appendToMemoSheet(s[0].id, text);
          window.dispatchEvent(new Event("memo-updated"));
          editor.innerHTML = "";
          showToast(pw, "✅ 保存しました");
        }
      });

      // 全コピー
      d.getElementById("btn-copy-all")?.addEventListener("click", () => {
        const s = loadMemoSheets();
        if (!s[0]) return;
        const text = s[0].content;
        window.navigator.clipboard.writeText(text)
          .then(() => showToast(pw, "✅ コピーしました"))
          .catch(() => {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            showToast(pw, "✅ コピーしました");
          });
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
