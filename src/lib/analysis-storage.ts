import { cleanupLatexNotation } from "@/lib/latex-cleanup";
import { markdownToPlainText } from "@/lib/markdown-plain";
import { loadFeatureFlags } from "@/lib/feature-flags";

export interface AnalysisRecord {
  id: string;
  createdAt: string;
  fileName: string;
  analysisType: string;
  analysisLabel: string;
  content: string;
  tags: string[];
  folder: string;
  title?: string;
  updatedAt?: string;
  originalContent?: string;
  // 校正前（原文）。校正後本文(content)はクリーンに保ちつつ原文を紐づけ保持する。
  proofreadBefore?: string;
  locked?: boolean;
  favorite?: boolean;
  // AIが内容から自動付与するカテゴリ（folderとは独立。既存レコードはundefinedのままでよい）
  aiCategory?: string;
  // 同時実行（1回の実行で複数タイプ）で生成された結果を束ねるID。
  // 表示上だけ1枚のカードにまとめる（タブ切替）ためのもので、データは1レコード=1本文のまま。
  // 既存レコードは undefined のままで従来どおり1枚1カード。
  groupId?: string;
}

const STORAGE_KEY = "dermapdf_analysis_stock";

export const STORAGE_QUOTA_MESSAGE =
  "⚠ 保存容量がいっぱいのため保存できませんでした。不要なカードを削除するか、バックアップ後に整理してください";

// 保存容量（localStorage）が足りず書き込めなかったことを示すエラー。
// 呼び出し元は instanceof で判別し、ユーザーに分かる文言で通知する。
export class StorageQuotaError extends Error {
  constructor(message: string = STORAGE_QUOTA_MESSAGE) {
    super(message);
    this.name = "StorageQuotaError";
  }
}

// ブラウザが投げる容量超過例外の判定（Chrome/Safari: QuotaExceededError / code 22, Firefox: code 1014）
function isQuotaExceeded(err: unknown): boolean {
  if (err instanceof StorageQuotaError) return true;
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return (
      err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22 ||
      err.code === 1014
    );
  }
  return false;
}

// 保存系エラーをユーザー向け文言に変換する共通ヘルパー。
// 容量超過なら統一メッセージ、それ以外は err.message、無ければ fallback。
export function describeSaveError(err: unknown, fallback: string): string {
  if (err instanceof StorageQuotaError) return err.message;
  if (isQuotaExceeded(err)) return STORAGE_QUOTA_MESSAGE;
  return err instanceof Error && err.message ? err.message : fallback;
}

// ============================================================================
// 保存ドライバ層
//   - "local": 従来どおり localStorage に配列を丸ごと保存（挙動は完全に同じ）
//   - "idb":   メモリキャッシュ＋裏で IndexedDB へ永続化（1レコード1オブジェクト・keyPath=id）
// 公開関数はすべて同期のまま。呼び出し元（保護対象の本文編集・保存を含む）は一切変えない。
// ============================================================================
export type StorageDriverName = "local" | "idb";
const DRIVER_KEY = "dermapdf_storage_driver";
export const MIGRATED_KEY = "dermapdf_analysis_stock_migrated";
const IDB_NAME = "dermapdf";
const IDB_VERSION = 1;
const IDB_STORE = "analysis_stock";
const IDB_META = "meta";
const ORDER_META_KEY = "order";
const CHANNEL_NAME = "dermapdf_analysis_stock";
export const PERSIST_ERROR_EVENT = "analysisStockPersistError";

function notifyUpdated(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("analysisStockUpdated"));
}

// 設定されているドライバ名（ブラウザ単位の localStorage キー > 機能フラグ既定値）
export function getStorageDriverName(): StorageDriverName {
  if (typeof window === "undefined") return "local";
  try {
    const v = localStorage.getItem(DRIVER_KEY);
    if (v === "idb" || v === "local") return v;
  } catch {
    /* noop */
  }
  try {
    return loadFeatureFlags().idbStorage ? "idb" : "local";
  } catch {
    return "local";
  }
}

// 実際に動作中のドライバ（IDB が開けずフォールバックした場合は "local" になる）
let activeDriver: StorageDriverName | null = null;
function currentDriver(): StorageDriverName {
  if (activeDriver === null) {
    activeDriver = getStorageDriverName();
    if (activeDriver === "idb") void idbInit();
  }
  return activeDriver;
}
export function getActiveStorageDriver(): StorageDriverName {
  return currentDriver();
}

// ---- localStorage ドライバ（現行コードそのまま） ----
function localRead(): AnalysisRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function localWrite(records: AnalysisRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    if (isQuotaExceeded(err)) throw new StorageQuotaError();
    throw err;
  }
}

// ---- IndexedDB ドライバ ----
type IdbOp = { type: "put"; record: AnalysisRecord } | { type: "delete"; id: string };
let idbCache: AnalysisRecord[] = [];
let idbReady = false;
let idbReadyResolve: (() => void) | null = null;
const idbReadyPromise: Promise<void> = new Promise((res) => {
  idbReadyResolve = res;
});
const idbDirty = new Set<string>(); // 初期読み込み完了前にメモリで触った id（読み込み結果より優先）
const idbDeletedEarly = new Set<string>(); // 完了前に削除した id
let idbDbPromise: Promise<IDBDatabase> | null = null;
let idbQueue: IdbOp[] = [];
let idbFailedOps: IdbOp[] = []; // 再試行しきれなかった分（次のフラッシュで再度試す）
let idbOrderDirty = false;
let idbFlushing = false;
let idbReloadWanted = false;
let idbPersistFailed = false;
let idbChannel: BroadcastChannel | null = null;
const idbTabId = Math.random().toString(36).slice(2);
let storageEstimate: { usage: number; quota: number } | null = null;
let persistGranted: boolean | null = null;

function idbOpen(): Promise<IDBDatabase> {
  if (idbDbPromise) return idbDbPromise;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined" || indexedDB === null) {
      reject(new Error("IndexedDB が利用できません"));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(IDB_META)) db.createObjectStore(IDB_META, { keyPath: "key" });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB を開けませんでした"));
    req.onblocked = () => reject(new Error("IndexedDB が他のタブにブロックされています"));
  });
  idbDbPromise = p;
  p.catch(() => {
    idbDbPromise = null;
  });
  return p;
}

// 表示順は meta.order（id の配列）で保持する。無い id は createdAt 降順で末尾に付ける。
function applyOrder(records: AnalysisRecord[], ids?: string[]): AnalysisRecord[] {
  const map = new Map(records.map((r) => [r.id, r]));
  const out: AnalysisRecord[] = [];
  for (const id of ids ?? []) {
    const r = map.get(id);
    if (r) {
      out.push(r);
      map.delete(id);
    }
  }
  const rest = Array.from(map.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );
  return [...out, ...rest];
}

function idbReadAll(db: IDBDatabase): Promise<AnalysisRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IDB_STORE, IDB_META], "readonly");
    const all = tx.objectStore(IDB_STORE).getAll();
    const ord = tx.objectStore(IDB_META).get(ORDER_META_KEY);
    tx.oncomplete = () =>
      resolve(applyOrder(all.result as AnalysisRecord[], (ord.result as { ids?: string[] } | undefined)?.ids));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB の読み込みに失敗"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB の読み込みが中断"));
  });
}

function idbCount(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const c = tx.objectStore(IDB_STORE).count();
    c.onsuccess = () => resolve(c.result);
    c.onerror = () => reject(c.error ?? new Error("count failed"));
  });
}

async function idbInit(): Promise<void> {
  try {
    const db = await idbOpen();
    const stored = await idbReadAll(db);
    // 必須条件3: 完了前にメモリで触ったレコード（dirty）を優先して id でマージ
    const dirtyRecords = idbCache.filter((r) => idbDirty.has(r.id));
    const dirtyIds = new Set(dirtyRecords.map((r) => r.id));
    const hadEarlyChanges = dirtyRecords.length > 0 || idbDeletedEarly.size > 0;
    idbCache = [
      ...dirtyRecords,
      ...stored.filter((r) => !dirtyIds.has(r.id) && !idbDeletedEarly.has(r.id)),
    ];
    idbDirty.clear();
    idbDeletedEarly.clear();
    idbReady = true;
    if (hadEarlyChanges) {
      idbOrderDirty = true;
      scheduleFlush();
    }
    idbSetupChannel();
    idbSetupUnloadGuards();
    void idbRefreshEstimate();
    void idbRequestPersist();
    idbReadyResolve?.();
    // 必須条件4: 読み込み完了を既存イベントで通知（一覧・件数バッジが再読込する）
    notifyUpdated();
  } catch (err) {
    console.error("IndexedDB を初期化できないため localStorage に切り替えます:", err);
    idbFallbackToLocal();
  }
}

// IDB が使えない環境（プライベートモード等）は localStorage ドライバへ自動フォールバック。
// 完了前にメモリへ書いた分があれば localStorage に合流させる（best effort）。
function idbFallbackToLocal(): void {
  activeDriver = "local";
  if (idbCache.length > 0) {
    try {
      const existing = localRead();
      const ids = new Set(existing.map((r) => r.id));
      const add = idbCache.filter((r) => !ids.has(r.id));
      if (add.length > 0) localWrite([...add, ...existing]);
    } catch (e) {
      console.error("フォールバック時の合流に失敗:", e);
    }
  }
  idbCache = [];
  idbQueue = [];
  idbFailedOps = [];
  idbReady = true;
  idbReadyResolve?.();
  notifyUpdated();
}

// レコードの浅い比較（配列は内容で比較・undefined と欠落は同一視）
function shallowEqualRecord(a: AnalysisRecord, b: AnalysisRecord): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = (a as unknown as Record<string, unknown>)[k];
    const bv = (b as unknown as Record<string, unknown>)[k];
    if (av === bv) continue;
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length === bv.length && av.every((x, i) => x === bv[i])) continue;
      return false;
    }
    return false;
  }
  return true;
}

function idbWrite(records: AnalysisRecord[]): void {
  const prev = new Map(idbCache.map((r) => [r.id, r]));
  // 呼び出し元の配列・オブジェクトとは切り離して保持する（外から書き換えられてもキャッシュは汚れない）
  const next = records.map((r) => ({ ...r }));
  const nextIds = new Set<string>();
  for (const r of next) {
    nextIds.add(r.id);
    const p = prev.get(r.id);
    if (!p || !shallowEqualRecord(p, r)) {
      idbQueue.push({ type: "put", record: r });
      if (!idbReady) idbDirty.add(r.id);
    }
  }
  for (const id of prev.keys()) {
    if (!nextIds.has(id)) {
      idbQueue.push({ type: "delete", id });
      if (!idbReady) idbDeletedEarly.add(id);
      idbDirty.delete(id);
    }
  }
  const orderChanged =
    idbCache.length !== next.length || idbCache.some((r, i) => r.id !== next[i].id);
  if (orderChanged) idbOrderDirty = true;
  idbCache = next;
  scheduleFlush();
}

function idbHasPending(): boolean {
  return idbQueue.length > 0 || idbFailedOps.length > 0 || idbFlushing;
}

function scheduleFlush(): void {
  if (idbFlushing) return;
  idbFlushing = true;
  // 同期関数の直後（同じティック）に書き込みを発行する
  queueMicrotask(() => void idbFlush());
}

async function idbFlush(): Promise<void> {
  try {
    while (idbQueue.length > 0 || idbFailedOps.length > 0 || idbOrderDirty) {
      const ops = [...idbFailedOps, ...idbQueue];
      idbFailedOps = [];
      idbQueue = [];
      const writeOrder = idbOrderDirty;
      idbOrderDirty = false;
      const orderIds = writeOrder ? idbCache.map((r) => r.id) : null;
      const ok = await idbCommitWithRetry(ops, orderIds);
      if (!ok) break; // 最終失敗：失敗分は idbFailedOps に戻してある。次の書き込みで再試行
    }
  } finally {
    idbFlushing = false;
  }
  if (idbReloadWanted) {
    idbReloadWanted = false;
    void idbReloadFromDb();
  }
}

function idbCommit(ops: IdbOp[], orderIds: string[] | null): Promise<void> {
  return idbOpen().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction([IDB_STORE, IDB_META], "readwrite");
        const store = tx.objectStore(IDB_STORE);
        // 同じ id への操作は最後のものだけ残す
        const last = new Map<string, IdbOp>();
        for (const op of ops) last.set(op.type === "put" ? op.record.id : op.id, op);
        for (const op of last.values()) {
          if (op.type === "put") store.put(op.record);
          else store.delete(op.id);
        }
        if (orderIds) tx.objectStore(IDB_META).put({ key: ORDER_META_KEY, ids: orderIds });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB の書き込みに失敗"));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB の書き込みが中断"));
      })
  );
}

const RETRY_DELAYS_MS = [300, 1000, 2000, 4000];
async function idbCommitWithRetry(ops: IdbOp[], orderIds: string[] | null): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      await idbCommit(ops, orderIds);
      idbPersistFailed = false;
      idbChannel?.postMessage({ tab: idbTabId, type: "changed" });
      void idbRefreshEstimate();
      return true;
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        // 最終失敗：メモリ上のデータは無傷。失敗分は保持して次の書き込み時に再度試す。
        idbFailedOps = [...idbFailedOps, ...ops];
        if (orderIds) idbOrderDirty = true;
        idbPersistFailed = true;
        console.error("IndexedDB への書き込みに失敗（再試行上限）:", err);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(PERSIST_ERROR_EVENT, {
              detail: { message: err instanceof Error ? err.message : String(err) },
            })
          );
        }
        return false;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

async function idbReloadFromDb(): Promise<void> {
  if (idbHasPending()) {
    idbReloadWanted = true;
    return;
  }
  try {
    const db = await idbOpen();
    idbCache = await idbReadAll(db);
    notifyUpdated();
  } catch (err) {
    console.error("IndexedDB の再読込に失敗:", err);
  }
}

function idbSetupChannel(): void {
  if (typeof BroadcastChannel === "undefined" || idbChannel) return;
  try {
    idbChannel = new BroadcastChannel(CHANNEL_NAME);
    idbChannel.onmessage = (ev: MessageEvent) => {
      if (ev.data?.tab === idbTabId) return;
      void idbReloadFromDb();
    };
  } catch {
    idbChannel = null;
  }
}

let idbUnloadGuardsSet = false;
function idbSetupUnloadGuards(): void {
  if (idbUnloadGuardsSet || typeof window === "undefined") return;
  idbUnloadGuardsSet = true;
  window.addEventListener("beforeunload", (e) => {
    if (idbHasPending()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && (idbQueue.length > 0 || idbFailedOps.length > 0)) {
      scheduleFlush();
    }
  });
}

async function idbRefreshEstimate(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      storageEstimate = { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
  } catch {
    /* 取得不可は無視 */
  }
}

async function idbRequestPersist(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      persistGranted = await navigator.storage.persist();
      notifyUpdated();
    }
  } catch {
    persistGranted = null;
  }
}

// 初期読み込みの完了を待つ（local ドライバは即解決）
export function whenStorageReady(): Promise<void> {
  if (currentDriver() === "local") return Promise.resolve();
  return idbReadyPromise;
}
export function isStorageReady(): boolean {
  return currentDriver() === "local" || idbReady;
}
export function hasPendingPersist(): boolean {
  return currentDriver() === "idb" && idbHasPending();
}
export function isPersistFailed(): boolean {
  return currentDriver() === "idb" && idbPersistFailed;
}

// ---- 読み書きプリミティブ（全公開関数はこれを経由する） ----
function readStock(): AnalysisRecord[] {
  if (currentDriver() === "idb") {
    // 必須条件2: キャッシュのコピーを返す（呼び出し元が書き換えてもキャッシュは汚れない）
    return idbCache.map((r) => ({ ...r }));
  }
  return localRead();
}

// ストック全件を書き込む。local: localStorage に丸ごと（容量超過は StorageQuotaError、失敗時は無書き込み）。
// idb: キャッシュを差し替え、差分だけ裏で IndexedDB へ put/delete する。
function writeStock(records: AnalysisRecord[]): void {
  if (currentDriver() === "idb") {
    idbWrite(records);
    return;
  }
  localWrite(records);
}

function clearStock(): void {
  if (currentDriver() === "idb") {
    idbWrite([]);
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

// ============================================================================
// 初回移行（院長が明示的に実行）
//   localStorage の全件を 1 トランザクションで IndexedDB へ put → 件数検証 → 一致したときだけ切替。
//   元キー dermapdf_analysis_stock は読み取り専用で残し、以後書き込まない。
// ============================================================================
export async function migrateToIndexedDB(opts?: { reimport?: boolean }): Promise<{ count: number }> {
  if (typeof window === "undefined") throw new Error("ブラウザでのみ実行できます");
  if (!opts?.reimport && getStorageDriverName() === "idb") {
    throw new Error("すでに大容量の保存先を使用しています");
  }
  const source = localRead();
  const db = await idbOpen();
  if (opts?.reimport) {
    const existing = await idbCount(db);
    if (existing > 0) throw new Error(`保存先に ${existing} 件のデータがあるため再取込は行いません`);
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([IDB_STORE, IDB_META], "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.clear();
    for (const r of source) store.put(r);
    tx.objectStore(IDB_META).put({ key: ORDER_META_KEY, ids: source.map((r) => r.id) });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB への書き込みに失敗"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB への書き込みが中断"));
  });
  const count = await idbCount(db);
  if (count !== source.length) {
    throw new Error(`件数が一致しません（移行元 ${source.length} 件 / 保存先 ${count} 件）。切り替えは行いません`);
  }
  localStorage.setItem(MIGRATED_KEY, `${new Date().toISOString()}|${count}`);
  localStorage.setItem(DRIVER_KEY, "idb");
  return { count };
}

export function getMigrationInfo(): { migratedAt: string; count: number } | null {
  try {
    const v = localStorage.getItem(MIGRATED_KEY);
    if (!v) return null;
    const [migratedAt, count] = v.split("|");
    return { migratedAt, count: Number(count) || 0 };
  } catch {
    return null;
  }
}

// 整合性チェック：移行フラグがあるのに保存先が空で、移行前データ（localStorage）が残っている
export async function checkStorageIntegrity(): Promise<{
  status: "ok" | "idb-empty-with-flag";
  localCount: number;
}> {
  const localCount = localRead().length;
  if (currentDriver() !== "idb") return { status: "ok", localCount };
  await whenStorageReady();
  if (currentDriver() !== "idb") return { status: "ok", localCount };
  if (idbCache.length === 0 && getMigrationInfo() && localCount > 0) {
    return { status: "idb-empty-with-flag", localCount };
  }
  return { status: "ok", localCount };
}

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
  // 件数上限は設けない。消えるのはユーザーが削除したときだけ。
  // 容量超過時は StorageQuotaError を投げ、何も書き込まない（イベントも発火しない）。
  writeStock(records);
  notifyUpdated();
  return newRecord;
}

export function loadAllAnalyses(): AnalysisRecord[] {
  return readStock();
}

export function updateAnalysisTitle(id: string, title: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    records[idx].title = title;
    writeStock(records);
    notifyUpdated();
  }
}

// AIカテゴリのみ更新（content・folder・titleには触らない）。空文字でクリア。
export function updateAnalysisAiCategory(id: string, aiCategory: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    const trimmed = aiCategory.trim();
    if (trimmed) {
      records[idx].aiCategory = trimmed;
    } else {
      delete records[idx].aiCategory;
    }
    writeStock(records);
    notifyUpdated();
  }
}

export function updateAnalysisContent(id: string, content: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    if (!records[idx].originalContent) {
      records[idx].originalContent = records[idx].content;
    }
    records[idx].content = content;
    records[idx].updatedAt = new Date().toISOString();
    writeStock(records);
    notifyUpdated();
  }
}

export function revertAnalysisContent(id: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1 && records[idx].originalContent) {
    records[idx].content = records[idx].originalContent!;
    delete records[idx].originalContent;
    delete records[idx].updatedAt;
    writeStock(records);
    notifyUpdated();
  }
}

export function getDisplayTitle(record: AnalysisRecord): string {
  return record.title || record.fileName;
}

export function toggleLock(id: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    records[idx].locked = !records[idx].locked;
    writeStock(records);
    notifyUpdated();
  }
}

export function toggleFavorite(id: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    records[idx].favorite = !records[idx].favorite;
    writeStock(records);
    notifyUpdated();
  }
}

const LOCK_PASSWORD_KEY = "dermapdf_lock_password";

export function setDeletePassword(password: string): void {
  const hash = btoa(encodeURIComponent(password + "_dermapdf_salt"));
  localStorage.setItem(LOCK_PASSWORD_KEY, hash);
}

export function verifyDeletePassword(password: string): boolean {
  const stored = localStorage.getItem(LOCK_PASSWORD_KEY);
  if (!stored) return true;
  const hash = btoa(encodeURIComponent(password + "_dermapdf_salt"));
  return stored === hash;
}

export function hasDeletePassword(): boolean {
  return !!localStorage.getItem(LOCK_PASSWORD_KEY);
}

export function removeDeletePassword(): void {
  localStorage.removeItem(LOCK_PASSWORD_KEY);
}

export function duplicateAnalysis(id: string): AnalysisRecord | null {
  const records = loadAllAnalyses();
  const original = records.find((r) => r.id === id);
  if (!original) return null;

  const duplicated: AnalysisRecord = {
    ...original,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: (original.title || original.fileName) + " (コピー)",
    locked: false,
    updatedAt: undefined,
    originalContent: undefined,
    // 複製はグループに混ぜない（同種別のタブが二重に並ぶのを防ぐ）
    groupId: undefined,
  };

  records.splice(records.findIndex((r) => r.id === id) + 1, 0, duplicated);
  // 件数上限なし。容量超過時は StorageQuotaError を投げ、何も書き込まない。
  writeStock(records);
  notifyUpdated();
  return duplicated;
}

export function bulkToggleLock(ids: string[], locked: boolean): void {
  const records = loadAllAnalyses();
  records.forEach((r) => {
    if (ids.includes(r.id)) r.locked = locked;
  });
  writeStock(records);
  notifyUpdated();
}

export function deleteAnalysis(id: string): void {
  const records = loadAllAnalyses().filter((r) => r.id !== id);
  writeStock(records);
  notifyUpdated();
}

export function renameFolder(oldName: string, newName: string): void {
  const records = loadAllAnalyses();
  records.forEach((r) => {
    if (r.folder === oldName) r.folder = newName;
  });
  writeStock(records);
  notifyUpdated();
}

// フォルダ削除：そのフォルダとサブフォルダ配下のカードの folder を "" に戻す
export function deleteFolder(folderName: string): void {
  const records = loadAllAnalyses();
  records.forEach((r) => {
    if (r.folder === folderName || (r.folder || "").startsWith(folderName + "/")) r.folder = "";
  });
  writeStock(records);
  notifyUpdated();
}

export function clearAllAnalyses(): void {
  clearStock();
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

// ---- 容量の目安 ----
// localStorage は多くのブラウザで約5MB（UTF-16 文字数×2バイトで概算）。あくまで目安。
export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;

export interface StorageUsage {
  stockBytes: number; // 保存カードの概算バイト数
  totalBytes: number; // local: localStorage 全体の概算 / idb: navigator.storage.estimate().usage
  limitBytes: number; // local: 約5MB / idb: estimate().quota
  ratio: number; // local: totalBytes / limitBytes、idb: stockBytes / limitBytes（0〜）
  driver: StorageDriverName;
  persisted: boolean | null; // idb のときの navigator.storage.persist() 結果（不明は null）
}

export function estimateStorageUsage(): StorageUsage {
  if (currentDriver() === "idb") {
    // カードの実サイズ＝キャッシュの JSON 長×2（UTF-16）。分母は estimate().quota（目安）
    const stockBytes = JSON.stringify(idbCache).length * 2;
    const quota = storageEstimate?.quota ?? 0;
    return {
      stockBytes,
      totalBytes: storageEstimate?.usage ?? stockBytes,
      limitBytes: quota,
      ratio: quota > 0 ? stockBytes / quota : 0,
      driver: "idb",
      persisted: persistGranted,
    };
  }
  let stockChars = 0;
  let totalChars = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const value = localStorage.getItem(key) ?? "";
      const chars = key.length + value.length;
      totalChars += chars;
      if (key === STORAGE_KEY) stockChars = chars;
    }
  } catch {
    // アクセス不可（プライベートモード等）は 0 扱い
  }
  const stockBytes = stockChars * 2;
  const totalBytes = totalChars * 2;
  return {
    stockBytes,
    totalBytes,
    limitBytes: STORAGE_LIMIT_BYTES,
    ratio: totalBytes / STORAGE_LIMIT_BYTES,
    driver: "local",
    persisted: null,
  };
}

// ---- バックアップからの復元 ----
export interface ImportResult {
  added: number;
  skipped: number;
}

function isImportableRecord(v: unknown): v is AnalysisRecord {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    r.id.length > 0 &&
    typeof r.content === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.fileName === "string" &&
    typeof r.analysisType === "string"
  );
}

// exportAnalysesAsJSON の出力（AnalysisRecord の配列）を読み込み、既存に無い id だけ追加する。
// 既存カードは上書きしない。不正な JSON・形式なら何も書かずに Error を投げる。
// 書き込みは一括1回（途中まで書いて壊さない）。容量超過は StorageQuotaError。
export function importAnalysesFromJSON(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSON として読み取れませんでした。バックアップファイルを確認してください");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("バックアップの形式が違います（配列ではありません）");
  }
  const invalid = parsed.findIndex((v) => !isImportableRecord(v));
  if (invalid !== -1) {
    throw new Error(
      `バックアップの ${invalid + 1} 件目に必須項目（id・content・createdAt 等）がありません`
    );
  }
  const incoming = parsed as AnalysisRecord[];
  const existing = loadAllAnalyses();
  const existingIds = new Set(existing.map((r) => r.id));
  const seen = new Set<string>();
  const toAdd: AnalysisRecord[] = [];
  let skipped = 0;
  for (const r of incoming) {
    if (existingIds.has(r.id) || seen.has(r.id)) {
      skipped++;
      continue;
    }
    seen.add(r.id);
    toAdd.push({
      ...r,
      tags: Array.isArray(r.tags) ? r.tags : [],
      folder: typeof r.folder === "string" ? r.folder : "",
      analysisLabel: typeof r.analysisLabel === "string" ? r.analysisLabel : r.analysisType,
    });
  }
  if (toAdd.length === 0) return { added: 0, skipped };
  // 復元分は新しい順（createdAt 降順）で既存の後ろに付ける。既存の並びは崩さない。
  toAdd.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  writeStock([...existing, ...toAdd]);
  notifyUpdated();
  return { added: toAdd.length, skipped };
}

export function updateAnalysisTags(id: string, tags: string[], folder: string): void {
  const records = loadAllAnalyses();
  const idx = records.findIndex((r) => r.id === id);
  if (idx !== -1) {
    records[idx].tags = tags;
    records[idx].folder = folder;
    writeStock(records);
    notifyUpdated();
  }
}

// フォルダパスユーティリティ
export function getParentFolder(folderPath: string): string {
  const parts = folderPath.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

export function getFolderName(folderPath: string): string {
  const parts = folderPath.split("/");
  return parts[parts.length - 1];
}

export function getFolderDepth(folderPath: string): number {
  if (!folderPath) return 0;
  return folderPath.split("/").length - 1;
}

export interface FolderNode {
  path: string;
  name: string;
  count: number;
  totalCount: number;
  children: FolderNode[];
  isCustom: boolean;
}

const DEFAULT_FOLDERS_LIST = ["人材育成", "採用", "マニュアル", "リスク管理", "等級・評価", "経営戦略", "その他"];

export function buildFolderTree(
  records: AnalysisRecord[],
  customFolders: string[]
): FolderNode[] {
  const allPaths = new Set<string>();
  records.forEach((r) => {
    if (r.folder) {
      const parts = r.folder.split("/");
      parts.forEach((_, i) => {
        allPaths.add(parts.slice(0, i + 1).join("/"));
      });
    }
  });
  customFolders.forEach((f) => {
    const parts = f.split("/");
    parts.forEach((_, i) => {
      allPaths.add(parts.slice(0, i + 1).join("/"));
    });
  });

  const countMap: Record<string, number> = {};
  records.forEach((r) => {
    if (r.folder) countMap[r.folder] = (countMap[r.folder] || 0) + 1;
  });

  const buildNode = (path: string): FolderNode => {
    const children = Array.from(allPaths)
      .filter((p) => {
        const parts = p.split("/");
        const pathParts = path.split("/");
        return parts.length === pathParts.length + 1 && p.startsWith(path + "/");
      })
      .sort((a, b) => a.localeCompare(b, "ja"))
      .map(buildNode);

    const directCount = countMap[path] || 0;
    const totalCount = directCount + children.reduce((s, c) => s + c.totalCount, 0);

    return {
      path,
      name: getFolderName(path),
      count: directCount,
      totalCount,
      children,
      isCustom: !DEFAULT_FOLDERS_LIST.includes(path.split("/")[0]),
    };
  };

  const rootPaths = Array.from(allPaths)
    .filter((p) => !p.includes("/"))
    .sort((a, b) => {
      const aIdx = DEFAULT_FOLDERS_LIST.indexOf(a);
      const bIdx = DEFAULT_FOLDERS_LIST.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b, "ja");
    });
  return rootPaths.map(buildNode);
}

export interface FlatFolder {
  path: string;
  displayName: string;
  depth: number;
}

export function getFlatFolderList(tree: FolderNode[]): FlatFolder[] {
  const result: FlatFolder[] = [];
  const walk = (nodes: FolderNode[], depth: number) => {
    for (const node of nodes) {
      const prefix = depth > 0 ? "　".repeat(depth - 1) + "└ " : "";
      result.push({ path: node.path, displayName: prefix + node.name, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);
  return result;
}

export function getAllFolders(): string[] {
  const records = loadAllAnalyses();
  const folders = new Set(records.map((r) => r.folder).filter(Boolean));
  return Array.from(folders);
}

export function getAllTags(): string[] {
  const records = loadAllAnalyses();
  const tags = new Set(records.flatMap((r) => r.tags || []));
  return Array.from(tags);
}

export function getAllTagsSorted(): string[] {
  const records = loadAllAnalyses();
  const tags = new Set(records.flatMap((r) => r.tags || []));
  return Array.from(tags).sort((a, b) =>
    a.localeCompare(b, "ja", { sensitivity: "base" })
  );
}

export function getTagsWithCount(): { tag: string; count: number }[] {
  const records = loadAllAnalyses();
  const countMap = new Map<string, number>();
  records.forEach((r) => {
    (r.tags || []).forEach((tag) => {
      countMap.set(tag, (countMap.get(tag) || 0) + 1);
    });
  });
  return Array.from(countMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag, "ja", { sensitivity: "base" }));
}

export function exportSingleAnalysisAsMarkdown(record: AnalysisRecord): void {
  const dateStr = new Date(record.createdAt).toLocaleString("ja-JP");
  const dateFileStr = new Date(record.createdAt).toISOString().split("T")[0];

  const md = `# ${record.title || record.fileName}

## 基本情報
- **ファイル名**: ${record.fileName}
- **分析タイプ**: ${record.analysisLabel}
- **保存日時**: ${dateStr}
${record.folder ? "- **フォルダ**: " + record.folder : ""}
${record.tags?.length ? "- **タグ**: " + record.tags.join(", ") : ""}

---

## 分析内容

${cleanupLatexNotation(record.content)}

---

## AIへの引き継ぎプロンプト例

\`\`\`
このファイルはDermaPDF Proで分析した「${record.analysisLabel}」の結果です。
この内容をもとに、さらに詳しい分析や活用方法を提案してください。
\`\`\`

---
*Generated by DermaPDF Pro | ${dateStr}*
`;

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (record.title || record.fileName)
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\w\u3040-\u9fff]/g, "_");
  const safeLabel = record.analysisLabel.replace(/[^\w\u3040-\u9fff]/g, "_");
  a.download = `dermapdf_${safeName}_${safeLabel}_${dateFileStr}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// 単一カードを .pdf でダウンロード。画面表示と同じMarkdownレンダリングで全内容を
// 整形（見出し・太字・箇条書き）し、コンテンツ高に応じて複数ページに分割する。
export async function exportSingleAnalysisAsPdf(record: AnalysisRecord): Promise<void> {
  const { exportMarkdownAsPdf } = await import("@/lib/markdown-export");
  const title = record.title || record.fileName;
  const dateStr = new Date(record.createdAt).toLocaleString("ja-JP");
  const metaLines = [
    `分析タイプ: ${record.analysisLabel}`,
    `保存日時: ${dateStr}`,
    ...(record.folder ? [`フォルダ: ${record.folder}`] : []),
    ...(record.tags?.length ? [`タグ: ${record.tags.join(", ")}`] : []),
  ];
  const safeName = title.replace(/[^\w぀-鿿]/g, "_").slice(0, 30);
  const safeLabel = record.analysisLabel.replace(/[^\w぀-鿿]/g, "_");
  const fileName = `dermapdf_${safeName}_${safeLabel}_${new Date().toISOString().split("T")[0]}.pdf`;
  await exportMarkdownAsPdf({
    title,
    metaLines,
    markdown: record.content,
    fileName,
  });
}

// 単一カードを .docx でダウンロード。Markdownの見出し・太字・箇条書き・表を
// Wordの実体スタイルへマッピングした、編集可能なテキスト＋スタイルの文書を生成する。
export async function exportSingleAnalysisAsWord(record: AnalysisRecord): Promise<void> {
  const { exportMarkdownAsDocx } = await import("@/lib/markdown-docx");
  const title = record.title || record.fileName;
  const dateStr = new Date(record.createdAt).toLocaleString("ja-JP");
  const metaLines = [
    `分析タイプ: ${record.analysisLabel}`,
    `保存日時: ${dateStr}`,
    ...(record.folder ? [`フォルダ: ${record.folder}`] : []),
    ...(record.tags?.length ? [`タグ: ${record.tags.join(", ")}`] : []),
  ];
  const safeName = title.replace(/[^\w぀-鿿]/g, "_").slice(0, 30);
  const safeLabel = record.analysisLabel.replace(/[^\w぀-鿿]/g, "_");
  const fileName = `dermapdf_${safeName}_${safeLabel}_${new Date().toISOString().split("T")[0]}.docx`;
  await exportMarkdownAsDocx({
    title,
    metaLines,
    markdown: record.content,
    fileName,
  });
}

export function exportAnalysesAsText(): void {
  const data = loadAllAnalyses();
  const text = data
    .map(
      (r) =>
        `【${r.analysisLabel}】${r.fileName}\n${new Date(r.createdAt).toLocaleString("ja-JP")}\n${"─".repeat(40)}\n${markdownToPlainText(r.content)}\n`
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

export async function exportAnalysesAsDocx(): Promise<void> {
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import("docx");
  const records = loadAllAnalyses();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  children.push(
    new Paragraph({ text: "DermaPDF Pro 分析ストック", heading: HeadingLevel.TITLE })
  );
  children.push(
    new Paragraph({ text: `エクスポート日時: ${new Date().toLocaleString("ja-JP")}` })
  );
  children.push(new Paragraph({ text: "" }));

  records.forEach((r, i) => {
    children.push(
      new Paragraph({ text: `${i + 1}. ${r.title || r.fileName}`, heading: HeadingLevel.HEADING_1 })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "分析タイプ: ", bold: true }),
          new TextRun({ text: r.analysisLabel }),
        ],
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "保存日時: ", bold: true }),
          new TextRun({ text: new Date(r.createdAt).toLocaleString("ja-JP") }),
        ],
      })
    );
    if (r.folder) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "フォルダ: ", bold: true }),
            new TextRun({ text: r.folder }),
          ],
        })
      );
    }
    if (r.tags?.length) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "タグ: ", bold: true }),
            new TextRun({ text: r.tags.join(", ") }),
          ],
        })
      );
    }
    children.push(new Paragraph({ text: "" }));

    r.content.split("\n").forEach((line) => {
      children.push(new Paragraph({ text: line || " " }));
    });

    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: "─".repeat(40) }));
    children.push(new Paragraph({ text: "" }));
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = new Blob([await Packer.toBlob(doc)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dermapdf_analyses_${new Date().toISOString().split("T")[0]}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// 全分析を1つの .pdf でエクスポート。各カードを画面と同じMarkdownレンダリングで
// 整形して連結し、コンテンツ高に応じて複数ページへ分割する。
export async function exportAnalysesAsPdf(): Promise<void> {
  const { exportMarkdownAsPdf } = await import("@/lib/markdown-export");
  const records = loadAllAnalyses();
  const markdown =
    records
      .map((r) => {
        const dateStr = new Date(r.createdAt).toLocaleString("ja-JP");
        return `# ${r.title || r.fileName}\n\n**分析タイプ**: ${r.analysisLabel} ／ **保存日時**: ${dateStr}${
          r.folder ? ` ／ **フォルダ**: ${r.folder}` : ""
        }\n\n${r.content}`;
      })
      .join("\n\n---\n\n") || "（データがありません）";
  await exportMarkdownAsPdf({
    title: "DermaPDF Pro 分析ストック",
    metaLines: [`${records.length}件 ／ ${new Date().toLocaleString("ja-JP")}`],
    markdown,
    fileName: `dermapdf_analyses_${new Date().toISOString().split("T")[0]}.pdf`,
  });
}

export async function bulkExportAsMarkdown(records: AnalysisRecord[]): Promise<void> {
  for (let i = 0; i < records.length; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, i === 0 ? 0 : 500));
    exportSingleAnalysisAsMarkdown(records[i]);
  }
}

// 単一カードを .txt（プレーンテキスト）でダウンロード。
// 整形・命名規則は一括テキスト出力（bulkExportAsText）と同一に揃える。
export function exportSingleAnalysisAsText(record: AnalysisRecord): void {
  const r = record;
  const dateFileStr = new Date().toISOString().split("T")[0];
  const title = r.title || r.fileName;
  const text = `${title}
分析タイプ: ${r.analysisLabel}
保存日時: ${new Date(r.createdAt).toLocaleString("ja-JP")}
${r.folder ? `フォルダ: ${r.folder}` : ""}
${"─".repeat(40)}

${markdownToPlainText(r.content)}
`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = title.replace(/[^\w぀-鿿]/g, "_").slice(0, 30);
  const safeLabel = r.analysisLabel.replace(/[^\w぀-鿿]/g, "_");
  a.download = `dermapdf_${safeName}_${safeLabel}_${dateFileStr}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function bulkExportAsText(records: AnalysisRecord[]): Promise<void> {
  for (let i = 0; i < records.length; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, i === 0 ? 0 : 500));
    exportSingleAnalysisAsText(records[i]);
  }
}

export async function bulkExportAsPdf(records: AnalysisRecord[]): Promise<void> {
  for (let i = 0; i < records.length; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, i === 0 ? 0 : 800));
    await exportSingleAnalysisAsPdf(records[i]);
  }
}
