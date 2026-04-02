export interface StaffProfile {
  id: string;
  name: string;
  role: string;
  joinDate: string;
  createdAt: string;
  dominantNeeds: string[];
  qualityWorld: string;
  growthMemo: string;
  currentGoal: string;
  goalDeadline: string;
}

export interface StaffRecord {
  id: string;
  staffId: string;
  date: string;
  type: "oneon1" | "feedback" | "goal" | "memo" | "achievement";
  typeLabel: string;
  content: string;
  analysisId?: string;
}

const STAFF_KEY = "dermapdf_staff_profiles";
const STAFF_RECORDS_KEY = "dermapdf_staff_records";

export function saveStaffProfile(
  p: Omit<StaffProfile, "id" | "createdAt">
): StaffProfile {
  const profiles = loadStaffProfiles();
  const newP: StaffProfile = {
    ...p,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  profiles.unshift(newP);
  localStorage.setItem(STAFF_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event("staffUpdated"));
  return newP;
}

export function loadStaffProfiles(): StaffProfile[] {
  try {
    return JSON.parse(localStorage.getItem(STAFF_KEY) || "[]");
  } catch {
    return [];
  }
}

export function updateStaffProfile(
  id: string,
  updates: Partial<StaffProfile>
): void {
  const profiles = loadStaffProfiles().map((p) =>
    p.id === id ? { ...p, ...updates } : p
  );
  localStorage.setItem(STAFF_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event("staffUpdated"));
}

export function deleteStaffProfile(id: string): void {
  const profiles = loadStaffProfiles().filter((p) => p.id !== id);
  localStorage.setItem(STAFF_KEY, JSON.stringify(profiles));
  // 関連する記録も削除
  const allRecords = loadAllStaffRecords().filter((r) => r.staffId !== id);
  localStorage.setItem(STAFF_RECORDS_KEY, JSON.stringify(allRecords));
  window.dispatchEvent(new Event("staffUpdated"));
}

export function saveStaffRecord(
  r: Omit<StaffRecord, "id">
): StaffRecord {
  const records = loadAllStaffRecords();
  const newR: StaffRecord = { ...r, id: crypto.randomUUID() };
  records.unshift(newR);
  localStorage.setItem(STAFF_RECORDS_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("staffUpdated"));
  return newR;
}

export function loadStaffRecords(staffId: string): StaffRecord[] {
  return loadAllStaffRecords()
    .filter((r) => r.staffId === staffId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function deleteStaffRecord(id: string): void {
  const records = loadAllStaffRecords().filter((r) => r.id !== id);
  localStorage.setItem(STAFF_RECORDS_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("staffUpdated"));
}

function loadAllStaffRecords(): StaffRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STAFF_RECORDS_KEY) || "[]");
  } catch {
    return [];
  }
}
