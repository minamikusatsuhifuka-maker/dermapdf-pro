const KNOWN_BETTER_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
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

export async function checkForNewerGeminiModel(
  apiKey: string
): Promise<ModelCheckResult> {
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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await res.json();
    const modelNames: string[] = (
      data.models || []
    ).map((m: { name: string }) => m.name.replace("models/", ""));

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
