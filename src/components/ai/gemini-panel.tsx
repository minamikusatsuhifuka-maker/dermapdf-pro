"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { BrainCircuit, Copy, Download, Loader2, ExternalLink, Sparkles, BookmarkPlus, Save, X } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";
import { analyzeWithGemini } from "@/lib/gemini-client";
import { saveAnalysis } from "@/lib/analysis-storage";
import { saveTemplate, loadTemplates, type AnalysisTemplate } from "@/lib/template-storage";
import { splitPdfPages, getPdfPageCount } from "@/lib/pdf-splitter";
import { type ClinicSettings, buildPhilosophyContext } from "@/components/settings/settings-modal";
import {
  TARGET_OPTIONS,
  LEVEL_OPTIONS,
  PURPOSE_OPTIONS,
  TONE_OPTIONS,
  getTechniqueFlags,
  generateGensparkPrompt,
} from "@/lib/genspark-prompt-generator";

export type AnalysisType =
  // 基本分析
  | "summary"
  | "detail_summary"
  | "transcription"
  // 皮膚科・医療
  | "findings"
  | "ingredients"
  | "care_plan"
  | "patient_consent"
  // 経営・戦略
  | "business_strategy"
  | "grade_design"
  | "grade_analyze"
  | "marketing_copy"
  | "management_plan"
  | "swot"
  | "kpi_plan"
  // 人材育成
  | "training_summary"
  | "training_quiz"
  | "training_newcomer"
  | "training_roleplay"
  | "training_ojt"
  | "staff_guidance"
  | "goal_cheer"
  // リードマネジメント
  | "lm_five_needs"
  | "lm_quality_world"
  | "lm_1on1"
  | "lm_goal_setting"
  | "lm_feedback"
  | "lm_risk_prevention";

interface AnalysisOption {
  value: AnalysisType;
  label: string;
}

interface AnalysisGroup {
  label: string;
  options: AnalysisOption[];
}

const ANALYSIS_GROUPS: AnalysisGroup[] = [
  {
    label: "\u{1F4C4} 基本分析",
    options: [
      { value: "summary", label: "概要・要約" },
      { value: "detail_summary", label: "詳細にまとめる" },
      { value: "transcription", label: "全文書き起こし" },
    ],
  },
  {
    label: "\u{1F3E5} 皮膚科・医療",
    options: [
      { value: "findings", label: "所見まとめ" },
      { value: "ingredients", label: "成分分析" },
      { value: "care_plan", label: "ケアプラン" },
      { value: "patient_consent", label: "患者同意書生成" },
    ],
  },
  {
    label: "\u{1F4BC} 経営・戦略",
    options: [
      { value: "business_strategy", label: "経営戦略分析" },
      { value: "grade_design", label: "等級制度設計" },
      { value: "grade_analyze", label: "等級制度分析" },
      { value: "marketing_copy", label: "マーケティングコピー" },
      { value: "management_plan", label: "経営計画書" },
      { value: "swot", label: "SWOT分析" },
      { value: "kpi_plan", label: "KPI設計" },
    ],
  },
  {
    label: "\u{1F465} 人材育成",
    options: [
      { value: "training_summary", label: "研修資料の要点整理" },
      { value: "training_quiz", label: "理解度確認テスト作成" },
      { value: "training_newcomer", label: "新人向けわかりやすい解説" },
      { value: "training_roleplay", label: "ロールプレイシナリオ作成" },
      { value: "training_ojt", label: "OJT計画書作成" },
      { value: "staff_guidance", label: "スタッフ指導メモ" },
      { value: "goal_cheer", label: "目標応援メッセージ" },
    ],
  },
  {
    label: "\u{1F331} リードマネジメント（選択理論）",
    options: [
      { value: "lm_five_needs", label: "5つの基本的欲求で分析" },
      { value: "lm_quality_world", label: "上質世界との紐付け分析" },
      { value: "lm_1on1", label: "1on1面談アジェンダ作成" },
      { value: "lm_goal_setting", label: "内発的動機型目標設定支援" },
      { value: "lm_feedback", label: "リードマネジメント型フィードバック" },
      { value: "lm_risk_prevention", label: "離職・メンタルリスク予防分析" },
    ],
  },
];

const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
  // 基本分析
  summary:
    "この資料の内容を簡潔に要約してください。主要なポイントを箇条書きで整理し、全体像がわかるようにまとめてください。",
  detail_summary:
    "この資料の内容を、通常の要約よりも細部まで丁寧に読み取り、詳細にまとめてください。表面的なキーワードだけでなく、文脈・背景・ニュアンス・行間の意図まで汲み取り、以下の形式で出力してください。\n\n## 全体の概要\n（資料全体を3〜5文で説明）\n\n## 主要テーマと詳細内容\n（各セクション・章ごとに、見出しと詳細な説明を箇条書きで記載）\n\n## 重要なポイント・数値・固有名詞\n（見逃してはいけない具体的な情報を列挙）\n\n## 読み取れる背景・意図・示唆\n（明示されていないが文脈から読み取れる意図や示唆）\n\n## まとめと活用提案\n（この資料をどう活用できるか、具体的な提案）\n\n省略せず、資料の細部まで丁寧に反映してください。",
  transcription:
    "この資料に含まれる全てのテキストを正確に書き起こしてください。\n\n" +
    "【出力ルール】\n" +
    "・ページ番号がある場合は「--- P.1 ---」のように区切りを入れる\n" +
    "・図・表・グラフ内の文字も含める\n" +
    "・手書き文字も読み取れる範囲で書き起こす\n" +
    "・レイアウト構造（タイトル・見出し・本文）を維持する\n" +
    "・一切省略せず、全ページを完全に出力する\n" +
    "・出力が長くなっても途中で止めず必ず最後まで出力する",

  // 皮膚科・医療
  findings:
    "この医療資料の所見・診断・治療方針を整理してください。【主訴】【所見】【診断】【治療方針】【経過観察事項】の形式で出力してください。",
  ingredients:
    "この資料に含まれる成分・処方・薬剤情報を抽出し、各成分の効果・用途・注意事項を整理してください。",
  care_plan:
    "この資料をもとに患者向けのスキンケアプランを作成してください。【現状分析】【推奨ケア手順】【使用製品提案】【注意事項】【次回来院の目安】の形式で出力してください。",
  patient_consent:
    "この資料の内容をもとに、患者向けの説明資料・同意書の文案を作成してください。専門用語を平易な言葉に言い換え、患者が理解・同意しやすい形式で出力してください。",

  // 経営・戦略
  business_strategy:
    "この資料をもとに経営戦略の観点から分析してください。【現状分析】【課題】【戦略オプション】【推奨アクション】【KPI候補】の形式で出力してください。",
  grade_design:
    "この資料をもとに等級制度・評価制度の設計案を作成してください。【等級定義】【各等級の役割・期待値】【評価基準】【昇格要件】の形式で具体的に出力してください。",
  grade_analyze:
    "この等級制度・評価制度の資料を分析してください。【制度の特徴】【強み】【課題・改善点】【スタッフへの影響】【改善提案】の形式で出力してください。",
  marketing_copy:
    "この資料の内容をもとに、クリニックのマーケティングに使えるコピー・文章を作成してください。ターゲット患者に響く言葉で、SNS投稿用・ホームページ用・院内POPのそれぞれに合わせた文案を出力してください。",
  management_plan:
    "この資料をもとに10年ビジョンから逆算した経営計画書を作成してください。【10年ビジョン】【5年目標】【3年目標】【1年目標】【四半期アクションプラン】の形式で具体的に出力してください。",
  swot: "この資料をもとにSWOT分析を行ってください。【強み(S)】【弱み(W)】【機会(O)】【脅威(T)】を整理した後、クロスSWOT戦略（SO/ST/WO/WT）と優先実行施策TOP5を出力してください。",
  kpi_plan:
    "この資料をもとに部門別KPIツリーを設計してください。【最終目標KGI】【部門別KPI】【月次アクション指標】【測定方法・頻度】の形式で出力してください。",

  // 人材育成
  training_summary:
    "この研修資料の要点を整理してください。【研修目的】【学習ポイント（箇条書き）】【受講者が持ち帰るべき3つのメッセージ】【実践アクション提案】の形式で出力してください。",
  training_quiz:
    "この資料をもとに理解度確認テストを作成してください。【4択問題×5問（解答・解説付き）】【○×問題×5問（解答・解説付き）】【記述問題×2問（模範解答付き）】の形式で出力してください。",
  training_newcomer:
    "この資料の内容を、業界未経験の新入社員でも理解できるよう、専門用語を噛み砕いてわかりやすく解説してください。具体的な例え話や身近な例を使い、親しみやすい文体で出力してください。",
  training_roleplay:
    "この資料の内容をもとに、スタッフ研修で使えるロールプレイシナリオを作成してください。【シナリオのテーマ】【登場人物と役割】【シナリオ本文（対話形式）】【振り返りポイント】を含めて出力してください。",
  training_ojt:
    "この資料をもとに、新人スタッフ向けのOJT計画書を作成してください。【習得目標】【週別スケジュール（4週間）】【各週のチェックポイント】【評価基準】の形式で具体的に出力してください。",
  staff_guidance:
    "この資料をもとに、管理職がスタッフ指導に使えるメモを作成してください。【指導のポイント】【よくある失敗パターンと対処法】【褒めるべき行動の具体例】【改善を促す言葉かけの例文】の形式で出力してください。",
  goal_cheer:
    "この資料の内容をもとに、スタッフへの目標応援・モチベーションアップのメッセージを作成してください。個人の成長を承認し、チームの目標達成に向けた前向きなメッセージを複数パターン出力してください。",

  // リードマネジメント（選択理論）
  lm_five_needs:
    "この資料の内容を、選択理論心理学の「5つの基本的欲求」の観点から分析してください。\n\n## 生存の欲求への影響・活用\n## 愛・所属の欲求への影響・活用\n## 力・承認の欲求への影響・活用\n## 自由の欲求への影響・活用\n## 楽しみの欲求への影響・活用\n\n各欲求について、この資料がスタッフや組織にどう作用するか、リードマネジメント的にどう活用できるかを具体的に記述してください。",
  lm_quality_world:
    "この資料の内容を「上質世界（Quality World）」の概念で分析してください。\n\n## スタッフの上質世界に訴えるポイント\n## 上質世界と業務目標を一致させる方法\n## 承認・承認が生まれる場面の抽出\n## リードマネジメント的な関わり方の提案\n\nボスマネジメントではなく、スタッフ自身の内発的動機を引き出す視点で分析してください。",
  lm_1on1:
    "この資料をもとに、リードマネジメント型の1on1面談アジェンダを作成してください。\n\n【面談の原則】\n・強制・批判・脅し・文句・罰・褒賞でコントロールしない\n・傾聴・支援・励ます・尊敬・信頼・受容・意見の違いを交渉するの7つを使う\n\n## アイスブレイク（承認・ねぎらいの言葉）\n## 前回からの振り返り（気づきを問う）\n## 今回のテーマ（本人が話したいことを優先）\n## リードマネジメント的な問いかけ5選\n## 次回までのアクション（本人が決める）\n\n問いかけは「〜すべき」ではなく「〜はどう思いますか？」「〜するとしたら何から始めますか？」形式で作成してください。",
  lm_goal_setting:
    "この資料をもとに、スタッフが内発的動機から目標を設定できるよう支援するシートを作成してください。\n\n## なぜこの目標が自分にとって大切か（上質世界との接続）\n## 達成した時にどんな自分になっているか（ビジョン）\n## 具体的な行動目標（SMARTゴール形式）\n## 周囲のサポートで欲しいこと\n## 自己評価の基準\n\n外部からの強制ではなく、本人の「やりたい」から生まれる目標設定を促してください。",
  lm_feedback:
    "この資料の内容をもとに、管理職がスタッフに伝えるリードマネジメント型フィードバック文を作成してください。\n\n【フィードバックの原則】\n・事実ベースで伝える（批判・評価ではなく観察）\n・Iメッセージで伝える（「あなたは〜」ではなく「私は〜と感じた」）\n・相手の上質世界を尊重する\n・改善を強制せず、気づきを促す\n\n## 承認・ねぎらいのフィードバック例文（3パターン）\n## 改善を促すリードマネジメント的な問いかけ例文（3パターン）\n## 目標達成を支援する関わり方の提案",
  lm_risk_prevention:
    "この資料をもとに、スタッフの離職リスク・メンタルヘルスリスクの予防策を選択理論の観点から分析してください。\n\n## 欲求充足度の観点から見たリスク要因\n## 上質世界が満たされていないサインの見つけ方\n## リードマネジメント的な早期介入の方法\n## 心理的安全性を高める職場環境の提案\n## 管理職向けの具体的な声かけ・関わり方\n\n「問題が起きてから対処する」ではなく「予防する」視点で分析してください。",
};

interface GeminiPanelProps {
  fileBase64?: string;
  fileMime?: string;
  fileName?: string;
  onResult?: (result: string) => void;
  clinicSettings?: ClinicSettings;
}

// TARGET_OPTIONS, LEVEL_OPTIONS, PURPOSE_OPTIONS, TONE_OPTIONS, getTechniqueFlags
// are imported from @/lib/genspark-prompt-generator

export function GeminiPanel({
  fileBase64,
  fileMime,
  fileName,
  onResult,
  clinicSettings,
}: GeminiPanelProps) {
  // 理念コンテキストを構築
  const philosophyContext = clinicSettings ? buildPhilosophyContext(clinicSettings) : "";
  const [analysisType, setAnalysisType] = useState<AnalysisType>("summary");
  const [purpose, setPurpose] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState("");

  // PDFのページ数を取得
  const isPdf = fileMime === "application/pdf";
  useEffect(() => {
    if (!fileBase64 || !isPdf) {
      setPageCount(null);
      return;
    }
    getPdfPageCount(fileBase64).then(setPageCount).catch(() => setPageCount(null));
  }, [fileBase64, isPdf]);

  // Genspark state
  const [gsTarget, setGsTarget] = useState("all_staff");
  const [gsLevel, setGsLevel] = useState("standard");
  const [gsPurpose, setGsPurpose] = useState("inform");
  const [gsTone, setGsTone] = useState("professional");
  const [gsNotes, setGsNotes] = useState("");
  const [gsPrompt, setGsPrompt] = useState("");
  const [gsLoading, setGsLoading] = useState(false);

  // テンプレート関連state
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showGsSaveTemplate, setShowGsSaveTemplate] = useState(false);
  const [gsTemplateName, setGsTemplateName] = useState("");
  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);

  // テンプレート読み込みとイベントリスナー
  useEffect(() => {
    const reloadTemplates = () => setTemplates(loadTemplates());
    reloadTemplates();
    window.addEventListener("templatesUpdated", reloadTemplates);
    window.addEventListener("storage", reloadTemplates);

    // テンプレート適用イベント
    const handleApplyGemini = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.analysisType) setAnalysisType(detail.analysisType);
      if (detail.analysisPurpose !== undefined) setPurpose(detail.analysisPurpose);
    };
    const handleApplyGenspark = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.target) setGsTarget(detail.target);
      if (detail.level) setGsLevel(detail.level);
      if (detail.purpose) setGsPurpose(detail.purpose);
      if (detail.tone) setGsTone(detail.tone);
      if (detail.notes !== undefined) setGsNotes(detail.notes);
    };
    window.addEventListener("applyTemplateGemini", handleApplyGemini);
    window.addEventListener("applyTemplateGenspark", handleApplyGenspark);

    return () => {
      window.removeEventListener("templatesUpdated", reloadTemplates);
      window.removeEventListener("storage", reloadTemplates);
      window.removeEventListener("applyTemplateGemini", handleApplyGemini);
      window.removeEventListener("applyTemplateGenspark", handleApplyGenspark);
    };
  }, []);

  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name) return;
    saveTemplate({
      name,
      analysisType,
      analysisPurpose: purpose,
      gensparkTarget: gsTarget,
      gensparkLevel: gsLevel,
      gensparkPurpose: gsPurpose,
      gensparkTone: gsTone,
      gensparkNotes: gsNotes,
      memo: "",
    });
    setTemplateName("");
    setShowSaveTemplate(false);
    toastOk("テンプレートを保存しました");
  };

  const handleGsSaveTemplate = () => {
    const name = gsTemplateName.trim();
    if (!name) return;
    saveTemplate({
      name,
      analysisType,
      analysisPurpose: purpose,
      gensparkTarget: gsTarget,
      gensparkLevel: gsLevel,
      gensparkPurpose: gsPurpose,
      gensparkTone: gsTone,
      gensparkNotes: gsNotes,
      memo: "",
    });
    setGsTemplateName("");
    setShowGsSaveTemplate(false);
    toastOk("テンプレートを保存しました");
  };

  const handleApplyTemplateToGemini = (t: AnalysisTemplate) => {
    setAnalysisType(t.analysisType as AnalysisType);
    setPurpose(t.analysisPurpose);
    toastOk(`「${t.name}」を適用しました`);
  };

  const handleApplyTemplateToGenspark = (t: AnalysisTemplate) => {
    setGsTarget(t.gensparkTarget);
    setGsLevel(t.gensparkLevel);
    setGsPurpose(t.gensparkPurpose);
    setGsTone(t.gensparkTone);
    setGsNotes(t.gensparkNotes);
    toastOk(`「${t.name}」を適用しました`);
  };

  const CHUNK_SIZE = 5;

  const handleAnalyze = async () => {
    if (!fileBase64 || !fileMime || !fileName) {
      toastError("ファイルが選択されていません");
      return;
    }

    setLoading(true);
    setResult("");
    setTranscriptionProgress("");

    try {
      // バッチ書き起こし判定: PDFかつtranscriptionかつページ数取得成功かつ10ページ超
      const isTranscription = analysisType === "transcription";
      const effectivePageCount = isPdf && pageCount !== null ? pageCount : 0;
      const useBatch = isTranscription && isPdf && effectivePageCount > CHUNK_SIZE;

      if (isTranscription && isPdf && effectivePageCount <= 0) {
        // ページ数取得失敗 → 通常処理にフォールバック
        console.warn("ページ数取得失敗、通常処理で実行します");
        const basePrompt = ANALYSIS_PROMPTS[analysisType];
        const fullPrompt = (purpose
          ? `${basePrompt}\n\n目的: ${purpose}`
          : basePrompt) + philosophyContext;
        const data = await analyzeWithGemini(
          fileBase64,
          fileMime,
          fullPrompt,
          "transcription"
        );
        if (!data.success) throw new Error(data.error || "分析に失敗しました");
        setResult(data.analysis);
        onResult?.(data.analysis);
        toastOk("AI分析が完了しました");
      } else if (useBatch) {
        const totalPages = effectivePageCount;
        const totalChunks = Math.ceil(totalPages / CHUNK_SIZE);
        let fullText = "";

        for (let i = 0; i < totalChunks; i++) {
          const startPage = i * CHUNK_SIZE;
          const endPage = Math.min(startPage + CHUNK_SIZE - 1, totalPages - 1);

          setTranscriptionProgress(
            `書き起こし中... (${i + 1}/${totalChunks}チャンク / P.${startPage + 1}〜${endPage + 1})`
          );

          try {
            const chunkBase64 = await splitPdfPages(fileBase64, startPage, endPage);
            const chunkResult = await analyzeWithGemini(
              chunkBase64,
              "application/pdf",
              `P.${startPage + 1}〜P.${endPage + 1} の全テキストを書き起こしてください。\n` +
                `【出力ルール】\n` +
                `・各ページの冒頭に「--- P.${startPage + 1} ---」のようにページ番号を入れる\n` +
                `・図・表・手書き文字も含め全て書き起こす\n` +
                `・一切省略せず完全に出力する`,
              "transcription"
            );

            if (!chunkResult.success) {
              throw new Error(
                `P.${startPage + 1}〜${endPage + 1} の処理に失敗: ${chunkResult.error}`
              );
            }

            fullText += `\n\n${chunkResult.analysis}`;

            // チャンク間ウェイト（API rate limit対策）
            if (i < totalChunks - 1) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          } catch (chunkErr) {
            console.error(`チャンク${i + 1}エラー:`, chunkErr);
            const errMsg =
              chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
            setTranscriptionProgress(
              `❌ P.${startPage + 1}〜${endPage + 1} でエラー: ${errMsg}`
            );
            fullText += `\n\n⚠️ P.${startPage + 1}〜${endPage + 1} の処理でエラーが発生しました。\nエラー内容: ${errMsg}`;
            setResult(fullText.trim());
            onResult?.(fullText.trim());
            toastError("一部エラーがありましたが途中結果を表示します");
            return;
          }
        }

        setResult(fullText.trim());
        onResult?.(fullText.trim());
        toastOk("全文書き起こしが完了しました");
      } else {
        // 通常の分析（画像、10ページ以下のPDF、transcription以外）
        const basePrompt = ANALYSIS_PROMPTS[analysisType];
        const fullPrompt = (purpose
          ? `${basePrompt}\n\n目的: ${purpose}`
          : basePrompt) + philosophyContext;

        const data = await analyzeWithGemini(
          fileBase64,
          fileMime,
          fullPrompt,
          analysisType
        );
        if (!data.success) throw new Error(data.error || "分析に失敗しました");

        setResult(data.analysis);
        onResult?.(data.analysis);
        toastOk("AI分析が完了しました");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "分析に失敗しました";
      toastError(msg);
    } finally {
      setLoading(false);
      setTranscriptionProgress("");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    toastOk("クリップボードにコピーしました");
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis_${analysisType}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdown = () => {
    const now = new Date();
    const dateStr = now.toLocaleString("ja-JP");
    const dateFileStr = now.toISOString().split("T")[0];

    const label =
      ANALYSIS_GROUPS.flatMap((g) => g.options).find(
        (o) => o.value === analysisType
      )?.label ?? analysisType;

    // クリニック情報ブロック
    const clinicBlock =
      clinicSettings?.clinicName
        ? `## クリニック情報\n- **クリニック名**: ${clinicSettings.clinicName}${clinicSettings.purpose ? "\n- **理念**: " + clinicSettings.purpose : ""}${clinicSettings.mission ? "\n- **ミッション**: " + clinicSettings.mission : ""}\n\n`
        : "";

    // 分析内容をMarkdown見出しに変換
    const formattedAnalysis = result
      .replace(/\*\*(.+?)\*\*/g, "**$1**")
      .replace(/^#{1,6}\s/gm, (match) => match);

    // Claudeへの引き継ぎプロンプト例
    const claudePrompts: Record<string, string> = {
      summary:
        "- この資料の要点をさらに3つに絞って教えてください\n- スタッフへの共有方法をアドバイスしてください",
      detail_summary:
        "- この分析内容をもとに、研修資料を作成してください\n- 特に重要な箇所をハイライトしてください",
      transcription:
        "- この書き起こしから重要なキーワードを抽出してください\n- 章ごとの要点をまとめてください",
      training_summary:
        "- この研修内容をもとに理解度確認テストを作成してください\n- 新人スタッフ向けの解説を追加してください",
      training_quiz:
        "- この問題の難易度を調整してください\n- 追加の問題を5問作成してください",
      lm_1on1:
        "- この面談アジェンダをスタッフ名に合わせてカスタマイズしてください\n- リードマネジメントの観点でフィードバックをください",
      lm_five_needs:
        "- この分析をもとに、スタッフへの具体的な関わり方を提案してください",
      lm_feedback:
        "- このフィードバック例文を特定のシチュエーション向けにアレンジしてください",
    };

    const defaultPrompt =
      "- この分析内容についてさらに詳しく教えてください\n- 実践的な活用方法を提案してください";
    const claudePrompt = claudePrompts[analysisType] || defaultPrompt;

    const md = `# DermaPDF Pro 分析結果

## 基本情報
- **ファイル名**: ${fileName ?? "unknown"}
- **分析タイプ**: ${label}
- **分析日時**: ${dateStr}
${clinicBlock}
---

## 分析内容

${formattedAnalysis}

---

## このファイルの活用方法

### Claude / ChatGPT などのAIに読み込ませる場合
このファイルをアップロードするか、内容をコピーして貼り付けた後、
以下のような指示を追加してください：

\`\`\`
このファイルはDermaPDF Proで分析した「${label}」の結果です。
以下のことを行ってください：
${claudePrompt}
\`\`\`

### Gensparkでプレゼン資料を作る場合
DermaPDF ProのGensparkプロンプト生成機能を使うと、
この分析結果から最適なプレゼン資料生成プロンプトを自動作成できます。

---
*Generated by DermaPDF Pro | ${dateStr}*
`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (fileName ?? "unknown")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w\u3040-\u9fff]/g, "_");
    a.download = `dermapdf_${safeName}_${analysisType}_${dateFileStr}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // プレゼン技法の自動適用判定
  const { appliesEmotion, appliesCatch, appliesBeforeAfter } = getTechniqueFlags(gsTarget, gsPurpose);
  const hasTechniques = appliesEmotion || appliesCatch || appliesBeforeAfter;

  const handleGensparkGenerate = async () => {
    if (!result) return;
    setGsLoading(true);
    setGsPrompt("");

    try {
      const data = await generateGensparkPrompt(
        {
          analysisResult: result,
          target: gsTarget,
          level: gsLevel,
          purpose: gsPurpose,
          tone: gsTone,
          additionalNotes: gsNotes,
        },
        fileBase64,
        fileMime
      );

      if (!data.success) throw new Error(data.error || "プロンプト生成に失敗しました");
      setGsPrompt(data.prompt);
      toastOk("Gensparkプロンプトを生成しました");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "生成に失敗しました";
      toastError(msg);
    } finally {
      setGsLoading(false);
    }
  };

  const handleGsCopyAndOpen = async () => {
    await navigator.clipboard.writeText(gsPrompt);
    toastOk("コピーしました。Gensparkを開きます...");
    window.open("https://www.genspark.ai/ai_slides?tab=explore", "_blank");
  };

  const handleGsCopyOnly = async () => {
    await navigator.clipboard.writeText(gsPrompt);
    toastOk("クリップボードにコピーしました");
  };

  const selectClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200";

  return (
    <div className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-700">
        <BrainCircuit className="h-5 w-5 text-purple-500" />
        Gemini AI分析
      </h2>

      {/* テンプレートから呼び出し */}
      {templates.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">
            テンプレートから呼び出す
          </label>
          <select
            value=""
            onChange={(e) => {
              const t = templates.find((t) => t.id === e.target.value);
              if (t) handleApplyTemplateToGemini(t);
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
          >
            <option value="">-- テンプレートを選択 --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}（{t.analysisType}）
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 分析タイプ選択 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          分析タイプ
        </label>
        <select
          value={analysisType}
          onChange={(e) => setAnalysisType(e.target.value as AnalysisType)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
        >
          {ANALYSIS_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* 目的入力 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          目的（任意）
        </label>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="分析の目的や追加の指示を入力..."
          rows={2}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
        />
      </div>

      {/* 全文書き起こし警告 */}
      {analysisType === "transcription" && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
          {isPdf && pageCount !== null && pageCount > 30
            ? `⏱ ${Math.ceil(pageCount / CHUNK_SIZE)}回に分けて処理します（${pageCount}ページ）。${Math.ceil(pageCount / CHUNK_SIZE)}〜${Math.ceil(pageCount / CHUNK_SIZE) * 2}分かかる場合があります`
            : isPdf && pageCount !== null && pageCount > CHUNK_SIZE
              ? `⏱ ${Math.ceil(pageCount / CHUNK_SIZE)}回に分けて処理します（${pageCount}ページ）。約${Math.ceil(pageCount / CHUNK_SIZE)}〜${Math.ceil(pageCount / CHUNK_SIZE) * 2}分かかります`
              : isPdf && pageCount !== null && pageCount > 0
                ? `⏱ 処理に30秒〜1分かかる場合があります（${pageCount}ページ）`
                : "⏱ 処理に30秒〜1分かかる場合があります"}
        </div>
      )}

      {/* 実行ボタン + テンプレート保存 */}
      <div className="flex gap-2">
        <button
          onClick={handleAnalyze}
          disabled={loading || !fileBase64}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-400 via-rose-500 to-purple-400 px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span>🚀</span>
        )}
        {loading ? "分析中..." : "実行"}
        </button>
        <button
          onClick={() => setShowSaveTemplate(true)}
          className="inline-flex items-center gap-1 rounded-xl border border-purple-200 bg-white px-3 py-3 text-sm font-medium text-purple-600 hover:bg-purple-50"
        >
          <Save className="h-4 w-4" /> テンプレート保存
        </button>
      </div>

      {/* テンプレート保存モーダル */}
      {showSaveTemplate && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700">テンプレートとして保存</span>
            <button onClick={() => setShowSaveTemplate(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); }}
            placeholder="テンプレート名（例：管理職研修用）"
            autoFocus
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
          <button
            onClick={handleSaveTemplate}
            disabled={!templateName.trim()}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-purple-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            <Save className="h-3 w-3" /> 保存
          </button>
        </div>
      )}

      {/* 書き起こし進捗 */}
      {transcriptionProgress && (
        <div className="text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mt-2 flex items-center gap-2">
          <span className="animate-spin">⚙️</span>
          <span>{transcriptionProgress}</span>
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-100 bg-white/80 p-4">
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-4 py-2 text-sm font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
            >
              <Copy className="h-3.5 w-3.5" /> コピー
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-4 py-2 text-sm font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
            >
              <Download className="h-3.5 w-3.5" /> テキスト保存
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> MD保存
            </button>
            <button
              onClick={() => {
                const label = ANALYSIS_GROUPS.flatMap((g) => g.options).find(
                  (o) => o.value === analysisType
                )?.label ?? analysisType;
                saveAnalysis({
                  fileName: fileName ?? "unknown",
                  analysisType,
                  analysisLabel: label,
                  content: result,
                  tags: [],
                  folder: "",
                });
                toastOk("ストックに保存しました");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-400 to-purple-400 px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              <BookmarkPlus className="h-3.5 w-3.5" /> ストックに保存
            </button>
          </div>
        </div>
      )}

      {/* Genspark プレゼン資料生成 */}
      {result && (
        <div className="w-full space-y-4 rounded-2xl border border-purple-200 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
          <h3 className="flex items-center gap-2 text-base font-bold text-gray-700">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Gensparkプレゼン資料を作成
          </h3>

          {/* Gensparkテンプレートから呼び出し */}
          {templates.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                テンプレートから呼び出す
              </label>
              <select
                value=""
                onChange={(e) => {
                  const t = templates.find((t) => t.id === e.target.value);
                  if (t) handleApplyTemplateToGenspark(t);
                }}
                className={selectClass}
              >
                <option value="">-- テンプレートを選択 --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                聴講ターゲット
              </label>
              <select value={gsTarget} onChange={(e) => setGsTarget(e.target.value)} className={selectClass}>
                {TARGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                内容レベル
              </label>
              <select value={gsLevel} onChange={(e) => setGsLevel(e.target.value)} className={selectClass}>
                {LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                プレゼンの目的
              </label>
              <select value={gsPurpose} onChange={(e) => setGsPurpose(e.target.value)} className={selectClass}>
                {PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">
                スライドのトーン
              </label>
              <select value={gsTone} onChange={(e) => setGsTone(e.target.value)} className={selectClass}>
                {TONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              追加要望（任意）
            </label>
            <textarea
              value={gsNotes}
              onChange={(e) => setGsNotes(e.target.value)}
              placeholder="例：会社のカラーはピンクと白。冒頭に院長の挨拶スライドを入れてほしい。など"
              rows={3}
              className={selectClass}
            />
          </div>

          {hasTechniques && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-500">自動適用される技法：</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {appliesEmotion && (
                  <span className="rounded-full border border-pink-200 bg-pink-50 px-2 py-1 text-xs text-pink-700">
                    感情の動線設計
                  </span>
                )}
                {appliesCatch && (
                  <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-xs text-purple-700">
                    1スライド1メッセージ
                  </span>
                )}
                {appliesBeforeAfter && (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                    Before/After比較
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleGensparkGenerate}
              disabled={gsLoading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
            >
              {gsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {gsLoading ? "生成中..." : "Gensparkプロンプトを生成"}
            </button>
            <button
              onClick={() => setShowGsSaveTemplate(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-pink-200 bg-white px-3 py-3 text-sm font-medium text-pink-600 hover:bg-pink-50"
            >
              <Save className="h-4 w-4" /> 設定を保存
            </button>
          </div>

          {/* Genspark テンプレート保存モーダル */}
          {showGsSaveTemplate && (
            <div className="rounded-lg border border-pink-200 bg-pink-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-pink-700">テンプレートとして保存</span>
                <button onClick={() => setShowGsSaveTemplate(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={gsTemplateName}
                onChange={(e) => setGsTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleGsSaveTemplate(); }}
                placeholder="テンプレート名（例：管理職研修用）"
                autoFocus
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-200"
              />
              <button
                onClick={handleGsSaveTemplate}
                disabled={!gsTemplateName.trim()}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-pink-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                <Save className="h-3 w-3" /> 保存
              </button>
            </div>
          )}

          {gsPrompt && (
            <div className="space-y-3">
              <textarea
                readOnly
                value={gsPrompt}
                rows={12}
                className="w-full rounded-xl border border-purple-200 bg-white/80 px-4 py-3 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleGsCopyAndOpen}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white shadow-sm"
                >
                  <Copy className="h-3.5 w-3.5" /> コピーしてGensparkを開く
                  <ExternalLink className="h-3 w-3" />
                </button>
                <button
                  onClick={handleGsCopyOnly}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/60 px-4 py-2 text-sm font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white/80"
                >
                  <Copy className="h-3.5 w-3.5" /> コピーのみ
                </button>
                <a
                  href="https://www.genspark.ai/ai_slides?tab=explore"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Gensparkで資料作成
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
