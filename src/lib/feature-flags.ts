export interface FeatureFlags {
  staffKarute: boolean;
  monthlyReport: boolean;
  templatePanel: boolean;
  // 保存カードの保存先を IndexedDB にする（既定 OFF）。
  // ブラウザ単位の有効化は localStorage の dermapdf_storage_driver="idb" で判定し、こちらは全体既定値。
  idbStorage?: boolean;
}

const FLAGS_KEY = "dermapdf_feature_flags";

const DEFAULT_FLAGS: FeatureFlags = {
  staffKarute: true,
  monthlyReport: true,
  templatePanel: true,
  idbStorage: false,
};

export function loadFeatureFlags(): FeatureFlags {
  try {
    const stored = localStorage.getItem(FLAGS_KEY);
    return stored ? { ...DEFAULT_FLAGS, ...JSON.parse(stored) } : DEFAULT_FLAGS;
  } catch {
    return DEFAULT_FLAGS;
  }
}

export function saveFeatureFlags(flags: FeatureFlags): void {
  localStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
  window.dispatchEvent(new Event("featureFlagsUpdated"));
}
