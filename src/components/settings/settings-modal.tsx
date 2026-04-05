"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toastOk } from "@/components/ui/toast-provider";
import { loadFeatureFlags, saveFeatureFlags, type FeatureFlags } from "@/lib/feature-flags";
import { hasDeletePassword, setDeletePassword, removeDeletePassword } from "@/lib/analysis-storage";

const STORAGE_KEY = "dermapdf-clinic-settings";

export interface ClinicSettings {
  clinicName: string;
  purpose: string;
  mission: string;
  vision: string;
  values: string;
  slogan: string;
  // アチーブメント哲学
  choiceTheoryEnabled: boolean;
  priorityNeeds: string[];
  developmentPolicy: string;
}

const DEFAULT_SETTINGS: ClinicSettings = {
  clinicName: "",
  purpose: "",
  mission: "",
  vision: "",
  values: "",
  slogan: "",
  choiceTheoryEnabled: false,
  priorityNeeds: [],
  developmentPolicy: "",
};

const NEED_OPTIONS = [
  { value: "生存", label: "生存の欲求" },
  { value: "愛・所属", label: "愛・所属の欲求" },
  { value: "力・承認", label: "力・承認の欲求" },
  { value: "自由", label: "自由の欲求" },
  { value: "楽しみ", label: "楽しみの欲求" },
];

export function buildPhilosophyContext(settings: ClinicSettings): string {
  const parts: string[] = [];
  if (settings.clinicName) parts.push(`【クリニック名】${settings.clinicName}`);
  if (settings.purpose) parts.push(`【経営理念・パーパス】${settings.purpose}`);
  if (settings.mission) parts.push(`【ミッション】${settings.mission}`);
  if (settings.vision) parts.push(`【ビジョン】${settings.vision}`);
  if (settings.values) parts.push(`【バリュー】${settings.values}`);
  if (settings.slogan) parts.push(`【スローガン】${settings.slogan}`);
  if (settings.choiceTheoryEnabled) {
    parts.push("【選択理論活用】有効");
    if (settings.priorityNeeds.length > 0) {
      parts.push(`【重視する欲求】${settings.priorityNeeds.join("・")}`);
    }
  }
  if (settings.developmentPolicy) {
    parts.push(`【育成方針】${settings.developmentPolicy}`);
  }
  if (parts.length === 0) return "";
  return (
    "\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n【クリニック理念コンテキスト】\n以下の理念・哲学と一致した内容・言葉遣いで出力してください。\n" +
    parts.join("\n") +
    "\n━━━━━━━━━━━━━━━━━━━━━━━━"
  );
}

export function useClinicSettings() {
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSettings(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const save = useCallback((newSettings: ClinicSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  }, []);

  const context = [
    settings.purpose,
    settings.mission,
    settings.vision,
    settings.values,
    settings.slogan,
  ]
    .filter(Boolean)
    .join("\n");

  return { settings, save, context };
}

interface SettingsModalProps {
  settings: ClinicSettings;
  onSave: (settings: ClinicSettings) => void;
}

export function SettingsModal({ settings, onSave }: SettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClinicSettings>(settings);
  const [flags, setFlags] = useState<FeatureFlags>({ staffKarute: true, monthlyReport: true, templatePanel: true });
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (open) {
      setFlags(loadFeatureFlags());
      setHasPassword(hasDeletePassword());
    }
  }, [open]);

  const handleChange = (key: keyof ClinicSettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleNeed = (need: string) => {
    setForm((prev) => ({
      ...prev,
      priorityNeeds: prev.priorityNeeds.includes(need)
        ? prev.priorityNeeds.filter((n) => n !== need)
        : [...prev.priorityNeeds, need],
    }));
  };

  const handleSave = () => {
    onSave(form);
    saveFeatureFlags(flags);
    toastOk("設定を保存しました");
    setOpen(false);
  };

  const fields: { key: keyof ClinicSettings; label: string; multiline?: boolean }[] = [
    { key: "clinicName", label: "クリニック名" },
    { key: "purpose", label: "理念（Purpose）", multiline: true },
    { key: "mission", label: "ミッション", multiline: true },
    { key: "vision", label: "ビジョン", multiline: true },
    { key: "values", label: "バリュー", multiline: true },
    { key: "slogan", label: "スローガン" },
  ];

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-2 rounded-xl bg-white/60 px-4 py-2 text-sm font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80">
            <Settings className="h-4 w-4" /> 設定
          </button>
        }
      />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>クリニック設定</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fields.map(({ key, label, multiline }) => (
            <div key={key}>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                {label}
              </label>
              {multiline ? (
                <textarea
                  value={form[key] as string}
                  onChange={(e) => handleChange(key, e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              ) : (
                <input
                  type="text"
                  value={form[key] as string}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={inputClass}
                />
              )}
            </div>
          ))}
        </div>

        {/* アチーブメント哲学セクション */}
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-bold text-gray-700">アチーブメント哲学</h3>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600">選択理論活用</label>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, choiceTheoryEnabled: !prev.choiceTheoryEnabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.choiceTheoryEnabled ? "bg-[#4f6272]" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.choiceTheoryEnabled ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
            <span className="text-xs text-gray-400">{form.choiceTheoryEnabled ? "ON" : "OFF"}</span>
          </div>

          {form.choiceTheoryEnabled && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-600">重視する欲求</label>
              <div className="flex flex-wrap gap-2">
                {NEED_OPTIONS.map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.priorityNeeds.includes(opt.value)}
                      onChange={() => handleToggleNeed(opt.value)}
                      className="rounded border-gray-300 text-[#4f6272] focus:ring-slate-300"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">育成方針メモ</label>
            <textarea
              value={form.developmentPolicy}
              onChange={(e) => setForm((prev) => ({ ...prev, developmentPolicy: e.target.value }))}
              placeholder="例：リードマネジメントを土台とした内発的動機重視"
              rows={3}
              className={inputClass}
            />
          </div>
        </div>

        {/* 機能管理セクション */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">機能管理</h3>
          <p className="text-xs text-gray-500 mb-3">
            使用しない機能をOFFにするとページがすっきりします
          </p>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <div className="text-sm font-medium text-gray-700">スタッフカルテ</div>
              <div className="text-xs text-gray-400">スタッフの育成記録・1on1管理</div>
            </div>
            <button
              type="button"
              onClick={() => setFlags((prev) => ({ ...prev, staffKarute: !prev.staffKarute }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${flags.staffKarute ? "bg-[#4f6272]" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${flags.staffKarute ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <div className="text-sm font-medium text-gray-700">定期レポート生成</div>
              <div className="text-xs text-gray-400">ストック分析からレポートを自動生成</div>
            </div>
            <button
              type="button"
              onClick={() => setFlags((prev) => ({ ...prev, monthlyReport: !prev.monthlyReport }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${flags.monthlyReport ? "bg-[#4f6272]" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${flags.monthlyReport ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium text-gray-700">テンプレート</div>
              <div className="text-xs text-gray-400">分析設定を保存して呼び出し</div>
            </div>
            <button
              type="button"
              onClick={() => setFlags((prev) => ({ ...prev, templatePanel: !prev.templatePanel }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${flags.templatePanel ? "bg-[#4f6272]" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${flags.templatePanel ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        {/* 削除パスワード */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-bold text-gray-700 mb-1">🔐 削除パスワード</h3>
          <p className="text-xs text-gray-500 mb-3">
            設定するとストック削除時にパスワードが必要になります
          </p>

          {hasPassword ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span>🔒</span>
                <span>削除パスワードが設定されています</span>
              </div>
              <button
                onClick={() => {
                  if (confirm("削除パスワードを解除しますか？")) {
                    removeDeletePassword();
                    setHasPassword(false);
                  }
                }}
                className="text-xs text-red-500 underline hover:text-red-700"
              >
                パスワードを解除する
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="password"
                placeholder="新しいパスワードを入力"
                id="new-delete-password"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-slate-400"
              />
              <input
                type="password"
                placeholder="パスワードを確認"
                id="confirm-delete-password"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-slate-400"
              />
              <button
                onClick={() => {
                  const p1 = (document.getElementById("new-delete-password") as HTMLInputElement).value;
                  const p2 = (document.getElementById("confirm-delete-password") as HTMLInputElement).value;
                  if (!p1) { alert("パスワードを入力してください"); return; }
                  if (p1 !== p2) { alert("パスワードが一致しません"); return; }
                  setDeletePassword(p1);
                  setHasPassword(true);
                  alert("✅ 削除パスワードを設定しました");
                }}
                className="w-full px-3 py-2 text-xs bg-[#4f6272] text-white rounded-lg hover:bg-[#3d5260] transition-colors"
              >
                パスワードを設定する
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f6272] hover:bg-[#3d5260] px-6 py-3 text-sm font-bold text-white shadow-lg"
        >
          <Save className="h-4 w-4" /> 保存
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function PhilosophyBanner({ settings }: { settings: ClinicSettings }) {
  const hasContent = settings.purpose || settings.slogan;
  if (!hasContent) return null;

  return (
    <div className="rounded-2xl border border-white/40 bg-gradient-to-r from-slate-50 to-stone-50 p-4 shadow-sm">
      {settings.clinicName && (
        <p className="font-[family-name:var(--font-zen-maru)] text-sm font-bold text-gray-700">
          {settings.clinicName}
        </p>
      )}
      {settings.slogan && (
        <p className="mt-1 bg-gradient-to-r from-slate-500 to-slate-600 bg-clip-text text-xs font-medium text-transparent">
          {settings.slogan}
        </p>
      )}
      {settings.purpose && (
        <p className="mt-1 text-xs text-gray-500">{settings.purpose}</p>
      )}
    </div>
  );
}
