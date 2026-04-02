export interface AnalysisTemplate {
  id: string;
  name: string;
  createdAt: string;
  // Gemini分析設定
  analysisType: string;
  analysisPurpose: string;
  // Genspark設定
  gensparkTarget: string;
  gensparkLevel: string;
  gensparkPurpose: string;
  gensparkTone: string;
  gensparkNotes: string;
  // メモ
  memo: string;
}

const TEMPLATE_KEY = "dermapdf_templates";
const DEFAULTS_INITIALIZED_KEY = "dermapdf_templates_defaults_initialized";

const DEFAULT_TEMPLATES: Omit<AnalysisTemplate, "id" | "createdAt">[] = [
  {
    name: "管理職研修用",
    analysisType: "training_summary",
    analysisPurpose: "",
    gensparkTarget: "management",
    gensparkLevel: "detailed",
    gensparkPurpose: "educate",
    gensparkTone: "professional",
    gensparkNotes: "",
    memo: "管理職向け研修資料の分析・プレゼン用テンプレート",
  },
  {
    name: "全スタッフ情報共有用",
    analysisType: "summary",
    analysisPurpose: "",
    gensparkTarget: "all_staff",
    gensparkLevel: "standard",
    gensparkPurpose: "inform",
    gensparkTone: "friendly",
    gensparkNotes: "",
    memo: "全スタッフへの情報共有・周知用テンプレート",
  },
  {
    name: "新人育成用",
    analysisType: "training_newcomer",
    analysisPurpose: "",
    gensparkTarget: "new_staff",
    gensparkLevel: "simple",
    gensparkPurpose: "educate",
    gensparkTone: "friendly",
    gensparkNotes: "",
    memo: "新人スタッフ向けの育成資料用テンプレート",
  },
];

export function initDefaultTemplates(): void {
  if (localStorage.getItem(DEFAULTS_INITIALIZED_KEY)) return;
  const existing = loadTemplates();
  if (existing.length === 0) {
    const templates = DEFAULT_TEMPLATES.map((t) => ({
      ...t,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }));
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
  }
  localStorage.setItem(DEFAULTS_INITIALIZED_KEY, "1");
}

export function saveTemplate(
  t: Omit<AnalysisTemplate, "id" | "createdAt">
): AnalysisTemplate {
  const templates = loadTemplates();
  const newT: AnalysisTemplate = {
    ...t,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  templates.unshift(newT);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates.slice(0, 30)));
  window.dispatchEvent(new Event("templatesUpdated"));
  return newT;
}

export function loadTemplates(): AnalysisTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function deleteTemplate(id: string): void {
  const templates = loadTemplates().filter((t) => t.id !== id);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
  window.dispatchEvent(new Event("templatesUpdated"));
}

export function updateTemplate(
  id: string,
  updates: Partial<AnalysisTemplate>
): void {
  const templates = loadTemplates().map((t) =>
    t.id === id ? { ...t, ...updates } : t
  );
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
  window.dispatchEvent(new Event("templatesUpdated"));
}
