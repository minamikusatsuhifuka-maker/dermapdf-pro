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

const STORAGE_KEY = "dermapdf-clinic-settings";

export interface ClinicSettings {
  clinicName: string;
  purpose: string;
  mission: string;
  vision: string;
  values: string;
  slogan: string;
}

const DEFAULT_SETTINGS: ClinicSettings = {
  clinicName: "",
  purpose: "",
  mission: "",
  vision: "",
  values: "",
  slogan: "",
};

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

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleChange = (key: keyof ClinicSettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(form);
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
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              ) : (
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-400 to-purple-400 px-6 py-3 text-sm font-bold text-white shadow-lg"
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
    <div className="rounded-2xl border border-white/40 bg-gradient-to-r from-rose-50 to-purple-50 p-4 shadow-sm">
      {settings.clinicName && (
        <p className="font-[family-name:var(--font-zen-maru)] text-sm font-bold text-gray-700">
          {settings.clinicName}
        </p>
      )}
      {settings.slogan && (
        <p className="mt-1 bg-gradient-to-r from-rose-500 to-purple-500 bg-clip-text text-xs font-medium text-transparent">
          {settings.slogan}
        </p>
      )}
      {settings.purpose && (
        <p className="mt-1 text-xs text-gray-500">{settings.purpose}</p>
      )}
    </div>
  );
}
