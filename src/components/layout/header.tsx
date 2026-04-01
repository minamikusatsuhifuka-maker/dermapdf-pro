"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

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
  const status = apiStatus ?? { pdfCo: false, removeBg: false, gemini: false };

  return (
    <header className="w-full">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="rounded-2xl border border-white/40 bg-white/60 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-zen-maru)] text-2xl font-bold">
                <span className="bg-gradient-to-r from-rose-400 via-rose-500 to-purple-400 bg-clip-text text-transparent">
                  🌸 DermaPDF Pro
                </span>
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                皮膚科・美容皮膚科クリニック向け 統合ツールキット
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label="PDF.co" active={status.pdfCo} />
              <StatusBadge label="remove.bg" active={status.removeBg} />
              <StatusBadge label="Gemini AI" active={status.gemini} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
