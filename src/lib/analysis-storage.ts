export interface AnalysisRecord {
  id: string;
  createdAt: string;
  fileName: string;
  analysisType: string;
  analysisLabel: string;
  content: string;
  tags: string[];
}

const STORAGE_KEY = "dermapdf_analysis_stock";

export function saveAnalysis(
  record: Omit<AnalysisRecord, "id" | "createdAt">
): AnalysisRecord {
  const records = loadAllAnalyses();
  const newRecord: AnalysisRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  records.unshift(newRecord);
  const trimmed = records.slice(0, 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  window.dispatchEvent(new Event("analysisStockUpdated"));
  return newRecord;
}

export function loadAllAnalyses(): AnalysisRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function deleteAnalysis(id: string): void {
  const records = loadAllAnalyses().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function clearAllAnalyses(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportAnalysesAsJSON(): void {
  const data = loadAllAnalyses();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dermapdf_analyses_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAnalysesAsText(): void {
  const data = loadAllAnalyses();
  const text = data
    .map(
      (r) =>
        `【${r.analysisLabel}】${r.fileName}\n${new Date(r.createdAt).toLocaleString("ja-JP")}\n${"─".repeat(40)}\n${r.content}\n`
    )
    .join("\n\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dermapdf_analyses_${new Date().toISOString().split("T")[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
