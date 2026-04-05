"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { CURRENT_MODEL } from "@/lib/gemini-client";
import {
  checkForNewerGeminiModel,
  forceModelCheck,
  type ModelCheckResult,
} from "@/lib/model-checker";

interface ApiStatus {
  pdfCo: boolean;
  removeBg: boolean;
  gemini: boolean;
}

interface HeaderProps {
  apiStatus?: ApiStatus;
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      className={
        active
          ? "bg-green-100 text-green-700 border-green-300"
          : "bg-gray-100 text-gray-400 border-gray-300"
      }
    >
      {active ? (
        <CheckCircle className="mr-1 h-3 w-3" />
      ) : (
        <XCircle className="mr-1 h-3 w-3" />
      )}
      {label}
    </Badge>
  );
}

export function Header({ apiStatus }: HeaderProps) {
  const [status, setStatus] = useState<ApiStatus>(apiStatus ?? { pdfCo: false, removeBg: false, gemini: false });
  const [modelCheck, setModelCheck] = useState<ModelCheckResult | null>(null);

  // APIキーの存在を動的にチェック
  useEffect(() => {
    fetch("/api/check-keys")
      .then((r) => r.json())
      .then((data: ApiStatus) => setStatus(data))
      .catch(() => {});
  }, []);

  const runCheck = useCallback(async () => {
    try {
      const res = await fetch("/api/get-gemini-key");
      const data = await res.json();
      if (!data.key) return;
      const result = await checkForNewerGeminiModel(data.key);
      setModelCheck(result);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const handleForceCheck = () => {
    forceModelCheck();
    runCheck();
  };

  return (
    <header className="w-full">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-white/40 bg-white/60 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-zen-maru)] text-2xl font-bold">
                <span className="bg-gradient-to-r from-slate-500 via-slate-600 to-slate-700 bg-clip-text text-transparent">
                  🌸 DermaPDF Pro
                </span>
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                皮膚科・美容皮膚科クリニック向け 統合ツールキット（設定・機能管理）
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="PDF.co" active={status.pdfCo} />
              <StatusBadge label="remove.bg" active={status.removeBg} />
              <StatusBadge label="Gemini AI" active={status.gemini} />
              <button
                onClick={handleForceCheck}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                title="クリックして最新モデルを再チェック"
              >
                🤖 {CURRENT_MODEL.replace("gemini-", "Gemini ")}
              </button>
              <a
                href="https://www.genspark.ai/ai_slides?tab=explore"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
              >
                <span>✨</span>
                <span>Gensparkで資料作成</span>
                <span>→</span>
              </a>
            </div>
          </div>

          {/* モデルアップデートアラート */}
          {modelCheck?.hasNewer && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span>⚡</span>
              <span>
                より新しいGeminiモデルが利用可能です（現在: {CURRENT_MODEL}）：
                <strong>{modelCheck.newerModels.join(", ")}</strong>
              </span>
              <span className="text-amber-600">※ preview版は有料のみ。現在のgemini-2.5-proは安定・無料枠あり。</span>
              <button
                onClick={handleForceCheck}
                className="ml-auto text-amber-600 underline"
              >
                再チェック
              </button>
            </div>
          )}

          {modelCheck && (
            <p className="mt-1 text-right text-[10px] text-gray-400">
              最終チェック日: {modelCheck.lastChecked}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
