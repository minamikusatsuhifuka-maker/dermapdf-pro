"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { MessageSquare, Copy, Loader2 } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";

type MessageType = "patient" | "staff" | "recruit" | "sns" | "dm";

const MESSAGE_LABELS: Record<MessageType, string> = {
  patient: "患者向けメッセージ",
  staff: "スタッフ向けメッセージ",
  recruit: "採用メッセージ",
  sns: "SNS投稿",
  dm: "DM・個別メッセージ",
};

const MESSAGE_PROMPTS: Record<MessageType, string> = {
  patient: "以下の内容をもとに、患者様向けの丁寧で分かりやすいメッセージを日本語で作成してください。安心感を与えるトーンでお願いします。",
  staff: "以下の内容をもとに、スタッフ向けの業務連絡メッセージを日本語で作成してください。明確で行動しやすい内容にしてください。",
  recruit: "以下の内容をもとに、採用候補者向けのメッセージを日本語で作成してください。クリニックの魅力が伝わるようにしてください。",
  sns: "以下の内容をもとに、SNS投稿用のメッセージを日本語で作成してください。簡潔で目を引く内容にしてください。ハッシュタグも含めてください。",
  dm: "以下の内容をもとに、個別送信用のDMメッセージを日本語で作成してください。パーソナルで温かいトーンでお願いします。",
};

interface MessagePanelProps {
  fileBase64?: string;
  fileMime?: string;
  fileName?: string;
  clinicContext?: string;
}

export function MessagePanel({
  fileBase64,
  fileMime,
  fileName,
  clinicContext,
}: MessagePanelProps) {
  const [messageType, setMessageType] = useState<MessageType>("patient");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!fileBase64 || !fileMime || !fileName) {
      toastError("ファイルが選択されていません");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      let prompt = MESSAGE_PROMPTS[messageType];
      if (clinicContext) {
        prompt = `クリニック理念: ${clinicContext}\n\n${prompt}`;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: fileBase64,
          mime: fileMime,
          fileName,
          prompt,
        }),
      });

      let data: { success?: boolean; error?: string; analysis?: string };
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        data = { success: false, error: "サーバーエラーが発生しました" };
      }
      if (!data.success && data.error) throw new Error(data.error);

      setResult(data.analysis ?? "");
      toastOk("メッセージを生成しました");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "生成に失敗しました";
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    toastOk("クリップボードにコピーしました");
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-700">
        <MessageSquare className="h-5 w-5 text-purple-500" />
        メッセージ生成
      </h2>

      {/* 種類選択 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          メッセージ種類
        </label>
        <select
          value={messageType}
          onChange={(e) => setMessageType(e.target.value as MessageType)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
        >
          {(Object.entries(MESSAGE_LABELS) as [MessageType, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </select>
      </div>

      {/* 生成ボタン */}
      <button
        onClick={handleGenerate}
        disabled={loading || !fileBase64}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-400 via-rose-500 to-purple-400 px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
        {loading ? "生成中..." : "メッセージ生成"}
      </button>

      {/* 結果表示 */}
      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-100 bg-white/80 p-4">
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-4 py-2 text-sm font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
          >
            <Copy className="h-3.5 w-3.5" /> コピー
          </button>
        </div>
      )}
    </div>
  );
}
