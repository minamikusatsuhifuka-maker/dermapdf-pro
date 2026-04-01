"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { BrainCircuit, Copy, Download, Loader2, ExternalLink, Sparkles, BookmarkPlus } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";
import { analyzeWithGemini } from "@/lib/gemini-client";
import { saveAnalysis } from "@/lib/analysis-storage";

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
  | "goal_cheer";

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
];

const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
  // 基本分析
  summary:
    "この資料の内容を簡潔に要約してください。主要なポイントを箇条書きで整理し、全体像がわかるようにまとめてください。",
  detail_summary:
    "この資料の内容を、通常の要約よりも細部まで丁寧に読み取り、詳細にまとめてください。表面的なキーワードだけでなく、文脈・背景・ニュアンス・行間の意図まで汲み取り、以下の形式で出力してください。\n\n## 全体の概要\n（資料全体を3〜5文で説明）\n\n## 主要テーマと詳細内容\n（各セクション・章ごとに、見出しと詳細な説明を箇条書きで記載）\n\n## 重要なポイント・数値・固有名詞\n（見逃してはいけない具体的な情報を列挙）\n\n## 読み取れる背景・意図・示唆\n（明示されていないが文脈から読み取れる意図や示唆）\n\n## まとめと活用提案\n（この資料をどう活用できるか、具体的な提案）\n\n省略せず、資料の細部まで丁寧に反映してください。",
  transcription:
    "この資料に含まれる全てのテキストを書き起こしてください。図・表・グラフ内の文字も含め、ページ順・レイアウト構造を維持しながら全文を出力してください。一切省略せず完全に出力してください。",

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
};

interface GeminiPanelProps {
  fileBase64?: string;
  fileMime?: string;
  fileName?: string;
  onResult?: (result: string) => void;
}

const TARGET_OPTIONS = [
  { value: "all_staff", label: "全スタッフ（職種混合）" },
  { value: "management", label: "管理職・リーダー層" },
  { value: "new_staff", label: "新入社員・新人スタッフ" },
  { value: "medical_staff", label: "医療スタッフ（看護師・技師等）" },
  { value: "front_staff", label: "受付・フロントスタッフ" },
  { value: "patients", label: "患者・一般向け" },
  { value: "investors", label: "投資家・金融機関向け" },
  { value: "partners", label: "取引先・パートナー企業向け" },
];

const LEVEL_OPTIONS = [
  { value: "simple", label: "簡潔（要点のみ・5〜8枚）" },
  { value: "standard", label: "標準（バランス重視・10〜15枚）" },
  { value: "detailed", label: "詳しく（網羅的・20〜30枚）" },
  { value: "expert", label: "専門家向け（データ重視・制限なし）" },
];

const PURPOSE_OPTIONS = [
  { value: "inform", label: "情報共有・周知" },
  { value: "educate", label: "教育・研修" },
  { value: "persuade", label: "説得・意思決定促進" },
  { value: "motivate", label: "モチベーションアップ" },
  { value: "report", label: "報告・振り返り" },
  { value: "propose", label: "提案・企画" },
  { value: "celebrate", label: "表彰・表彰式" },
];

const TONE_OPTIONS = [
  { value: "professional", label: "プロフェッショナル（ビジネス調）" },
  { value: "friendly", label: "親しみやすい（カジュアル調）" },
  { value: "inspiring", label: "感動的・ストーリー調" },
  { value: "data_driven", label: "データドリブン（グラフ・数値重視）" },
  { value: "visual", label: "ビジュアル重視（図解・イラスト）" },
];

function getLabel(options: { value: string; label: string }[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function GeminiPanel({
  fileBase64,
  fileMime,
  fileName,
  onResult,
}: GeminiPanelProps) {
  const [analysisType, setAnalysisType] = useState<AnalysisType>("summary");
  const [purpose, setPurpose] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  // Genspark state
  const [gsTarget, setGsTarget] = useState("all_staff");
  const [gsLevel, setGsLevel] = useState("standard");
  const [gsPurpose, setGsPurpose] = useState("inform");
  const [gsTone, setGsTone] = useState("professional");
  const [gsNotes, setGsNotes] = useState("");
  const [gsPrompt, setGsPrompt] = useState("");
  const [gsLoading, setGsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!fileBase64 || !fileMime || !fileName) {
      toastError("ファイルが選択されていません");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const basePrompt = ANALYSIS_PROMPTS[analysisType];
      const fullPrompt = purpose
        ? `${basePrompt}\n\n目的: ${purpose}`
        : basePrompt;

      const data = await analyzeWithGemini(fileBase64, fileMime, fullPrompt);
      if (!data.success) throw new Error(data.error || "分析に失敗しました");

      setResult(data.analysis);
      onResult?.(data.analysis);
      toastOk("AI分析が完了しました");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "分析に失敗しました";
      toastError(msg);
    } finally {
      setLoading(false);
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

  // プレゼン技法の自動適用判定
  const emotionTargets = ["all_staff", "new_staff", "medical_staff", "front_staff", "management"];
  const emotionPurposes = ["educate", "motivate", "celebrate"];
  const appliesEmotion = emotionTargets.includes(gsTarget) || emotionPurposes.includes(gsPurpose);

  const catchTargets = ["management", "all_staff", "new_staff", "medical_staff", "front_staff"];
  const catchPurposes = ["educate", "persuade", "motivate", "propose"];
  const appliesCatch = catchTargets.includes(gsTarget) || catchPurposes.includes(gsPurpose);

  const beforeAfterPurposes = ["inform", "report", "propose"];
  const beforeAfterTargets = ["all_staff", "management", "medical_staff", "front_staff"];
  const appliesBeforeAfter = beforeAfterPurposes.includes(gsPurpose) || beforeAfterTargets.includes(gsTarget);

  const hasTechniques = appliesEmotion || appliesCatch || appliesBeforeAfter;

  const handleGensparkGenerate = async () => {
    if (!result) return;
    setGsLoading(true);
    setGsPrompt("");

    try {
      const techniques: string[] = [];

      if (appliesEmotion) {
        techniques.push(`【感情の動線設計】
スライド構成全体を以下の5段階の感情の動線で設計してください：
① 共感（現場の課題・悩みをスタッフの言葉で言語化するスライド）
② 気づき（なぜその課題が起きているかのWhy・原因を示すスライド）
③ 希望（こう変われる・こうなれる未来のビジョンを示すスライド）
④ 具体策（明日から現場で使える行動レベルの方法を示すスライド）
⑤ 決意（チームへのメッセージ・参加者のコミットメントを促すスライド）
各段階に少なくとも1枚以上のスライドを割り当ててください。`);
      }

      if (appliesCatch) {
        techniques.push(`【1スライド1メッセージ・キャッチコピー構造】
全てのコンテンツスライドに以下の2層構造を必ず使用してください：
・キャッチライン：そのスライドの結論を全角15文字以内の一言で表現
  （例：「褒め方で人は3倍育つ」「報告は24時間以内が鉄則」）
・サポートテキスト：キャッチラインの根拠・補足を箇条書き3点以内で記載
キャッチラインはスライド上部に大きく（36pt以上）配置し、
見た瞬間0.5秒で内容が理解できるデザインにしてください。`);
      }

      if (appliesBeforeAfter) {
        techniques.push(`【Before / After 比較レイアウト】
変化・改善・新制度・新ルールを説明するスライドでは必ず以下を使用してください：
・左カラム（Before）：現状・課題・これまでの方法
・右カラム（After）：改善後・解決策・これからの方法
・Beforeエリア：落ち着いたグレー（#6B7280）系の配色
・Afterエリア：ピンク・ローズ系（#f43f5e）の配色で「明るくなった」印象を演出
・各カラムの上部にアイコンを配置（Before: ⚠️ または 😔、After: ✅ または 😊）
この比較レイアウトにより、変化への理解と受け入れを促進してください。`);
      }

      const techniqueBlock = techniques.length > 0
        ? `\n\n【自動適用プレゼン技法】\n${techniques.join("\n\n")}`
        : "";

      const prompt = `あなたはGenspark AIスライド生成に特化したプロンプトエンジニアです。
以下の分析結果とユーザー要件をもとに、Gensparkで最高品質のPPTXスライドを
生成するための完全なプロンプトを日本語で作成してください。

【分析結果】
${result}

【プレゼン要件】
- ターゲット層: ${getLabel(TARGET_OPTIONS, gsTarget)}
- 内容レベル: ${getLabel(LEVEL_OPTIONS, gsLevel)}
- プレゼンの目的: ${getLabel(PURPOSE_OPTIONS, gsPurpose)}
- スライドのトーン: ${getLabel(TONE_OPTIONS, gsTone)}
- 追加要望: ${gsNotes || "なし"}

【出力するプロンプトに必ず含める8つの要素】

### 1. プレゼン全体のテーマと目的
ターゲット層と目的を明記し、「このスライドで聴衆に何を持ち帰ってほしいか」を1文で表現する。

### 2. ターゲット聴衆の詳細説明
聴衆の知識レベル・関心・状況を具体的に記述し、スライドの難易度調整の根拠とする。

### 3. 推奨スライド構成
タイトルスライドから終わりまで、各スライドの見出しと内容概要を番号付きで列挙する。
枚数は内容レベルに合わせる。
${techniqueBlock}

### 4. レイアウト・テキスト量の厳格な指示（最重要）
以下の指示を必ずプロンプトに含める：
- 1スライドあたりのテキストは最大100文字以内に収める
- 箇条書きは1スライドにつき最大5項目まで
- フォントサイズはタイトル36pt以上、本文24pt以上を維持する
- テキストボックスは必ずスライド枠内（余白10%以上）に収める
- 長い文章は複数スライドに分割する
- 図・表・グラフはスライド枠の80%以内のサイズに収める
- PPTXエクスポート時にコンテンツが切れないよう、各要素に十分な余白を設ける
- タイトルは1行に収まる文字数（全角20文字以内）に制限する

### 5. デザイン指示
カラーパレット・フォント・レイアウトパターンを具体的に指定する。
統一感のあるデザインテーマを1つ選び、全スライドに適用するよう指示する。

### 6. ビジュアル要素の指示
各スライドで使用すべき図解・アイコン・グラフ・写真のイメージを具体的に指定する。
テキストと画像の比率は6:4を目安とする。

### 7. 話し言葉のトーンとスタイル
スライド上のテキストの文体・語調を具体的に指定する。

### 8. PPTXエクスポート品質の最終指示（必須）
以下をプロンプトの末尾に必ず追加する：
「【重要：PPTX出力品質の指示】
・全スライドのテキスト・画像・図形がスライド枠（16:9）の内側に完全に収まること
・テキストボックスのオートフィット（自動縮小）を使用せず、フォントサイズを固定すること
・各スライドの余白は上下左右それぞれ最低1.5cm確保すること
・スライドをまたぐコンテンツは作成しないこと
・PPTXとしてダウンロードした際にフォント・レイアウト・配色が崩れないよう、
  標準フォント（メイリオ、游ゴシック、またはNoto Sans JP）を使用すること
・背景画像を使う場合は文字の可読性を確保するため、
  テキストエリアに半透明の白または黒のオーバーレイを設けること」`;

      // テキストのみのリクエスト（ファイル不要）
      const data = fileBase64 && fileMime
        ? await analyzeWithGemini(fileBase64, fileMime, prompt)
        : await analyzeWithGemini("", "text/plain", prompt);

      if (!data.success) throw new Error(data.error || "プロンプト生成に失敗しました");
      setGsPrompt(data.analysis);
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

      {/* 実行ボタン */}
      <button
        onClick={handleAnalyze}
        disabled={loading || !fileBase64}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-400 via-rose-500 to-purple-400 px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span>🚀</span>
        )}
        {loading ? "分析中..." : "実行"}
      </button>

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

          <button
            onClick={handleGensparkGenerate}
            disabled={gsLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
          >
            {gsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {gsLoading ? "生成中..." : "Gensparkプロンプトを生成"}
          </button>

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
