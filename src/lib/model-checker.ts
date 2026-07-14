const KNOWN_BETTER_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash",
  "gemini-3-flash-preview",
];

const STORAGE_KEY = "dermapdf_model_check";
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7日

export interface ModelCheckResult {
  hasNewer: boolean;
  newerModels: string[];
  lastChecked: string;
}

// apiKey は互換のため残すが未使用（APIキーはサーバのみが持つ）。
// モデル一覧の取得はサーバルート /api/gemini/models 経由で行う。
export async function checkForNewerGeminiModel(
  apiKey?: string
): Promise<ModelCheckResult> {
  void apiKey;
  const stored = localStorage.getItem(STORAGE_KEY);
  const lastCheck = stored ? JSON.parse(stored) : null;
  const now = Date.now();

  if (lastCheck && now - lastCheck.timestamp < CHECK_INTERVAL_MS) {
    return {
      hasNewer: lastCheck.hasNewer,
      newerModels: lastCheck.newerModels,
      lastChecked: new Date(lastCheck.timestamp).toLocaleDateString("ja-JP"),
    };
  }

  try {
    const res = await fetch("/api/gemini/models");
    const data = await res.json();
    const modelNames: string[] = data.models || [];

    const newerModels = KNOWN_BETTER_MODELS.filter((m) =>
      modelNames.includes(m)
    );

    const result = {
      hasNewer: newerModels.length > 0,
      newerModels,
      timestamp: now,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));

    return {
      hasNewer: result.hasNewer,
      newerModels: result.newerModels,
      lastChecked: new Date(now).toLocaleDateString("ja-JP"),
    };
  } catch {
    return { hasNewer: false, newerModels: [], lastChecked: "確認失敗" };
  }
}

export function forceModelCheck() {
  localStorage.removeItem(STORAGE_KEY);
}
