import { create } from "zustand";

// PDF操作結果の型
interface ExtractResult {
  base64: string;
  fileName: string;
}

interface CompressResult {
  base64: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
}

interface CropResult {
  dataUrl: string;
  base64: string;
  fileName: string;
}

// クリニック設定
interface ClinicSettings {
  name: string;
  purpose: string;
  mission: string;
  vision: string;
  values: string;
  slogan: string;
}

// APIキー存在チェック
interface ApiKeys {
  pdfCo: boolean;
  removeBg: boolean;
  gemini: boolean;
}

// 画像ファイル
interface ImageFile {
  id: string;
  file: File;
  dataUrl: string;
  name: string;
}

type Mode = "pdf" | "image";
type InputMode = "file" | "text";

interface AppState {
  // PDF関連
  pdfFile: File | null;
  pdfBytes: Uint8Array | null;
  fileName: string;
  mode: Mode;

  // テキスト直接入力
  inputMode: InputMode;
  inputText: string;
  inputTextFileName: string;

  // ページ選択
  selectedPages: Set<number>;

  // 結果
  extractResult: ExtractResult | null;
  compressResult: CompressResult | null;
  cropResult: CropResult | null;

  // 画像関連
  images: ImageFile[];
  imgSelected: Set<number>;

  // クリニック設定
  clinicSettings: ClinicSettings;

  // APIキー
  apiKeys: ApiKeys;

  // アクション
  setFile: (file: File, bytes: Uint8Array) => void;
  clearFile: () => void;
  setMode: (mode: Mode) => void;
  togglePage: (page: number) => void;
  selectAllPages: (pages: number[]) => void;
  clearSelectedPages: () => void;
  setExtractResult: (result: ExtractResult | null) => void;
  setCompressResult: (result: CompressResult | null) => void;
  setCropResult: (result: CropResult | null) => void;
  addImages: (images: ImageFile[]) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  toggleImgSelected: (index: number) => void;
  selectAllImages: (indices: number[]) => void;
  clearImgSelected: () => void;
  setInputMode: (mode: InputMode) => void;
  setInputText: (text: string) => void;
  setClinicSettings: (settings: Partial<ClinicSettings>) => void;
  setApiKeys: (keys: ApiKeys) => void;
}

const defaultClinicSettings: ClinicSettings = {
  name: "",
  purpose: "",
  mission: "",
  vision: "",
  values: "",
  slogan: "",
};

export const useAppStore = create<AppState>((set) => ({
  // 初期状態
  pdfFile: null,
  pdfBytes: null,
  fileName: "",
  mode: "pdf",
  selectedPages: new Set<number>(),
  extractResult: null,
  compressResult: null,
  cropResult: null,
  images: [],
  imgSelected: new Set<number>(),
  inputMode: "file",
  inputText: "",
  inputTextFileName: "",
  clinicSettings: defaultClinicSettings,
  apiKeys: { pdfCo: false, removeBg: false, gemini: false },

  // アクション
  setFile: (file, bytes) =>
    set({
      pdfFile: file,
      pdfBytes: bytes,
      fileName: file.name,
      selectedPages: new Set<number>(),
      extractResult: null,
      compressResult: null,
      cropResult: null,
    }),

  clearFile: () =>
    set({
      pdfFile: null,
      pdfBytes: null,
      fileName: "",
      selectedPages: new Set<number>(),
      extractResult: null,
      compressResult: null,
      cropResult: null,
    }),

  setMode: (mode) => set({ mode }),

  togglePage: (page) =>
    set((state) => {
      const next = new Set(state.selectedPages);
      if (next.has(page)) {
        next.delete(page);
      } else {
        next.add(page);
      }
      return { selectedPages: next };
    }),

  selectAllPages: (pages) => set({ selectedPages: new Set(pages) }),

  clearSelectedPages: () => set({ selectedPages: new Set<number>() }),

  setExtractResult: (result) => set({ extractResult: result }),

  setCompressResult: (result) => set({ compressResult: result }),

  setCropResult: (result) => set({ cropResult: result }),

  addImages: (images) =>
    set((state) => ({ images: [...state.images, ...images] })),

  removeImage: (id) =>
    set((state) => ({
      images: state.images.filter((img) => img.id !== id),
    })),

  clearImages: () => set({ images: [], imgSelected: new Set<number>() }),

  toggleImgSelected: (index) =>
    set((state) => {
      const next = new Set(state.imgSelected);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return { imgSelected: next };
    }),

  selectAllImages: (indices) => set({ imgSelected: new Set(indices) }),

  clearImgSelected: () => set({ imgSelected: new Set<number>() }),

  setInputMode: (mode) => {
    const today = new Date().toISOString().split("T")[0];
    set({
      inputMode: mode,
      inputTextFileName: `テキスト入力_${today}.txt`,
    });
  },

  setInputText: (text) => set({ inputText: text }),

  setClinicSettings: (settings) =>
    set((state) => ({
      clinicSettings: { ...state.clinicSettings, ...settings },
    })),

  setApiKeys: (keys) => set({ apiKeys: keys }),
}));
