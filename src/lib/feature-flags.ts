export interface FeatureFlags {
  staffKarute: boolean;
  monthlyReport: boolean;
  templatePanel: boolean;
}

const FLAGS_KEY = "dermapdf_feature_flags";

const DEFAULT_FLAGS: FeatureFlags = {
  staffKarute: true,
  monthlyReport: true,
  templatePanel: true,
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
