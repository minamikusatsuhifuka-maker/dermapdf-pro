"use client";

import { useEffect, useState } from "react";
import MarkdownView from "@/components/ui/markdown-view";
import { ProofreadModal } from "@/components/proofread/proofread-modal";
import { BrainCircuit, Copy, Download, Loader2, ExternalLink, Sparkles, BookmarkPlus, Save, X, Check, GripVertical } from "lucide-react";
import { toastOk, toastError } from "@/components/ui/toast-provider";
import {
  analyzeWithGemini,
  analyzeTextWithGemini,
  analyzeImagesWithGemini,
} from "@/lib/gemini-client";
import { saveAnalysis } from "@/lib/analysis-storage";
import { copyRichText } from "@/lib/clipboard-rich";
import { saveTemplate, loadTemplates, type AnalysisTemplate } from "@/lib/template-storage";
import { splitPdfPages, extractPdfPages, getPdfPageCount } from "@/lib/pdf-splitter";
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
  | "genspark_slide"
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
  | "lm_risk_prevention"
  // SNS・マーケティング
  | "instagram_post"
  | "sns_copy"
  | "review_reply"
  // 採用・面接支援
  | "job_posting"
  | "interview_questions"
  | "candidate_evaluation"
  // 患者対応・改善
  | "patient_survey"
  | "nps_improvement"
  | "patient_info"
  | "faq_creation"
  // ブランディング・コンテンツ
  | "blog_writing"
  | "philosophy_words"
  | "patient_story"
  | "hp_copy"
  // 追加: 経営
  | "monthly_sales"
  // 追加: 採用
  | "job_posting_detail"
  // 追加: 人材育成
  | "training_program"
  | "team_building"
  // 追加: わかりやすく
  | "yasashii_summary"
  | "structured_summary"
  | "prep_summary"
  | "easy_rewrite"
  | "glossary"
  | "qa_anticipated"
  | "key_messages"
  // 追加: プレゼン
  | "slide_outline"
  | "handout_a4"
  // 追加: プレゼン原稿（🎤 ボタン専用。分析タイプ一覧には出さない）
  | "presentation_script";

interface AnalysisOption {
  value: AnalysisType;
  label: string;
}

interface AnalysisGroup {
  label: string;
  options: AnalysisOption[];
}

// 結果パネル本文の高さプリセット（"全" は上限なし＝auto）
const HEIGHT_PRESETS: { label: string; h: number }[] = [
  { label: "S", h: 200 },
  { label: "M", h: 350 },
  { label: "L", h: 500 },
  { label: "全", h: 9999 },
];

const ANALYSIS_GROUPS: AnalysisGroup[] = [
  {
    label: "\u{1F4C4} 基本分析",
    options: [
      { value: "summary", label: "概要・要約" },
      { value: "detail_summary", label: "詳細にまとめる" },
      { value: "genspark_slide", label: "Gensparkスライド資料用まとめ" },
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
      { value: "monthly_sales", label: "月次売上レポート分析" },
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
      { value: "training_program", label: "研修プログラム自動設計" },
      { value: "team_building", label: "チームビルディング施策" },
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
  {
    label: "\u{1F4E3} SNS・マーケティング",
    options: [
      { value: "instagram_post", label: "Instagram投稿文を作成" },
      { value: "sns_copy", label: "SNSコピー・キャッチコピー生成" },
      { value: "review_reply", label: "口コミ返信文を作成" },
    ],
  },
  {
    label: "\u{1F464} 採用・面接支援",
    options: [
      { value: "job_posting", label: "求人票を作成" },
      { value: "interview_questions", label: "選択理論ベースの面接質問集" },
      { value: "candidate_evaluation", label: "応募者評価・採用判断支援" },
      { value: "job_posting_detail", label: "職種別求人票を作成" },
    ],
  },
  {
    label: "\u{1F3E5} 患者対応・改善",
    options: [
      { value: "patient_survey", label: "患者アンケートを分析" },
      { value: "nps_improvement", label: "NPS・患者満足度改善プラン" },
      { value: "patient_info", label: "患者説明書・同意書を作成" },
      { value: "faq_creation", label: "よくある質問FAQを作成" },
    ],
  },
  {
    label: "\u{2728} ブランディング・コンテンツ",
    options: [
      { value: "blog_writing", label: "院長ブログ・コラムを執筆" },
      { value: "philosophy_words", label: "クリニック理念を言語化" },
      { value: "patient_story", label: "患者体験談をストーリー化" },
      { value: "hp_copy", label: "HP・パンフのコピーライティング" },
    ],
  },
  {
    label: "\u{1F4D6} わかりやすく",
    options: [
      { value: "yasashii_summary", label: "やさしい日本語要約" },
      { value: "structured_summary", label: "構造化要約（見出し＋箇条書き）" },
      { value: "prep_summary", label: "結論先出し（PREP）" },
      { value: "easy_rewrite", label: "分かり易くリライト" },
      { value: "glossary", label: "用語グロッサリー" },
      { value: "qa_anticipated", label: "想定Q&A" },
      { value: "key_messages", label: "キーメッセージ抽出" },
    ],
  },
  {
    label: "\u{1F5A5}\u{FE0F} プレゼン",
    options: [
      { value: "slide_outline", label: "スライド構成案" },
      { value: "handout_a4", label: "ハンドアウト（1枚）" },
    ],
  },
];

// 基本分析タイプの表示順（DnD並べ替え）をlocalStorageに保存するキーと既定順。
const BASIC_ORDER_KEY = "dermapdf_basic_analysis_order";
const BASIC_OPTION_VALUES: AnalysisType[] = ANALYSIS_GROUPS[0].options.map(
  (o) => o.value
);

// 保存済み順序と現在のタイプ一覧の不一致でも壊れないように正規化：
// 既知タイプを保存順に並べ、保存順に無い新タイプは末尾、存在しないタイプは無視。
function loadBasicOrder(): AnalysisType[] {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(BASIC_ORDER_KEY)
        : null;
    const saved: AnalysisType[] = raw ? JSON.parse(raw) : [];
    const inSaved = (Array.isArray(saved) ? saved : []).filter((v) =>
      BASIC_OPTION_VALUES.includes(v)
    );
    const rest = BASIC_OPTION_VALUES.filter((v) => !inSaved.includes(v));
    return [...inSaved, ...rest];
  } catch {
    return [...BASIC_OPTION_VALUES];
  }
}

export const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
  // 基本分析
  summary:
    "この資料の内容を簡潔に要約してください。主要なポイントを箇条書きで整理し、全体像がわかるようにまとめてください。",
  detail_summary:
    "この資料の内容を、通常の要約よりも細部まで丁寧に読み取り、詳細にまとめてください。表面的なキーワードだけでなく、文脈・背景・ニュアンス・行間の意図まで汲み取り、以下の形式で出力してください。\n\n## 全体の概要\n（資料全体を3〜5文で説明）\n\n## 主要テーマと詳細内容\n（各セクション・章ごとに、見出しと詳細な説明を箇条書きで記載）\n\n## 重要なポイント・数値・固有名詞\n（見逃してはいけない具体的な情報を列挙）\n\n## 読み取れる背景・意図・示唆\n（明示されていないが文脈から読み取れる意図や示唆）\n\n## まとめと活用提案\n（この資料をどう活用できるか、具体的な提案）\n\n省略せず、資料の細部まで丁寧に反映してください。",
  genspark_slide:
    "この資料の内容を、Gensparkでのスライド資料作成に最適な形式でまとめてください。\n\n# スライドタイトル\n（資料全体を表す簡潔なタイトル）\n\n# エグゼクティブサマリー（1スライド分）\n（全体の要点を3〜5行で）\n\n# スライド構成案\n## スライド1: （タイトル）\n- ポイント1\n- ポイント2\n- ポイント3\n\n## スライド2: （タイトル）\n- ポイント1\n- ポイント2\n- ポイント3\n\n（以下、内容に応じて5〜10スライド分）\n\n# キーメッセージ（クロージングスライド用）\n（聴衆に最も伝えたいこと1〜2文）\n\n# 補足データ・引用\n（スライドに入れるべき数値・固有名詞・引用文）\n\n【出力ルール】\n- 各スライドは3〜5箇条書きで完結させる\n- 専門用語は平易な言葉に言い換える\n- 数値・固有名詞は正確に記載する\n- Markdown形式で出力する",
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
  // SNS・マーケティング
  instagram_post:
    "以下の資料をもとに、美容皮膚科クリニックのInstagram投稿文を作成してください。\n\n## キャプション案（3パターン）\n\n### パターン1（教育系・ためになる投稿）\n- 書き出し（フック）：\n- 本文（3〜5行）：\n- CTA（行動喚起）：\n- ハッシュタグ（10〜15個）：\n\n### パターン2（共感系・患者目線）\n- 書き出し（フック）：\n- 本文：\n- CTA：\n- ハッシュタグ：\n\n### パターン3（権威性・専門知識訴求）\n- 書き出し：\n- 本文：\n- CTA：\n- ハッシュタグ：\n\n## 投稿のポイント\n（最適な投稿時間帯、画像の方向性、エンゲージメントを高めるコツ）",
  sns_copy:
    "以下の資料をもとに、クリニックのSNS・広告・院内ポスター向けのコピーを作成してください。\n\n## キャッチコピー（5案）\n（短く・記憶に残る・患者の感情に訴えるもの）\n\n## サブコピー（5案）\n（キャッチの補足・施術の価値を伝える1〜2文）\n\n## LINE配信文（2案）\n（既存患者向けのリピート促進メッセージ）\n\n## Web広告見出し（Google/Meta広告向け・30文字以内で5案）\n\n## 患者の声風コピー（実際の声をベースにしたストーリー形式・2案）",
  review_reply:
    "以下の口コミ・患者フィードバックに対する返信文を作成してください。\n\n【返信文の方針】\n- 感謝・共感を最初に示す\n- クリニックの姿勢・理念を自然に盛り込む\n- 次回来院への橋渡しをする\n- リードマネジメントの「外的コントロールを使わない」姿勢で\n- 200〜300文字程度\n\n## ポジティブな口コミへの返信案（2パターン）\n\n## 改善要望・クレームへの返信案（2パターン）\n（誠実に受け止めつつ、クリニックの価値を守る表現で）\n\n## 返信のポイント\n（この口コミへの対応で特に意識すべき点）",
  // 採用・面接支援
  job_posting:
    "以下の情報をもとに、魅力的な求人票を作成してください。\n\n## 求人票（Indeed・求人サイト向け）\n\n### キャッチコピー（2案）\n### 仕事内容（箇条書き5〜7項目）\n### 求める人物像（スキル・資質・マインド）\n### 職場の魅力・環境（3〜5項目）\n### クリニックの理念・文化\n### 応募者へのメッセージ（院長・スタッフからの言葉）\n\n## SNS採用投稿版（Instagram/Facebookショート版）\n\n## 応募者が「ここで働きたい」と思うポイント分析",
  interview_questions:
    "以下の求人要件・理想のスタッフ像をもとに、選択理論（リードマネジメント）に基づいた面接質問集を作成してください。\n\n## 基本確認質問（5問）\n（経験・スキルの確認）\n\n## 選択理論的質問（10問）\n（内発的動機・価値観・上質世界を探る質問）\n例：「これまでで一番やりがいを感じた瞬間はいつですか？」\n\n## 5つの基本的欲求を探る質問（各欲求1〜2問）\n- 生存の欲求（安定・安全を求めるか）\n- 愛・所属の欲求（チームワーク・関係性）\n- 力の欲求（成長・達成志向）\n- 自由の欲求（自律性・創造性）\n- 楽しみの欲求（学び・ユーモア）\n\n## NG質問・注意点\n（法的にNGな質問・選択理論的にふさわしくない質問）\n\n## 面接後の評価シート\n（各項目を5段階で評価するシート）",
  candidate_evaluation:
    "以下の応募書類・面接メモをもとに、採用判断の参考となる評価を行ってください。\n\n## 強み・ポテンシャル分析\n## 懸念点・要注意ポイント\n## 選択理論的観点からの人物像予測\n（優位な欲求・コミュニケーションスタイル・チームへの影響）\n## 採用した場合の定着予測とリスク\n## 入社後のフォローアップ提案\n（最初の3ヶ月で特に意識すべきこと）\n## 総合評価（A/B/C + 理由）",
  // 患者対応・改善
  patient_survey:
    "以下の患者アンケート結果を分析してください。\n\n## 総合評価サマリー\n（全体的な満足度・NPS傾向）\n\n## 良い評価が多いポイント TOP5\n（強みとして伸ばすべき点）\n\n## 改善が必要なポイント TOP5\n（優先度順に整理）\n\n## カテゴリ別分析\n- 接遇・スタッフ対応\n- 施術・治療の質\n- 待ち時間・予約\n- 院内環境・清潔感\n- 費用・説明のわかりやすさ\n\n## 患者の声からの具体的なアクション提案（5項目）\n（すぐできること・中期的に取り組むこと）\n\n## リードマネジメント観点からの考察\n（患者の「上質世界」に近づくための提案）",
  nps_improvement:
    "以下のデータ・状況をもとに、患者満足度とNPSを向上させる具体的な改善プランを作成してください。\n\n## 現状分析と課題整理\n\n## 即効性の高い改善施策（1週間以内に実施可能）\n\n## 中期改善施策（1〜3ヶ月）\n\n## 長期ブランディング施策（3〜6ヶ月）\n\n## スタッフ教育・接遇改善プログラム\n\n## 改善効果の測定方法（KPI設定）\n\n## 競合クリニックとの差別化ポイント",
  patient_info:
    "以下の施術・治療内容をもとに、患者向け説明書・同意書を作成してください。\n\n## 患者説明書\n\n### 施術概要（患者が理解しやすい言葉で）\n### 期待できる効果\n### リスク・副作用（正直に・不安を煽らない表現で）\n### 施術前の注意事項\n### 施術後のケア・アフターフォロー\n### よくある質問（FAQ）5問\n\n## 同意書\n\n### 同意事項（箇条書き・明確に）\n### 患者確認チェックリスト\n### 署名欄の構成\n\n## 持ち帰り用ケアカード（名刺サイズ・要点のみ）",
  faq_creation:
    "以下の資料・クリニック情報をもとに、患者向けFAQを作成してください。\n\n## 来院前のよくある質問（10問）\n（予約・費用・初診の流れ・駐車場など）\n\n## 施術・治療に関するよくある質問（10問）\n（効果・期間・痛み・副作用・ダウンタイムなど）\n\n## 料金・保険に関するよくある質問（5問）\n\n## アフターフォローに関するよくある質問（5問）\n\n## オンライン掲載用フォーマット\n（Q&A形式・検索エンジン向け構造化データ対応）\n\n## スタッフ向け口頭回答ガイド\n（患者から聞かれたときの自然な答え方）",
  // ブランディング・コンテンツ
  blog_writing:
    "以下の資料・テーマをもとに、院長ブログ・医療コラムを執筆してください。\n\n## ブログ記事（SEO対策版）\n\n### タイトル案（3案）\n（検索されやすく・クリックされやすいタイトル）\n\n### 記事本文（800〜1200文字）\n- リード文（読者の悩み・共感から入る）\n- 本文（専門知識をわかりやすく・信頼感を演出）\n- まとめ・CTA（クリニックへの来院促進）\n\n### メタディスクリプション（120文字以内）\n\n### タグ・カテゴリ提案\n\n## SNS告知文（Instagram・X用）\n\n## 記事のSEOポイント解説",
  philosophy_words:
    "以下の情報・考え・想いをもとに、クリニックの理念・ビジョン・バリューを言語化してください。\n\n## ミッション（使命）案（3案）\n（なぜこのクリニックが存在するのか）\n\n## ビジョン（目指す姿）案（3案）\n（5〜10年後にどんなクリニックでありたいか）\n\n## バリュー（大切にする価値観）5〜7項目\n（スタッフ全員が体現する行動指針）\n\n## スローガン案（5案）\n（患者・スタッフの心に残る一言）\n\n## 院長メッセージ（HP・パンフ向け・400文字）\n（理念に込めた想いを患者に伝える文章）\n\n## スタッフへの理念浸透メッセージ（朝礼・研修で使える言葉）",
  patient_story:
    "以下の患者の声・体験談をもとに、感動的なストーリーに仕上げてください。\n\n## ストーリー記事（HP・SNS掲載用）\n\n### タイトル（3案）\n（患者の変化・感情を表現したタイトル）\n\n### 本文（600〜800文字）\n- Before（来院前の悩み・不安）\n- 転機（クリニックとの出会い・決断）\n- After（施術後の変化・感動）\n- 未来（これからへの期待・メッセージ）\n\n## SNS投稿版（短縮版・200文字）\n\n## 動画・インタビュー台本（Q&A形式）\n\n## 使用上の注意・免責事項の追加案",
  hp_copy:
    "以下の資料・クリニック情報をもとに、Webサイト・パンフレット向けのコピーを作成してください。\n\n## トップページ\n- メインビジュアルキャッチコピー（3案）\n- サブコピー（2案）\n- 「選ばれる理由」3〜5項目\n\n## 施術・サービスページ\n- 各施術の説明文（患者目線・ベネフィット重視）\n- 施術前後の変化を伝える表現\n- よくある不安への先回り説明\n\n## 院内紹介ページ\n- 設備・環境の魅力を伝える文章\n- スタッフ紹介の書き方テンプレート\n\n## 初診案内・アクセスページ\n- 初めての方への安心メッセージ\n- 予約・来院の流れ説明文\n\n## パンフレット3つ折り構成案\n（表紙・内側左・内側中・内側右・裏表紙の文章構成）",
  // 経営追加
  monthly_sales:
    "以下の売上データ・レポートを分析し、経営判断に役立つインサイトを提供してください。\n\n## 📊 売上サマリー\n- 今月の総売上・前月比・前年同月比\n- 施術別・診療科別の売上内訳\n\n## 📈 トレンド分析\n- 伸びている施術・サービス\n- 落ち込んでいる施術・サービス\n- 患者数・客単価の変化\n\n## 💡 要因分析\n- 好調の要因（内部・外部）\n- 不調の要因と改善余地\n\n## 🎯 来月の重点施策（3〜5項目）\n- 売上向上のための具体的なアクション\n- 優先順位付き\n\n## ⚠️ 経営リスクと対策\n- 注意すべき指標\n- 先手を打つべき対策\n\n## 📋 院長・幹部向け一言サマリー（200文字以内）",
  // 採用追加
  job_posting_detail:
    "以下の職種・条件をもとに、職種に最適化された求人票を作成してください。\n\n## 医療事務・受付スタッフ向け\n### キャッチコピー（2案）\n### 仕事内容（具体的な1日の流れ付き）\n### 求める人物像\n### この職場ならではの魅力\n\n## 看護師・医療アシスタント向け\n### キャッチコピー（2案）\n### 仕事内容と成長機会\n### 求めるスキル・資格\n### キャリアパス\n\n## 美容部門スタッフ向け（美容看護師・エステシャン）\n### キャッチコピー（2案）\n### 施術内容・専門スキル習得機会\n### 理想の人物像\n\n## 全職種共通\n### クリニックの文化・理念\n### 働き方・福利厚生のアピールポイント\n### 応募者へのメッセージ",
  // 人材育成追加
  training_program:
    "以下の資料・目標・対象者をもとに、研修プログラムを設計してください。\n\n## 研修概要\n- 対象者・目的・期間・形式\n\n## 研修カリキュラム（全体スケジュール）\n| 回 | テーマ | 内容 | 時間 | 形式 |\n\n## 各回の詳細設計（第1回〜第3回）\n### 目標・ゴール\n### アジェンダ（時間割）\n### 使用資料・教材\n### ワーク・演習内容\n### 振り返りポイント\n\n## 理解度確認テスト（各回3問）\n\n## 選択理論を活かした研修設計のポイント\n（内発的動機を高める工夫・外的コントロールを使わない評価方法）\n\n## 研修効果測定の方法（KPI設定）",
  team_building:
    "以下の状況・課題・チーム情報をもとに、チームビルディング施策を立案してください。\n\n## 現状分析\n（提供された情報から読み取れるチームの課題・強み）\n\n## 即実践できる施策（今週からできること）\n- 朝礼・終礼の改善案\n- コミュニケーション活性化の仕掛け\n- 感謝・承認を増やすシンプルな方法\n\n## 月次施策（毎月継続するもの）\n- チームミーティングの設計\n- 個別面談の進め方\n- 成果の見える化\n\n## イベント・特別施策（四半期・年1回）\n- チームで体験する研修・イベント案\n- 表彰・認定制度の設計\n\n## 選択理論的チームビルディングのポイント\n（5つの欲求を満たす職場環境づくり）\n\n## 3ヶ月後の理想のチーム像と達成基準",
  // わかりやすく
  yasashii_summary:
    "次の文書を、専門用語をできるだけ避け、中学生でも理解できるやさしい日本語で要約してください。難しい医学・専門用語がどうしても必要な場合は、かっこ書きで短い補足を添えてください。元の文書にない情報は足さないでください。",
  structured_summary:
    "次の文書を、見出し（##）と箇条書きで階層的に構造化して要約してください。トピックごとに見出しを立て、要点を箇条書きで整理し、そのままプレゼンや資料の骨子として使える形にしてください。元の文書にない情報は足さないでください。",
  prep_summary:
    "次の文書をPREP法（結論→理由→具体例→結論）で再構成して要約してください。最初に最も重要な結論を1〜2文で示し、続いて理由、裏付けとなる具体例、最後にまとめの結論を述べてください。元の文書にない情報は足さないでください。",
  easy_rewrite:
    "次の文書の意味を保ったまま、より分かりやすく読みやすい文章に書き換えてください。一文を短くし、回りくどい表現を平易にし、論理の流れを整理してください。情報の追加・削除はせず、表現のみを改善してください。",
  glossary:
    "次の文書に登場する専門用語・商品名・成分名などを抽出し、「用語 — 平易な定義」の対で一覧にしてください。定義は文書の文脈に沿い、一般の方にも分かる言葉で1〜2文にまとめてください。文書にない用語は足さないでください。",
  qa_anticipated:
    "次の文書をもとに、読み手が抱きそうな質問とその回答を5〜8組、Q&A形式で作成してください。質問は実際に患者やスタッフから出そうな自然なものにし、回答は文書の内容に忠実に簡潔にしてください。文書に記載のない事項は「資料に記載なし」と明記してください。",
  key_messages:
    "次の文書から、最も重要なキーメッセージを3〜5点抽出し、箇条書きで示してください。各メッセージは一目で伝わる短い一文にしてください。元の文書にない情報は足さないでください。",
  // プレゼン
  slide_outline:
    "次の文書を、プレゼンのスライド構成案に変換してください。各スライドを「## スライドN：タイトル」とし、その下に「要点」（箇条書き3つ程度）と「話者ノート」（口頭で話す補足を2〜3文）を記載してください。導入・本論・まとめの流れを意識し、元の文書にない情報は足さないでください。",
  handout_a4:
    "次の文書を、配布用のA4 1枚に収まるハンドアウトとして要約してください。タイトル、最重要ポイント3つ、補足の要点、（あれば）注意事項の順で、箇条書き中心に簡潔にまとめてください。元の文書にない情報は足さないでください。",
  // 🎤 プレゼン原稿は専用ハンドラが PRESENTATION_SCRIPT_PROMPT を組み立てて使う。
  // Record<AnalysisType, string> を満たすためのプレースホルダ（通常経路からは呼ばれない）。
  presentation_script:
    "次の資料をもとに、発表者がそのまま読み上げられるプレゼン原稿を作成してください。資料に書かれている内容だけを根拠にし、書かれていない数値・事実を創作しないでください。",
};

// 🎤 プレゼン原稿：1ページあたりの発表時間
const scriptLengths = [
  { label: "約30秒", value: "30s", hint: "1ページあたり150字前後" },
  { label: "約1分", value: "1m", hint: "1ページあたり300字前後" },
  { label: "約2分", value: "2m", hint: "1ページあたり600字前後" },
  { label: "約3分", value: "3m", hint: "1ページあたり900字前後" },
];

// 🎤 プレゼン原稿：想定聴衆（口調・語彙・訴求軸が変わる）
const scriptAudiences = [
  {
    value: "staff",
    label: "院内スタッフ",
    desc: "朝礼・勉強会。実務目線で、聞いた人の明日の行動が変わる言い方にする。専門用語は使ってよい。",
  },
  {
    value: "patient",
    label: "患者・一般",
    desc: "説明会。専門用語を避け、不安を煽らず安心感を優先。平易な言い換えを添える。",
  },
  {
    value: "academic",
    label: "学会・同業者",
    desc: "根拠・方法・結果を簡潔に。前置きを削り、示唆と限界に触れる。",
  },
  {
    value: "partner",
    label: "取引先・業者",
    desc: "BtoB。数値・導入効果・意思決定者の関心（コスト/工数/リスク）に寄せる。",
  },
  {
    value: "consumer",
    label: "一般消費者",
    desc: "BtoCマーケティング。製品の良さと必要性が伝わり、聞いた人がそのまま他人に話せる言い方にする。",
  },
];

// 🎤 プレゼン原稿のプロンプト雛形。{pageList} {audienceLabel} {audienceDesc}
// {lengthLabel} {lengthHint} をチャンクごとに差し替えて使う。
const PRESENTATION_SCRIPT_PROMPT = `あなたは資料をもとにプレゼン発表原稿を作る専門家です。
添付は資料の {pageList} です。対象ページすべてについて、発表者がそのまま読み上げられる原稿を作成してください。

【聴衆】{audienceLabel}
{audienceDesc}

【1ページあたりの長さ】{lengthLabel}（{lengthHint}。目安であり多少の増減は可）

【出力形式】対象ページを1ページも飛ばさず、必ず次の形式で出力する：
## P{ページ番号}
（発表原稿の本文。話し言葉・敬体。読み上げ前提で改行は最小限にする）
> 🗣 話し方のポイント：（1行。強調する箇所・間の取り方・図の指し示し方など）

【原稿の作り方】
- そのページに書かれている内容だけを根拠にする。書かれていない数値・事実・固有名詞を創作しない。
- 図表・グラフ・写真があるページでは「こちらの図をご覧ください」のように視線を誘導し、その図が示す要点を言葉で説明する。
- 冒頭で前ページからのつながりを1文で受け、末尾に次ページへの橋渡しを1文入れる（最初と最後のページは適宜省く）。
- 箇条書きを棒読みしない。要点を意味のまとまりで語り直す。
- 製品・サービス・取り組みを扱うページでは「なぜ必要か（相手が抱える課題）→ どう解決するか → 相手にとっての得」の順で語り、聞いた人がそのまま他人に説明できる短い一言を1つ含める。
- 医療に関する内容では、効果を断定する表現・最上級表現・ビフォーアフターの断定を避け、必要に応じて個人差がある旨を添える。
- 「以下が原稿です」等の前置き・解説・まとめは書かない。指定の形式のみを出力する。`;

// 分析タイプ一覧（ANALYSIS_GROUPS）に載せないタイプの表示ラベル。
// 保存カードのバッジ・結果パネル見出しはここを参照する。
const EXTRA_TYPE_LABELS: Record<string, string> = {
  presentation_script: "プレゼン原稿",
};

// 読み手レベル（フェーズ2）。「指定なし」以外が選ばれているときのみ、対象タイプの
// プロンプト先頭へ読み手指示を前置注入する。localStorageは新規キーを使用（既存キー非流用）。
const READER_LEVEL_KEY = "dermapdf_reader_level";
// 前置注入の対象＝フェーズ1で追加した「わかりやすく」「プレゼン」9タイプのみ。
// 書き起こし等のmechanical系・校正には適用しない。
const READER_LEVEL_TYPES: Set<AnalysisType> = new Set<AnalysisType>([
  "yasashii_summary",
  "structured_summary",
  "prep_summary",
  "easy_rewrite",
  "glossary",
  "qa_anticipated",
  "key_messages",
  "slide_outline",
  "handout_a4",
]);
const READER_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "指定なし" },
  { value: "patient", label: "患者向け" },
  { value: "staff", label: "スタッフ向け" },
  { value: "director", label: "院長向け" },
];
const READER_LEVEL_INSTRUCTIONS: Record<string, string> = {
  patient:
    "読み手は当院に来院する患者さんです。専門用語は避け、安心感のある丁寧でやさしい表現にしてください。",
  staff:
    "読み手は当院のスタッフです。業務で使える正確さを保ちつつ、簡潔で実務的な表現にしてください。",
  director:
    "読み手は院長本人です。要点と判断材料を密度高くまとめ、専門用語はそのままで構いません。",
};

interface GeminiPanelProps {
  fileBase64?: string;
  fileMime?: string;
  fileName?: string;
  inputMode?: "file" | "text";
  inputText?: string;
  onResult?: (result: string) => void;
  clinicSettings?: ClinicSettings;
  // PDFに統合せず画像群を直接AIへ渡す経路（「画像のままAI分析」）。
  // セットされている場合、ファイル/PDFより優先してこの画像群を分析する。
  imageParts?: { base64: string; mime: string }[];
  // 「✅ 選択した資料を書き起こす」用の絞り込み対象。
  // selectedPdfPages: 解析時に使う（統合後の）PDF上の1始まりページ番号（昇順）。
  // selectedImageParts: imageParts のうち、いま選択中の画像だけを表示順で並べたもの。
  // どちらも未指定・空なら「選択なし」＝新ボタンは disabled（⚡の全体書き起こしは従来どおり）。
  selectedPdfPages?: number[];
  selectedImageParts?: { base64: string; mime: string }[];
  // 解析（実行）直前に呼び出し、最新のファイル構成で統合PDF等を解決して返す。
  // 複数PDFの遅延統合に使用：削除のたびに統合せず、解析時に一度だけ統合する。
  // 返り値があればその base64/mime を props より優先して解析に使う。
  onEnsureFileData?: () => Promise<{ base64: string; mime: string; name: string } | null>;
}

// TARGET_OPTIONS, LEVEL_OPTIONS, PURPOSE_OPTIONS, TONE_OPTIONS, getTechniqueFlags
// are imported from @/lib/genspark-prompt-generator

export function GeminiPanel({
  fileBase64,
  fileMime,
  fileName,
  inputMode = "file",
  inputText,
  onResult,
  clinicSettings,
  imageParts,
  selectedPdfPages,
  selectedImageParts,
  onEnsureFileData,
}: GeminiPanelProps) {
  // 理念コンテキストを構築
  const philosophyContext = clinicSettings ? buildPhilosophyContext(clinicSettings) : "";
  // 分析タイプは複数選択（Set）。デフォルトで「概要・要約」のみ選択
  const [selectedTypes, setSelectedTypes] = useState<Set<AnalysisType>>(
    () => new Set<AnalysisType>()
  );
  // 専門グループ（基本分析以外）の表示トグルと、チップアコーディオンの開閉
  const [showSpecializedGroups, setShowSpecializedGroups] = useState(false);
  const [openChip, setOpenChip] = useState<string | null>(null);
  // 表示中の結果に対応する分析タイプ（DL ファイル名・ストック保存ラベルで使用）
  const [lastResultType, setLastResultType] = useState<AnalysisType>("summary");
  const [purpose, setPurpose] = useState("");
  // 読み手レベル（""=指定なし／patient／staff／director）。マウント後にlocalStorageから復元。
  const [readerLevel, setReaderLevel] = useState<string>("");
  // 出力文字数の目安。"" は指定なし、"custom" でカスタム入力欄が出る
  const [targetLength, setTargetLength] = useState<string>("");
  const [customLength, setCustomLength] = useState<string>("500");
  // 旧UI互換用: 最後に成功した結果を保持（Gensparkプロンプト生成の入力に使用）
  const [result, setResult] = useState("");
  // 複数結果を分析タイプ別に保持
  const [results, setResults] = useState<Map<AnalysisType, string>>(
    () => new Map()
  );
  // 各分析タイプの個別出力文字数指定（""=指定なし）
  const [typeLengths, setTypeLengths] = useState<Record<string, string>>({});
  // 「わかりやすく変換」処理中の分析タイプ
  const [simplifying, setSimplifying] = useState<AnalysisType | null>(null);
  // 書き起こし→詳細にまとめる のチェイン処理中フラグ
  const [summarizing, setSummarizing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState("");
  // 全文書き起こしオプション（既定: 手書きメモ含めない／空欄補足／著作権表記含めない）
  const [excludeHandwriting, setExcludeHandwriting] = useState(true); // true=手書きメモを含めない
  const [fillBlanks, setFillBlanks] = useState(true); // true=空欄を同ページ回答で補足
  const [excludeCopyright, setExcludeCopyright] = useState(true); // true=著作権表記を含めない

  const setTypeLength = (type: AnalysisType, value: string) => {
    setTypeLengths((prev) => ({ ...prev, [type]: value }));
  };

  const toggleType = (type: AnalysisType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // 基本分析ボタンの表示順（DnD並べ替え）。初期は既定順、マウント後にlocalStorageから復元。
  const [basicOrder, setBasicOrder] = useState<AnalysisType[]>(() => [
    ...BASIC_OPTION_VALUES,
  ]);
  // ドラッグ中の基本分析ボタンのインデックス（null=ドラッグなし）
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setBasicOrder(loadBasicOrder());
  }, []);

  // 読み手レベルをlocalStorageから復元（保存済みの妥当な値のみ採用）。
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(READER_LEVEL_KEY);
      if (saved && READER_LEVEL_INSTRUCTIONS[saved]) setReaderLevel(saved);
    } catch {
      /* localStorage不可でも既定（指定なし）で動作 */
    }
  }, []);

  // 読み手レベル選択を即localStorageへ保存（再読込後も維持）。
  const updateReaderLevel = (value: string) => {
    setReaderLevel(value);
    try {
      window.localStorage.setItem(READER_LEVEL_KEY, value);
    } catch {
      /* 保存不可でも当該セッションでは反映される */
    }
  };

  // 基本分析の options を保存順に並べ替え（未登録は末尾・欠落は無視）。表示順のみ。
  const orderBasicOptions = (options: AnalysisOption[]): AnalysisOption[] => {
    const byValue = new Map(options.map((o) => [o.value, o]));
    const ordered = basicOrder
      .map((v) => byValue.get(v))
      .filter((o): o is AnalysisOption => !!o);
    const extras = options.filter((o) => !basicOrder.includes(o.value));
    return [...ordered, ...extras];
  };

  // 基本分析ボタンを from → to へ移動し、新しい順序をlocalStorageへ保存。
  const moveBasic = (from: number, to: number) => {
    if (from === to) return;
    const current = orderBasicOptions(ANALYSIS_GROUPS[0].options).map(
      (o) => o.value
    );
    if (from < 0 || from >= current.length || to < 0 || to >= current.length)
      return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBasicOrder(next);
    try {
      window.localStorage.setItem(BASIC_ORDER_KEY, JSON.stringify(next));
    } catch {
      /* localStorage不可でも表示順は維持 */
    }
  };

  const getLabel = (type: AnalysisType): string =>
    ANALYSIS_GROUPS.flatMap((g) => g.options).find((o) => o.value === type)
      ?.label ??
    EXTRA_TYPE_LABELS[type] ??
    type;

  // グループ内の分析タイプ一覧（チェックボックス・個別文字数・Genspark設定）を描画。
  // 基本分析・専門グループ（チップ展開時）の両方で再利用する。
  // group: 描画するグループ。reorderable: 基本分析のみ true（DnD並べ替え・順序保存対象）。
  const renderGroupOptions = (group: AnalysisGroup, reorderable = false) => {
    const options = reorderable
      ? orderBasicOptions(group.options)
      : group.options;
    const selectedOpts = options.filter((o) => selectedTypes.has(o.value));
    return (
      <div className="px-3 py-2 space-y-3">
        {/* 分析タイプ＝短い横並びボタン（少し大きめ・狭い画面だけ折り返し）。
            選択中はソフトブルー塗り＋チェック＋太字、未選択は枠線／中立色。複数選択トグル。 */}
        <div className="flex flex-wrap gap-2">
          {options.map((opt, idx) => {
            const checked = selectedTypes.has(opt.value);
            return (
              <div
                key={opt.value}
                onDragOver={
                  reorderable
                    ? (e) => {
                        if (dragIndex !== null) e.preventDefault();
                      }
                    : undefined
                }
                onDrop={
                  reorderable
                    ? (e) => {
                        e.preventDefault();
                        if (dragIndex !== null) moveBasic(dragIndex, idx);
                        setDragIndex(null);
                      }
                    : undefined
                }
                className={`inline-flex ${
                  reorderable && dragIndex === idx ? "opacity-40" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleType(opt.value)}
                  aria-pressed={checked}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-left transition-colors ${
                    checked
                      ? "border-[#378ADD] bg-[#E6F1FB] text-[#185FA5] font-semibold"
                      : "border-gray-200 bg-white text-gray-600 hover:border-[#B5D4F4] hover:bg-[#F0F7FF] hover:text-[#185FA5]"
                  }`}
                >
                  {/* ドラッグハンドル（基本分析のみ）。ここからのドラッグ＝並べ替え。
                      クリックはトグルへ伝播させない＝短い操作は確実にトグル。 */}
                  {reorderable && (
                    <span
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(idx);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
                      title="ドラッグで並べ替え"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                  )}
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-[#378ADD] bg-[#378ADD] text-white"
                        : "border-gray-300 bg-white"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span>{opt.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* 選択中タイプの文字数指定・Genspark設定（ボタン行の下／横並びを崩さない）。
            ここはボタンの外側なので操作してもトグルは反応しない（誤操作防止）。 */}
        {selectedOpts.map((opt) => {
          const isGsSlide = opt.value === "genspark_slide";
          return (
            <div
              key={opt.value}
              className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#185FA5]">
                  {opt.label}
                </span>
                <select
                  value={typeLengths[opt.value] || ""}
                  onChange={(e) => setTypeLength(opt.value, e.target.value)}
                  className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-500"
                  title="この分析タイプの出力文字数"
                >
                  <option value="">文字数指定なし</option>
                  {opt.value === "detail_summary" ? (
                    <>
                      <option value="3000">3000字</option>
                      <option value="5000">5000字</option>
                      <option value="8000">8000字</option>
                      <option value="12000">12000字</option>
                    </>
                  ) : (
                    <>
                      <option value="200">200字</option>
                      <option value="400">400字</option>
                      <option value="600">600字</option>
                      <option value="1000">1000字</option>
                      <option value="2000">2000字</option>
                      <option value="3000">3000字</option>
                    </>
                  )}
                </select>
              </div>

              {/* Gensparkスライド用まとめ選択時のみ、設定アコーディオンを展開 */}
              {isGsSlide && (
              <div className="mt-1 p-3 rounded-xl border border-[#B5D4F4] bg-[#F0F7FF] space-y-3">
                <p className="text-xs font-semibold text-[#185FA5]">
                  🎯 Gensparkプレゼン設定
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      聴講ターゲット
                    </label>
                    <select
                      value={gsTarget}
                      onChange={(e) => setGsTarget(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-[#B5D4F4] focus:outline-none"
                    >
                      {TARGET_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      内容レベル
                    </label>
                    <select
                      value={gsLevel}
                      onChange={(e) => setGsLevel(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-[#B5D4F4] focus:outline-none"
                    >
                      {LEVEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      プレゼンの目的
                    </label>
                    <select
                      value={gsPurpose}
                      onChange={(e) => setGsPurpose(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-[#B5D4F4] focus:outline-none"
                    >
                      {PURPOSE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      スライドのトーン
                    </label>
                    <select
                      value={gsTone}
                      onChange={(e) => setGsTone(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-[#B5D4F4] focus:outline-none"
                    >
                      {TONE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    追加要望（任意）
                  </label>
                  <textarea
                    value={gsNotes}
                    onChange={(e) => setGsNotes(e.target.value)}
                    placeholder="スライドへの追加要望..."
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-[#B5D4F4] focus:outline-none resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    );
  };

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

    // テンプレート適用イベント（旧形式 analysisType と新形式 selectedTypes 両対応）
    const handleApplyGemini = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (Array.isArray(detail.selectedTypes) && detail.selectedTypes.length > 0) {
        setSelectedTypes(new Set(detail.selectedTypes as AnalysisType[]));
      } else if (detail.analysisType) {
        setSelectedTypes(new Set([detail.analysisType as AnalysisType]));
      }
      if (detail.analysisPurpose !== undefined) setPurpose(detail.analysisPurpose);
      if (detail.targetLength !== undefined) setTargetLength(detail.targetLength);
      if (detail.customLength !== undefined) setCustomLength(detail.customLength);
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
    const types = Array.from(selectedTypes);
    saveTemplate({
      name,
      // 後方互換: 旧形式 analysisType には先頭の選択を保存
      analysisType: types[0] ?? "summary",
      selectedTypes: types,
      analysisPurpose: purpose,
      targetLength,
      customLength,
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
    const types = Array.from(selectedTypes);
    saveTemplate({
      name,
      analysisType: types[0] ?? "summary",
      selectedTypes: types,
      analysisPurpose: purpose,
      targetLength,
      customLength,
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
    // 新形式 selectedTypes を優先、無ければ旧形式 analysisType を1件として読み込む
    if (t.selectedTypes && t.selectedTypes.length > 0) {
      setSelectedTypes(new Set(t.selectedTypes as AnalysisType[]));
    } else if (t.analysisType) {
      setSelectedTypes(new Set([t.analysisType as AnalysisType]));
    }
    setPurpose(t.analysisPurpose);
    if (t.targetLength !== undefined) setTargetLength(t.targetLength);
    if (t.customLength !== undefined) setCustomLength(t.customLength);
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

  const CHUNK_SIZE = 3;

  const isTextMode = inputMode === "text";

  // 単一の分析タイプを実行して結果テキストを返す内部ヘルパー
  // progressPrefix: 複数同時実行時のヘッダー（例: "(2/3) 詳細にまとめる"）
  // lengthOverride: 個別文字数指定（あればグローバルの targetLength より優先）
  const analyzeOne = async (
    type: AnalysisType,
    progressPrefix: string,
    lengthOverride?: string,
    // 遅延統合: 解析直前に親が解決した最新の統合PDF等。あれば props/state より優先。
    fileOverride?: { base64: string; mime: string; pageCount: number },
    // 「選択した資料を書き起こす」用の対象絞り込み。未指定なら従来どおり全体が対象。
    selection?: {
      pdfPages?: number[];
      imageParts?: { base64: string; mime: string }[];
    }
  ): Promise<string> => {
    // 個別指定 > グローバル指定 の優先順
    const globalLength =
      targetLength === "custom" ? customLength : targetLength;
    const effectiveLength = lengthOverride || globalLength;
    const lengthInstruction = effectiveLength
      ? `\n\n【出力文字数の目安】約${effectiveLength}文字程度でまとめてください。`
      : "";
    // 選択文字数（特に詳細まとめの〜12000字）で出力が途中で切れないよう、
    // 目安文字数に応じて出力トークン枠を引き上げる（書き起こしは既定65536を維持）。
    const outputTokenOverride =
      type !== "transcription" && effectiveLength
        ? Math.min(65536, Math.max(8192, Math.ceil(Number(effectiveLength) * 2.2)))
        : undefined;

    // 「目的・Geminiへの指示」欄の入力を、選んだ全分析タイプへ追加指示として注入する。
    // trim後に空なら注入しない（従来どおりの挙動を維持）。
    const trimmedPurpose = purpose.trim();
    const purposeInstruction = trimmedPurpose
      ? `\n\n【ユーザーからの追加指示】\n${trimmedPurpose}\n\n上記の追加指示にも必ず従って、分析・作業を行ってください。`
      : "";

    // 読み手レベル（フェーズ2）。「指定なし」以外かつ対象9タイプのときのみ、プロンプト先頭に
    // 読み手指示を1行前置する。既定（指定なし）・対象外タイプでは空＝従来挙動を一切変えない。
    const readerLevelInstruction =
      readerLevel &&
      READER_LEVEL_TYPES.has(type) &&
      READER_LEVEL_INSTRUCTIONS[readerLevel]
        ? READER_LEVEL_INSTRUCTIONS[readerLevel] + "\n\n"
        : "";

    // 全文書き起こしオプション（手書きメモ除外／空欄補足）をプロンプトへ条件付き追記。
    // 既定の組み合わせ（含める／そのまま）なら何も追記しない＝現行どおり。
    let transcriptionOptionInstruction = "";
    if (type === "transcription") {
      const opt: string[] = [];
      // レイアウト整形（内容は忠実、レイアウトのみ整える）— 書き起こしには常時付与
      opt.push(
        "読みやすさのため、次のレイアウトで書き起こしてください（内容は改変せず、元のテキストに忠実に。レイアウトのみ整える）：\n" +
          "- 番号付き項目（1, 2, 3… ／ ①②③ ／ □付きの項目）は、項目ごとに必ず改行し、Markdownの番号付きリストまたは箇条書きにする。複数項目を1段落に連結しない。\n" +
          "- 見出し・セクション名は Markdown の見出し（##／###）にする。\n" +
          "- 段落・リスト・見出しの間は空行で区切る。\n" +
          "- 表は Markdown のテーブルにする。\n" +
          "- 本文の文言・数値・順序は変更しない（要約・省略・言い換えをしない）。"
      );
      if (excludeHandwriting) {
        opt.push(
          "印刷された本文のみを書き起こしてください。手書きの書き込み・注釈・余白のメモは出力に含めないでください。"
        );
      }
      if (fillBlanks) {
        opt.push(
          "下線・括弧などの記入欄（空欄）は、同じページ内に記入された回答内容を参照して補ってください。\n該当する回答が見当たらない場合は ____ のまま残してください。"
        );
      }
      if (excludeHandwriting && fillBlanks) {
        opt.push(
          "ただし、記入欄に書かれた回答は「手書きメモ」ではなく回答として扱い、補足対象に含めてください。\n除外するのは、余白の補足的な書き込み・感想・矢印などのメモのみです。"
        );
      }
      if (excludeCopyright) {
        opt.push(
          "各ページのフッター等にある著作権表記は書き起こしに含めないでください。\n（例：「Copyright 2021 Achievement Corp. All Rights Reserved.」「無断転載複製禁止」、ページ番号付きのコピーライト行など。会社名・年号が異なる場合も同様に除外する。）"
        );
      }
      if (opt.length > 0)
        transcriptionOptionInstruction = "\n\n" + opt.join("\n\n");
    }

    // テキスト入力モード
    if (isTextMode && inputText) {
      setTranscriptionProgress(`${progressPrefix} 分析中...`);
      const basePrompt = ANALYSIS_PROMPTS[type];
      const fullPrompt =
        readerLevelInstruction +
        basePrompt + purposeInstruction + transcriptionOptionInstruction +
        lengthInstruction +
        philosophyContext;
      const data = await analyzeTextWithGemini(
        fullPrompt,
        inputText,
        outputTokenOverride
      );
      if (!data.success) throw new Error(data.error || "分析に失敗しました");
      return data.analysis;
    }

    // 画像のままAI分析（PDF統合を経由せず、画像群を inline_data で直接送信）。
    // プロンプト・分析タイプ・チャンク方針・進捗は既存PDF経路を踏襲し、入力だけ差し替える。
    if (imageParts && imageParts.length > 0) {
      const basePrompt = ANALYSIS_PROMPTS[type];
      // 選択指定があれば選択画像のみ（表示順）。無ければ従来どおり全画像。
      const effImageParts =
        selection?.imageParts && selection.imageParts.length > 0
          ? selection.imageParts
          : imageParts;

      // 全文書き起こし: 既存PDF版と同様に CHUNK_SIZE 枚ずつ分割し順次送信して結合。
      if (type === "transcription") {
        const total = effImageParts.length;
        const totalChunks = Math.ceil(total / CHUNK_SIZE);
        let fullText = "";
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, total);
          const chunk = effImageParts.slice(start, end);

          setTranscriptionProgress(
            `${progressPrefix} 書き起こし中... (${i + 1}/${totalChunks}チャンク / ${start + 1}〜${end}枚目)`
          );

          const chunkPrompt =
            `${start + 1}〜${end}枚目の画像の全テキストを書き起こしてください。\n` +
            `【出力ルール】\n` +
            `・各画像の冒頭に「--- ${start + 1}枚目 ---」のように番号を入れる\n` +
            `・図・表・手書き文字も含め全て書き起こす\n` +
            `・一切省略せず完全に出力する` +
            lengthInstruction +
            transcriptionOptionInstruction +
            purposeInstruction;

          // チャンク失敗（タイムアウト等）時は1回だけ自動リトライ（既存PDF版と同様）。
          let chunkResult = await analyzeImagesWithGemini(
            chunk,
            chunkPrompt,
            "transcription"
          );
          if (!chunkResult.success) {
            setTranscriptionProgress(
              `${progressPrefix} 再試行中... (${i + 1}/${totalChunks}チャンク / ${start + 1}〜${end}枚目)`
            );
            chunkResult = await analyzeImagesWithGemini(
              chunk,
              chunkPrompt,
              "transcription"
            );
          }
          if (!chunkResult.success) {
            throw new Error(
              `${start + 1}〜${end}枚目の処理に失敗: ${chunkResult.error}`
            );
          }

          fullText += `\n\n${chunkResult.analysis}`;

          // チャンク完了ごとに累積文字数を進捗に反映
          setTranscriptionProgress(
            `${progressPrefix} 書き起こし中... (${i + 1}/${totalChunks}チャンク完了・累計${fullText.trim().length.toLocaleString()}文字)`
          );

          // チャンク間ウェイト（API rate limit対策）
          if (i < totalChunks - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        return fullText.trim();
      }

      // 要約系など: 全画像を1リクエストで渡す（現PDF版が全ページ1回で要約するのと同じ挙動）。
      setTranscriptionProgress(`${progressPrefix} 分析中...`);
      const fullPrompt =
        readerLevelInstruction +
        basePrompt +
        purposeInstruction +
        transcriptionOptionInstruction +
        lengthInstruction +
        philosophyContext;
      const data = await analyzeImagesWithGemini(
        effImageParts,
        fullPrompt,
        type,
        outputTokenOverride
      );
      if (!data.success) throw new Error(data.error || "分析に失敗しました");
      return data.analysis;
    }

    // 以下ファイルモード
    // override があればそれ（最新の統合PDF）を、無ければ従来どおり props/state を使う。
    const effFileBase64 = fileOverride?.base64 ?? fileBase64;
    const effFileMime = fileOverride?.mime ?? fileMime;
    const effIsPdf = effFileMime === "application/pdf";
    const effPageCount = fileOverride ? fileOverride.pageCount : pageCount;
    const isTranscription = type === "transcription";
    const effectivePageCount = effIsPdf && effPageCount !== null ? effPageCount : 0;
    const useBatch = isTranscription && effIsPdf && effectivePageCount > CHUNK_SIZE;

    // 選択ページのみの書き起こし。ページ抽出以外（チャンク分割 CHUNK_SIZE・サーバ経由・
    // リトライ・進捗表示・全パート連結）は既存の全ページ版とまったく同じ。
    const selPages = selection?.pdfPages;
    if (isTranscription && effIsPdf && selPages && selPages.length > 0) {
      const totalChunks = Math.ceil(selPages.length / CHUNK_SIZE);
      let fullText = "";

      for (let i = 0; i < totalChunks; i++) {
        const chunkPages = selPages.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const pageLabel = chunkPages.map((p) => `P.${p}`).join(", ");

        setTranscriptionProgress(
          `${progressPrefix} 書き起こし中... (${i + 1}/${totalChunks}チャンク / ${pageLabel})`
        );

        const chunkBase64 = await extractPdfPages(
          effFileBase64!,
          chunkPages.map((p) => p - 1)
        );
        const chunkPrompt =
          `${pageLabel} の全テキストを書き起こしてください。\n` +
          `【出力ルール】\n` +
          `・各ページの冒頭に「--- ${pageLabel.split(", ")[0]} ---」のようにページ番号を入れる（順に ${pageLabel}）\n` +
          `・図・表・手書き文字も含め全て書き起こす\n` +
          `・一切省略せず完全に出力する` +
          lengthInstruction +
          transcriptionOptionInstruction +
          purposeInstruction;

        // チャンク失敗（タイムアウト等）時は1回だけ自動リトライ（既存の全ページ版と同様）
        let chunkResult = await analyzeWithGemini(
          chunkBase64,
          "application/pdf",
          chunkPrompt,
          "transcription"
        );
        if (!chunkResult.success) {
          setTranscriptionProgress(
            `${progressPrefix} 再試行中... (${i + 1}/${totalChunks}チャンク / ${pageLabel})`
          );
          chunkResult = await analyzeWithGemini(
            chunkBase64,
            "application/pdf",
            chunkPrompt,
            "transcription"
          );
        }

        if (!chunkResult.success) {
          throw new Error(`${pageLabel} の処理に失敗: ${chunkResult.error}`);
        }

        fullText += `\n\n${chunkResult.analysis}`;

        setTranscriptionProgress(
          `${progressPrefix} 書き起こし中... (${i + 1}/${totalChunks}チャンク完了・累計${fullText.trim().length.toLocaleString()}文字)`
        );

        // チャンク間ウェイト（API rate limit対策）
        if (i < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      return fullText.trim();
    }

    if (isTranscription && effIsPdf && effectivePageCount <= 0) {
      // ページ数取得失敗 → 通常処理にフォールバック
      console.warn("ページ数取得失敗、通常処理で実行します");
      setTranscriptionProgress(`${progressPrefix} 分析中...`);
      const basePrompt = ANALYSIS_PROMPTS[type];
      const fullPrompt =
        basePrompt + purposeInstruction + transcriptionOptionInstruction +
        lengthInstruction +
        philosophyContext;
      const data = await analyzeWithGemini(
        effFileBase64!,
        effFileMime!,
        fullPrompt,
        "transcription"
      );
      if (!data.success) throw new Error(data.error || "分析に失敗しました");
      return data.analysis;
    }

    if (useBatch) {
      const totalPages = effectivePageCount;
      const totalChunks = Math.ceil(totalPages / CHUNK_SIZE);
      let fullText = "";

      for (let i = 0; i < totalChunks; i++) {
        const startPage = i * CHUNK_SIZE;
        const endPage = Math.min(startPage + CHUNK_SIZE - 1, totalPages - 1);

        setTranscriptionProgress(
          `${progressPrefix} 書き起こし中... (${i + 1}/${totalChunks}チャンク / P.${startPage + 1}〜${endPage + 1})`
        );

        const chunkBase64 = await splitPdfPages(effFileBase64!, startPage, endPage);
        const chunkPrompt =
          `P.${startPage + 1}〜P.${endPage + 1} の全テキストを書き起こしてください。\n` +
          `【出力ルール】\n` +
          `・各ページの冒頭に「--- P.${startPage + 1} ---」のようにページ番号を入れる\n` +
          `・図・表・手書き文字も含め全て書き起こす\n` +
          `・一切省略せず完全に出力する` +
          lengthInstruction +
          transcriptionOptionInstruction +
          purposeInstruction;

        // A-7: チャンク失敗（タイムアウト等）時は1回だけ自動リトライ
        let chunkResult = await analyzeWithGemini(
          chunkBase64,
          "application/pdf",
          chunkPrompt,
          "transcription"
        );
        if (!chunkResult.success) {
          setTranscriptionProgress(
            `${progressPrefix} 再試行中... (${i + 1}/${totalChunks}チャンク / P.${startPage + 1}〜${endPage + 1})`
          );
          chunkResult = await analyzeWithGemini(
            chunkBase64,
            "application/pdf",
            chunkPrompt,
            "transcription"
          );
        }

        if (!chunkResult.success) {
          throw new Error(
            `P.${startPage + 1}〜${endPage + 1} の処理に失敗: ${chunkResult.error}`
          );
        }

        fullText += `\n\n${chunkResult.analysis}`;

        // チャンク完了ごとに累積文字数を進捗に反映
        setTranscriptionProgress(
          `${progressPrefix} 書き起こし中... (${i + 1}/${totalChunks}チャンク完了・累計${fullText.trim().length.toLocaleString()}文字)`
        );

        // チャンク間ウェイト（API rate limit対策）
        if (i < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      return fullText.trim();
    }

    // 通常の分析（画像、CHUNK_SIZE以下のPDF、transcription以外）
    setTranscriptionProgress(`${progressPrefix} 分析中...`);
    const basePrompt = ANALYSIS_PROMPTS[type];
    const fullPrompt =
      readerLevelInstruction +
      basePrompt + purposeInstruction + transcriptionOptionInstruction +
      lengthInstruction +
      philosophyContext;
    const data = await analyzeWithGemini(
      effFileBase64!,
      effFileMime!,
      fullPrompt,
      type,
      outputTokenOverride
    );
    if (!data.success) throw new Error(data.error || "分析に失敗しました");
    return data.analysis;
  };

  // typesOverride: 実行する分析タイプの明示指定（ワンクリック全文書き起こし用）。
  // 省略時は従来どおり selectedTypes（チェック状態）を実行する。
  // selectionOnly: 「選択した資料を書き起こす」用。選択中のページ/画像だけを対象にする。
  const handleAnalyze = async (
    typesOverride?: AnalysisType[],
    options?: { selectionOnly?: boolean }
  ) => {
    const types = typesOverride ?? Array.from(selectedTypes);
    if (types.length === 0) {
      toastError("分析タイプを1つ以上選択してください");
      return;
    }

    // ファイルモードのとき、解析直前に最新の構成で統合PDF等を解決（遅延統合）。
    // 複数PDFはここで初めて一度だけ統合される（削除のたびには統合しない）。
    let fileOverride:
      | { base64: string; mime: string; pageCount: number }
      | undefined;

    // テキストモード: テキストが必要
    if (isTextMode) {
      if (!inputText || inputText.trim().length === 0) {
        toastError("テキストが入力されていません");
        return;
      }
    } else if (imageParts && imageParts.length > 0) {
      // 画像のままAI分析: 画像群があればOK（ファイル/PDF不要）
    } else {
      // ファイルモード: 解析直前に親へ最新ファイルデータを要求（遅延統合）
      let resolved:
        | { base64: string; mime: string; name: string }
        | null = null;
      if (onEnsureFileData) {
        try {
          resolved = await onEnsureFileData();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "ファイルの統合に失敗しました";
          toastError(`ファイルの統合に失敗しました: ${msg}`);
          return;
        }
      }
      if (resolved) {
        // 統合PDF（または最新ファイル）でページ数を確定し、解析に使う。
        const resolvedPageCount =
          resolved.mime === "application/pdf"
            ? await getPdfPageCount(resolved.base64)
            : 0;
        fileOverride = {
          base64: resolved.base64,
          mime: resolved.mime,
          pageCount: resolvedPageCount,
        };
      } else if (!fileBase64 || !fileMime || !fileName) {
        // 解決できず props も無ければファイル未選択
        toastError("ファイルが選択されていません");
        return;
      }
    }

    // 選択実行のときだけ、対象を選択中のページ/画像に絞る（未指定＝従来どおり全体）。
    // PDFと画像が両方ある場合の優先順位は⚡と同じ（画像群があればそちらを優先）。
    const selection = options?.selectionOnly
      ? {
          pdfPages: selectedPdfPages,
          imageParts: selectedImageParts,
        }
      : undefined;

    setLoading(true);
    setResult("");
    setResults(new Map());
    setTranscriptionProgress("");

    let lastResult = "";
    let lastType: AnalysisType = types[0];
    let successCount = 0;

    try {
      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        const prefix =
          types.length > 1
            ? `(${i + 1}/${types.length}) ${getLabel(type)}:`
            : "";

        try {
          // 個別文字数指定（無ければ analyzeOne 内でグローバル設定にフォールバック）
          const lengthForType = typeLengths[type] || "";
          const analysis = await analyzeOne(
            type,
            prefix,
            lengthForType,
            fileOverride,
            selection
          );
          lastResult = analysis;
          lastType = type;
          successCount += 1;

          // results Map に追加（左右並列表示用）
          setResults((prev) => {
            const next = new Map(prev);
            next.set(type, analysis);
            return next;
          });

          // 複数選択時は各結果を自動でストックに保存（別カードとして残す）
          if (types.length > 1) {
            // タイトル自動生成（失敗時はフォールバックで握りつぶす）
            const autoTitle = await generateTitleWithTimeout(
              analysis,
              getLabel(type),
              buildFallbackTitle(type)
            ).catch(() => buildFallbackTitle(type));
            saveAnalysis({
              fileName: autoTitle,
              analysisType: type,
              analysisLabel: getLabel(type),
              content: analysis,
              tags: [],
              folder: "",
            });
          }
        } catch (innerErr) {
          const msg =
            innerErr instanceof Error ? innerErr.message : "分析に失敗しました";
          console.error(`${getLabel(type)} の分析でエラー:`, innerErr);
          toastError(`${getLabel(type)}: ${msg}`);
          // 複数件のうち1件失敗しても続行
        }
      }

      if (lastResult) {
        setResult(lastResult);
        setLastResultType(lastType);
        onResult?.(lastResult);
      }

      if (successCount === 0) {
        // すでに toastError 済みなのでここでは追加メッセージ不要
        return;
      }

      if (types.length > 1) {
        toastOk(
          `${successCount}/${types.length} 件の分析が完了し、ストックに保存しました`
        );
      } else {
        toastOk("AI分析が完了しました");
      }
    } finally {
      setLoading(false);
      setTranscriptionProgress("");
    }
  };

  // 「⚡ 全文書き起こしを実行」ボタンの実行中フラグ（ローディング表示の出し分け用）
  const [quickTranscribing, setQuickTranscribing] = useState(false);

  // ワンクリック全文書き起こし：既存 handleAnalyze を transcription 固定で呼ぶ薄いラッパ。
  // selectedTypes（チェック状態）は変更しない独立ショートカット。
  // 文字数指定・書き起こしオプション・目的欄・入力解決（遅延統合含む）は現在の設定のまま使われる。
  const handleQuickTranscription = async () => {
    setQuickTranscribing(true);
    try {
      await handleAnalyze(["transcription"]);
    } finally {
      setQuickTranscribing(false);
    }
  };

  // 「✅ 選択した資料を書き起こす」ボタンの実行中フラグ（⚡とは別state）
  const [selectedTranscribing, setSelectedTranscribing] = useState(false);

  // 現在の選択件数（PDFページ／画像）。画像群がある場合は⚡と同じく画像を優先して数える。
  const hasImageMode = !!imageParts && imageParts.length > 0;
  const selectedImageCount = selectedImageParts?.length ?? 0;
  const selectedPageCount = selectedPdfPages?.length ?? 0;
  const selectedCount = hasImageMode ? selectedImageCount : selectedPageCount;

  // 選択した資料だけを書き起こす：handleQuickTranscription と同じく transcription 固定・
  // selectedTypes 不変の独立ショートカット。対象の組み立てだけ選択集合に差し替える。
  const handleSelectedTranscription = async () => {
    if (selectedCount === 0) return;
    setSelectedTranscribing(true);
    try {
      await handleAnalyze(["transcription"], { selectionOnly: true });
    } finally {
      setSelectedTranscribing(false);
    }
  };

  // ── 🎤 プレゼン原稿 ────────────────────────────────────────────────
  // 「選択した資料を書き起こす」経路を雛形にした独立ショートカット。
  // チャンク分割（CHUNK_SIZE）・サーバ経由・リトライ・進捗表示は書き起こしと同一で、
  // 差分はプロンプト（PRESENTATION_SCRIPT_PROMPT）と出力の組み立てのみ。
  const [scriptLength, setScriptLength] = useState("1m");
  const [scriptAudience, setScriptAudience] = useState("staff");
  const [scriptGenerating, setScriptGenerating] = useState(false);

  // ボタンラベルに出す対象件数。選択があれば選択分、無ければ全件。
  const scriptIsAll = selectedCount === 0;
  const scriptTargetCount = hasImageMode
    ? scriptIsAll
      ? (imageParts?.length ?? 0)
      : selectedImageCount
    : scriptIsAll
      ? (pageCount ?? 0)
      : selectedPageCount;
  const scriptUnit = hasImageMode ? "枚" : "ページ";

  const handlePresentationScript = async () => {
    if (loading || scriptGenerating) return;

    const lengthOpt =
      scriptLengths.find((o) => o.value === scriptLength) ?? scriptLengths[1];
    const audienceOpt =
      scriptAudiences.find((o) => o.value === scriptAudience) ??
      scriptAudiences[0];

    // pageList だけをチャンクごとに差し替えるプロンプト組み立て
    const buildPrompt = (pageList: string) =>
      PRESENTATION_SCRIPT_PROMPT.replace("{pageList}", pageList)
        .replace("{audienceLabel}", audienceOpt.label)
        .replace("{audienceDesc}", audienceOpt.desc)
        .replace("{lengthLabel}", lengthOpt.label)
        .replace("{lengthHint}", lengthOpt.hint);

    // 対象の確定（画像群があれば⚡/✅と同じく画像を優先）
    const chunks: {
      pageList: string;
      run: (prompt: string) => Promise<{ success: boolean; analysis: string; error?: string }>;
    }[] = [];
    let docTitle = fileName ?? "資料";

    if (hasImageMode) {
      const all = imageParts ?? [];
      const targets =
        selectedImageCount > 0 && selectedImageParts
          ? selectedImageParts
          : all;
      if (targets.length === 0) {
        toastError("対象の画像がありません");
        return;
      }
      // 画像は並び順を P1, P2, … として扱う（選択時は元の並び順の番号を使う）
      const numbered = targets
        .map((part) => ({ part, no: all.indexOf(part) + 1 }))
        .map((x, i) => ({ part: x.part, no: x.no > 0 ? x.no : i + 1 }))
        .sort((a, b) => a.no - b.no);
      for (let i = 0; i < numbered.length; i += CHUNK_SIZE) {
        const group = numbered.slice(i, i + CHUNK_SIZE);
        const pageList = group.map((g) => `P${g.no}`).join("、");
        const parts = group.map((g) => g.part);
        chunks.push({
          pageList,
          run: (prompt) =>
            analyzeImagesWithGemini(parts, prompt, "presentation_script", 16384),
        });
      }
    } else {
      // ファイルモード：解析直前に最新の統合PDFを解決（遅延統合。⚡と同じ経路）
      let resolved: { base64: string; mime: string; name: string } | null = null;
      if (onEnsureFileData) {
        try {
          resolved = await onEnsureFileData();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "ファイルの統合に失敗しました";
          toastError(`ファイルの統合に失敗しました: ${msg}`);
          return;
        }
      }
      const effBase64 = resolved?.base64 ?? fileBase64;
      const effMime = resolved?.mime ?? fileMime;
      if (resolved?.name) docTitle = resolved.name;
      if (!effBase64 || !effMime) {
        toastError("ファイルが選択されていません");
        return;
      }
      if (effMime !== "application/pdf") {
        toastError("プレゼン原稿はPDFまたは画像に対応しています");
        return;
      }
      let totalPages = 0;
      try {
        totalPages = await getPdfPageCount(effBase64);
      } catch {
        totalPages = 0;
      }
      const targetPages =
        selectedPageCount > 0 && selectedPdfPages
          ? [...selectedPdfPages].sort((a, b) => a - b)
          : Array.from({ length: totalPages }, (_, i) => i + 1);
      if (targetPages.length === 0) {
        toastError("対象ページを特定できませんでした");
        return;
      }
      for (let i = 0; i < targetPages.length; i += CHUNK_SIZE) {
        const group = targetPages.slice(i, i + CHUNK_SIZE);
        const pageList = group.map((p) => `P${p}`).join("、");
        chunks.push({
          pageList,
          run: async (prompt) => {
            const chunkBase64 = await extractPdfPages(
              effBase64,
              group.map((p) => p - 1)
            );
            return analyzeWithGemini(
              chunkBase64,
              "application/pdf",
              prompt,
              "presentation_script",
              16384
            );
          },
        });
      }
    }

    setScriptGenerating(true);
    setLoading(true);
    setResult("");
    setResults(new Map());
    setTranscriptionProgress("");

    try {
      const totalChunks = chunks.length;
      let fullText = "";

      for (let i = 0; i < totalChunks; i++) {
        const { pageList, run } = chunks[i];
        setTranscriptionProgress(
          `プレゼン原稿を生成中... (${i + 1}/${totalChunks}チャンク / ${pageList})`
        );

        const prompt = buildPrompt(pageList);
        // チャンク失敗（タイムアウト等）時は1回だけ自動リトライ（書き起こしと同様）
        let chunkResult = await run(prompt);
        if (!chunkResult.success) {
          setTranscriptionProgress(
            `プレゼン原稿を再試行中... (${i + 1}/${totalChunks}チャンク / ${pageList})`
          );
          chunkResult = await run(prompt);
        }
        if (!chunkResult.success) {
          throw new Error(`${pageList} の処理に失敗: ${chunkResult.error}`);
        }

        // 各チャンクの結果を改行2つで連結
        fullText += (fullText ? "\n\n" : "") + chunkResult.analysis.trim();

        setTranscriptionProgress(
          `プレゼン原稿を生成中... (${i + 1}/${totalChunks}チャンク完了・累計${fullText.length.toLocaleString()}文字)`
        );

        // チャンク間ウェイト（API rate limit対策）
        if (i < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (!fullText) throw new Error("原稿を生成できませんでした");

      setResults(new Map([["presentation_script" as AnalysisType, fullText]]));
      setResult(fullText);
      setLastResultType("presentation_script");
      onResult?.(fullText);

      // 全チャンク連結後に1枚のカードとして保存（タイトルは元資料のまま）
      saveAnalysis({
        fileName: docTitle,
        analysisType: "presentation_script",
        analysisLabel: EXTRA_TYPE_LABELS.presentation_script,
        content: fullText,
        tags: [],
        folder: "",
      });
      toastOk("プレゼン原稿を作成し、ストックに保存しました");
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "プレゼン原稿の生成に失敗しました"
      );
    } finally {
      setLoading(false);
      setScriptGenerating(false);
      setTranscriptionProgress("");
    }
  };

  // 分析結果から短いタイトルを Gemini で自動生成
  const generateTitle = async (
    analysisText: string,
    analysisLabel: string,
    fallback: string
  ): Promise<string> => {
    try {
      const head = analysisText.slice(0, 1500);
      const prompt = `以下の分析結果を表す、短くわかりやすい日本語タイトルを1つだけ生成してください。

【条件】
- 15〜25文字程度
- 日本語
- 内容の核心を一言で表す
- 「〜の分析」「〜まとめ」などの形式でOK
- タイトルだけを出力し、説明・前置き・記号・引用符は不要

【分析タイプ】${analysisLabel}

【分析結果（先頭1500文字）】
${head}`;
      // 分析結果は prompt 内に既に埋め込み済み。
      // text 引数を渡すと analyzeTextWithGemini が「分析してください」テンプレで二重に包んでしまうため省略する。
      console.log("[generateTitle] 開始:", analysisLabel, head.slice(0, 50));
      // タイトル生成は推論不要の短出力なので thinking minimal で高速化
      const data = await analyzeTextWithGemini(prompt, undefined, undefined, true);
      console.log(
        "[generateTitle] 結果:",
        data.success,
        data.analysis?.slice(0, 50),
        data.error
      );
      if (data.success && data.analysis) {
        // 余分な記号・改行を除去してクリーンなタイトルにする
        const title = data.analysis
          .replace(/^["「『【]|["」』】]$/g, "")
          .replace(/\n/g, "")
          .trim()
          .slice(0, 50);
        console.log("[generateTitle] 生成タイトル:", title);
        return title || fallback;
      }
    } catch (e) {
      console.error("[generateTitle] 例外:", e);
    }
    console.warn("[generateTitle] フォールバック使用:", fallback);
    return fallback;
  };

  // 15秒のタイムアウト付きでタイトル生成（超過したらフォールバック）
  const generateTitleWithTimeout = async (
    text: string,
    label: string,
    fallback: string,
    timeoutMs = 15000
  ): Promise<string> => {
    return Promise.race([
      generateTitle(text, label, fallback),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve(fallback), timeoutMs)
      ),
    ]);
  };

  // フォールバックタイトル（タイトル生成失敗時）: ラベル + ファイル名
  const buildFallbackTitle = (type: AnalysisType): string => {
    const base = fileName ?? (isTextMode ? "テキスト入力" : "unknown");
    return `${getLabel(type)}_${base}`;
  };

  // 個別結果のクリップボードコピー（書式付きHTML＋プレーンの両形式）
  const copyText = async (text: string) => {
    await copyRichText(text);
    toastOk("クリップボードにコピーしました");
  };

  // 個別結果のテキスト保存（タイトルは Gemini で自動生成）
  const downloadTxt = async (type: AnalysisType, text: string) => {
    const fallback = `analysis_${type}`;
    const autoTitle = await generateTitleWithTimeout(
      text,
      getLabel(type),
      fallback
    );
    const safeTitle = autoTitle.replace(/[^\w぀-鿿]/g, "_");
    const safeLabel = getLabel(type).replace(/[^\w぀-鿿]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}_${safeLabel}_${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 個別結果をストックに保存（タイトルは Gemini で自動生成）
  const saveStock = async (type: AnalysisType, text: string) => {
    console.log("[saveStock] タイトル生成開始:", type, text.slice(0, 50));
    const autoTitle = await generateTitleWithTimeout(
      text,
      getLabel(type),
      buildFallbackTitle(type)
    );
    console.log("[saveStock] 最終タイトル:", autoTitle);
    saveAnalysis({
      fileName: autoTitle,
      analysisType: type,
      analysisLabel: getLabel(type),
      content: text,
      tags: [],
      folder: "",
    });
    toastOk(`「${autoTitle}」としてストックに保存しました`);
  };

  // 個別結果を Gemini で平易化して上書き
  const simplifyOne = async (type: AnalysisType, text: string) => {
    setSimplifying(type);
    try {
      const prompt = `以下の文章を、専門用語を使わずに誰でも理解できる平易な言葉でわかりやすく書き直してください。意味・内容は変えずに、表現だけをシンプルにしてください。\n\n${text}`;
      const data = await analyzeTextWithGemini(prompt, text);
      if (!data.success) throw new Error(data.error || "変換に失敗しました");
      setResults((prev) => {
        const next = new Map(prev);
        next.set(type, data.analysis);
        return next;
      });
      // Gensparkプロンプト生成の入力を最新版に更新
      setResult(data.analysis);
      setLastResultType(type);
      onResult?.(data.analysis);
      toastOk(`${getLabel(type)}をわかりやすく変換しました`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "変換に失敗しました";
      toastError(msg);
    } finally {
      setSimplifying(null);
    }
  };

  // 全文書き起こしの結果テキストから「詳細にまとめる」をテキストモードで実行（チェイン）。
  // 既存の detail_summary プロンプト＋テキストモード経路を再利用し、新カードとして追加表示する。
  const summarizeFromText = async (
    sourceText: string,
    length: string
  ): Promise<boolean> => {
    if (summarizing) return false;
    setSummarizing(true);
    try {
      const lengthInstr = length
        ? `\n\n【出力文字数の目安】約${length}文字程度でまとめてください。`
        : "";
      const prompt = ANALYSIS_PROMPTS.detail_summary + lengthInstr;
      const tokenOverride = length
        ? Math.min(65536, Math.max(8192, Math.ceil(Number(length) * 2.2)))
        : undefined;
      const data = await analyzeTextWithGemini(prompt, sourceText, tokenOverride);
      if (!data.success) throw new Error(data.error || "まとめに失敗しました");
      setResults((prev) => {
        const next = new Map(prev);
        next.set("detail_summary", data.analysis);
        return next;
      });
      setResult(data.analysis);
      setLastResultType("detail_summary");
      onResult?.(data.analysis);
      toastOk("詳細まとめを作成しました");
      return true;
    } catch (err) {
      toastError(err instanceof Error ? err.message : "まとめに失敗しました");
      return false;
    } finally {
      setSummarizing(false);
    }
  };

  // ResultPanel からの編集確定を Map に反映
  const updateResult = (type: AnalysisType, text: string) => {
    setResults((prev) => {
      const next = new Map(prev);
      next.set(type, text);
      return next;
    });
    setResult(text);
    setLastResultType(type);
    onResult?.(text);
  };

  // 個別結果の Markdown 保存（タイトルは Gemini で自動生成）
  const downloadMd = async (type: AnalysisType, text: string) => {
    const now = new Date();
    const dateStr = now.toLocaleString("ja-JP");
    const dateFileStr = now.toISOString().split("T")[0];

    const label = getLabel(type);
    const autoTitle = await generateTitleWithTimeout(
      text,
      label,
      `dermapdf_${type}`
    );

    // クリニック情報ブロック
    const clinicBlock =
      clinicSettings?.clinicName
        ? `## クリニック情報\n- **クリニック名**: ${clinicSettings.clinicName}${clinicSettings.purpose ? "\n- **理念**: " + clinicSettings.purpose : ""}${clinicSettings.mission ? "\n- **ミッション**: " + clinicSettings.mission : ""}\n\n`
        : "";

    // 分析内容（軽い整形）
    const formattedAnalysis = text
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
    const claudePrompt = claudePrompts[type] || defaultPrompt;

    const md = `# ${autoTitle}

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
    const safeTitle = autoTitle.replace(/[^\w\u3040-\u9fff]/g, "_");
    const safeLabel = label.replace(/[^\w\u3040-\u9fff]/g, "_");
    a.download = `${safeTitle}_${safeLabel}_${dateFileStr}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 個別結果の Word(.docx) 保存（タイトルは Gemini で自動生成）。
  // Markdownの見出し・太字・箇条書き・表をWordの実体スタイルへマッピングした編集可能な文書。
  const downloadWord = async (type: AnalysisType, text: string) => {
    const now = new Date();
    const dateStr = now.toLocaleString("ja-JP");
    const dateFileStr = now.toISOString().split("T")[0];
    const label = getLabel(type);
    const autoTitle = await generateTitleWithTimeout(
      text,
      label,
      `dermapdf_${type}`
    );
    const metaLines = [
      `ファイル名: ${fileName ?? "unknown"}`,
      `分析タイプ: ${label}`,
      `分析日時: ${dateStr}`,
      ...(clinicSettings?.clinicName ? [`クリニック: ${clinicSettings.clinicName}`] : []),
    ];
    const { exportMarkdownAsDocx } = await import("@/lib/markdown-docx");
    const safeTitle = autoTitle.replace(/[^\w぀-鿿]/g, "_");
    const safeLabel = label.replace(/[^\w぀-鿿]/g, "_");
    await exportMarkdownAsDocx({
      title: autoTitle,
      metaLines,
      markdown: text,
      fileName: `${safeTitle}_${safeLabel}_${dateFileStr}.docx`,
    });
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
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]";

  return (
    <div className="space-y-4 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-lg backdrop-blur-xl">
      {/* 見出し行：中央にワンクリック全文書き起こし（開いてすぐ押せる最短導線）。
          見出しは左のまま、左右に同じ伸縮スペーサを置いてボタンだけを中央に寄せる。
          狭い画面では flex-wrap でボタンが見出しの下に回る（中央寄せのまま）。 */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex flex-1 basis-0 items-center gap-2 whitespace-nowrap text-lg font-bold text-gray-700">
          <BrainCircuit className="h-5 w-5 text-[#378ADD]" />
          Gemini AI分析
        </h2>
        {/* 書き起こしショートカット2種。どちらもチェック状態（selectedTypes）は変更しない。
            ⚡＝資料全体、✅＝いま選択中のページ/画像だけ。 */}
        <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
          {/* ワンクリック全文書き起こし：選択操作なしで transcription を1件だけ即実行。 */}
          <button
            onClick={handleQuickTranscription}
            disabled={
              loading ||
              (isTextMode
                ? !inputText?.trim()
                : !fileBase64 && !(imageParts && imageParts.length > 0))
            }
            title="ページ/画像の選択に関係なく、資料すべてを書き起こします"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D9E75] hover:bg-[#0F6E56] px-4 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
          >
            {quickTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>⚡</span>
            )}
            {quickTranscribing ? "書き起こし中..." : "すべて書き起こしを実行"}
          </button>
          {/* 選択した資料だけを書き起こす：PDFは選択ページ、画像は選択画像のみが対象。 */}
          <button
            onClick={handleSelectedTranscription}
            disabled={loading || isTextMode || selectedCount === 0}
            title={
              isTextMode
                ? "テキスト入力モードでは使用できません"
                : selectedCount === 0
                  ? "ページ/画像を選択してください"
                  : hasImageMode
                    ? `選択中の ${selectedCount} 枚の画像だけを書き起こします`
                    : `選択中の ${selectedCount} ページだけを書き起こします`
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#378ADD] hover:bg-[#185FA5] px-4 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
          >
            {selectedTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>✅</span>
            )}
            {selectedTranscribing
              ? "書き起こし中..."
              : selectedCount > 0
                ? `選択した資料を書き起こす（${selectedCount}${hasImageMode ? "枚" : "ページ"}）`
                : "選択した資料を書き起こす"}
          </button>
          {/* 🎤 プレゼン原稿：ページごとの発表原稿を1枚のカードにまとめて保存する。
              左に「1ページあたりの長さ」「想定聴衆」のドロップダウンを横並びで置く。 */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={scriptLength}
              onChange={(e) => setScriptLength(e.target.value)}
              disabled={loading || scriptGenerating}
              title="1ページあたりの発表時間"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs focus:border-[#B5D4F4] focus:outline-none disabled:opacity-40"
            >
              {scriptLengths.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}／ページ
                </option>
              ))}
            </select>
            <select
              value={scriptAudience}
              onChange={(e) => setScriptAudience(e.target.value)}
              disabled={loading || scriptGenerating}
              title="想定聴衆（口調・訴求軸が変わります）"
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs focus:border-[#B5D4F4] focus:outline-none disabled:opacity-40"
            >
              {scriptAudiences.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={handlePresentationScript}
              disabled={
                loading ||
                scriptGenerating ||
                isTextMode ||
                (!fileBase64 && !hasImageMode)
              }
              title={
                isTextMode
                  ? "テキスト入力モードでは使用できません"
                  : selectedCount > 0
                    ? `選択中の ${selectedCount}${scriptUnit} の発表原稿を作成します`
                    : "資料の全ページ分の発表原稿を作成します"
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
            >
              {scriptGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>🎤</span>
              )}
              {scriptGenerating
                ? "プレゼン原稿を生成中..."
                : scriptTargetCount > 0
                  ? `プレゼン原稿（${scriptIsAll ? "全" : ""}${scriptTargetCount}${scriptUnit}）`
                  : "プレゼン原稿"}
            </button>
          </div>
        </div>
        {/* 右側スペーサ（見出しと同じ伸縮量）。ボタンを行の水平中央に保つ。 */}
        <div className="flex-1 basis-0" aria-hidden />
      </div>

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
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
          >
            <option value="">-- テンプレートを選択 --</option>
            {templates.map((t) => {
              const count =
                t.selectedTypes && t.selectedTypes.length > 0
                  ? t.selectedTypes.length
                  : 1;
              const summary =
                count > 1 ? `${count}件選択` : t.analysisType;
              return (
                <option key={t.id} value={t.id}>
                  {t.name}（{summary}）
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* 分析タイプ選択（複数選択可・グループ折りたたみ） */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          分析タイプ（複数選択可）
          {selectedTypes.size > 0 && (
            <span className="ml-2 text-xs font-normal text-[#185FA5]">
              {selectedTypes.size}件選択中
            </span>
          )}
        </label>
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
          {/* 基本分析（常時表示） */}
          <div className="border-b border-gray-100">
            <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">
              {ANALYSIS_GROUPS[0].label}
            </div>
            {renderGroupOptions(ANALYSIS_GROUPS[0], true)}
          </div>

          {/* その他の分析タイプ（トグル → 小チップの折り返しグリッド） */}
          <button
            type="button"
            onClick={() => setShowSpecializedGroups((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
          >
            <span>
              ＋ その他の分析タイプ
              {(() => {
                const n = ANALYSIS_GROUPS.slice(1).reduce(
                  (a, g) =>
                    a + g.options.filter((o) => selectedTypes.has(o.value)).length,
                  0
                );
                return n > 0 ? (
                  <span className="ml-2 text-xs text-[#185FA5]">
                    （{n}件選択中）
                  </span>
                ) : null;
              })()}
            </span>
            <span className="text-gray-400 text-xs">
              {showSpecializedGroups ? "▲" : "▼"}
            </span>
          </button>

          {showSpecializedGroups && (
            <div className="px-3 py-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                {ANALYSIS_GROUPS.slice(1).map((group) => {
                  const count = group.options.filter((o) =>
                    selectedTypes.has(o.value)
                  ).length;
                  const active = openChip === group.label;
                  return (
                    <button
                      key={group.label}
                      type="button"
                      onClick={() =>
                        setOpenChip(active ? null : group.label)
                      }
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-[#378ADD] bg-[#E6F1FB] text-[#185FA5]"
                          : "border-gray-200 bg-white text-gray-600 hover:border-[#378ADD]"
                      }`}
                    >
                      {group.label}
                      {count > 0 && (
                        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#378ADD] px-1 text-[10px] font-bold text-white">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {openChip &&
                (() => {
                  const group = ANALYSIS_GROUPS.find(
                    (g) => g.label === openChip
                  );
                  if (!group) return null;
                  return (
                    <div className="rounded-lg border border-gray-100 bg-gray-50/40">
                      {renderGroupOptions(group)}
                    </div>
                  );
                })()}
            </div>
          )}
        </div>
      </div>

      {/* 目的入力 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          目的・Geminiへの指示（任意）
        </label>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="分析の目的や、Geminiに追加でやってほしい作業・指示を入力..."
          rows={2}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
        />
      </div>

      {/* 出力文字数指定 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          出力文字数の目安（任意）
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={targetLength}
            onChange={(e) => setTargetLength(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
          >
            <option value="">指定なし（AIに任せる）</option>
            <option value="200">200文字程度（超コンパクト）</option>
            <option value="400">400文字程度（短め）</option>
            <option value="600">600文字程度（標準）</option>
            <option value="1000">1000文字程度（詳しめ）</option>
            <option value="2000">2000文字程度（長文）</option>
            <option value="3000">3000文字程度（非常に詳細）</option>
            <option value="custom">カスタム指定</option>
          </select>

          {targetLength === "custom" && (
            <input
              type="number"
              value={customLength}
              onChange={(e) => setCustomLength(e.target.value)}
              placeholder="文字数を入力"
              min={100}
              max={10000}
              step={100}
              className="w-36 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
            />
          )}
          {targetLength && targetLength !== "custom" && (
            <span className="text-xs text-gray-400">
              約{Number(targetLength).toLocaleString()}文字
            </span>
          )}
        </div>
      </div>

      {/* 読み手レベル（フェーズ2）。対象（わかりやすく／プレゼン）タイプ選択時のみ表示。
          文字数指定と同じ流儀で、条件表示・配置を踏襲する。 */}
      {Array.from(selectedTypes).some((t) => READER_LEVEL_TYPES.has(t)) && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-600">
            読み手レベル（任意・わかりやすく／プレゼン系に適用）
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={readerLevel}
              onChange={(e) => updateReaderLevel(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
            >
              {READER_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {readerLevel && (
              <span className="text-xs text-gray-400">
                出力の語り口を読み手に合わせます
              </span>
            )}
          </div>
        </div>
      )}

      {/* 全文書き起こし警告 */}
      {selectedTypes.has("transcription") && (
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

      {/* 全文書き起こしオプション（全文書き起こし選択時のみ） */}
      {selectedTypes.has("transcription") && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">
              手書きメモ
            </label>
            <select
              value={excludeHandwriting ? "exclude" : "include"}
              onChange={(e) => setExcludeHandwriting(e.target.value === "exclude")}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
            >
              <option value="include">含める</option>
              <option value="exclude">含めない</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">空欄</label>
            <select
              value={fillBlanks ? "fill" : "keep"}
              onChange={(e) => setFillBlanks(e.target.value === "fill")}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
            >
              <option value="keep">そのまま</option>
              <option value="fill">同ページの回答を参照して補足</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">
              著作権表記
            </label>
            <select
              value={excludeCopyright ? "exclude" : "include"}
              onChange={(e) => setExcludeCopyright(e.target.value === "exclude")}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
            >
              <option value="exclude">含めない</option>
              <option value="include">含める</option>
            </select>
          </div>
        </div>
      )}

      {/* 実行ボタン + テンプレート保存 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleAnalyze()}
          disabled={
            loading ||
            selectedTypes.size === 0 ||
            (isTextMode
              ? !inputText?.trim()
              : !fileBase64 && !(imageParts && imageParts.length > 0))
          }
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#378ADD] hover:bg-[#185FA5] px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
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
          className="inline-flex items-center gap-1 rounded-xl border border-[#B5D4F4] bg-white px-3 py-3 text-sm font-medium text-[#185FA5] hover:bg-[#E6F1FB]"
        >
          <Save className="h-4 w-4" /> テンプレート保存
        </button>
      </div>

      {/* テンプレート保存モーダル */}
      {showSaveTemplate && (
        <div className="rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#185FA5]">テンプレートとして保存</span>
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
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
          />
          <button
            onClick={handleSaveTemplate}
            disabled={!templateName.trim()}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[#378ADD] hover:bg-[#185FA5] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            <Save className="h-3 w-3" /> 保存
          </button>
        </div>
      )}

      {/* 書き起こし進捗 */}
      {transcriptionProgress && (
        <div className="text-xs text-[#185FA5] bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg px-3 py-2 mt-2 flex items-center gap-2">
          <span className="animate-spin">⚙️</span>
          <span>{transcriptionProgress}</span>
        </div>
      )}

      {/* 結果表示（複数選択時は2カラムグリッド、単一は1カラム） */}
      {results.size > 0 && (
        <div
          className={`grid gap-4 ${
            results.size >= 2
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {Array.from(results.entries()).map(([type, text]) => (
            <ResultPanel
              key={type}
              type={type}
              label={getLabel(type)}
              text={text}
              simplifying={simplifying === type}
              showSummarize={type === "transcription"}
              summarizing={summarizing}
              onSummarize={(length) => summarizeFromText(text, length)}
              onUpdate={(newText) => updateResult(type, newText)}
              onSimplify={() => simplifyOne(type, text)}
              onSave={() => saveStock(type, text)}
              onCopy={() => copyText(text)}
              onDownloadTxt={() => downloadTxt(type, text)}
              onDownloadMd={() => downloadMd(type, text)}
              onDownloadWord={() => downloadWord(type, text)}
            />
          ))}
        </div>
      )}

      {/* Genspark プレゼン資料生成 */}
      {result && (
        <div className="w-full space-y-4 rounded-2xl border border-[#B5D4F4] bg-white/40 p-6 shadow-lg backdrop-blur-xl">
          <h3 className="flex items-center gap-2 text-base font-bold text-gray-700">
            <Sparkles className="h-5 w-5 text-[#378ADD]" />
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
                  <span className="rounded-full border border-[#B5D4F4] bg-[#E6F1FB] px-2 py-1 text-xs text-[#185FA5]">
                    感情の動線設計
                  </span>
                )}
                {appliesCatch && (
                  <span className="rounded-full border border-[#B5D4F4] bg-[#E6F1FB] px-2 py-1 text-xs text-[#185FA5]">
                    1スライド1メッセージ
                  </span>
                )}
                {appliesBeforeAfter && (
                  <span className="rounded-full border border-[#B5D4F4] bg-[#E6F1FB] px-2 py-1 text-xs text-[#185FA5]">
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
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1D9E75] hover:bg-[#0F6E56] px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity disabled:opacity-40"
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
              className="inline-flex items-center gap-1 rounded-xl border border-[#B5D4F4] bg-white px-3 py-3 text-sm font-medium text-[#185FA5] hover:bg-[#E6F1FB]"
            >
              <Save className="h-4 w-4" /> 設定を保存
            </button>
          </div>

          {/* Genspark テンプレート保存モーダル */}
          {showGsSaveTemplate && (
            <div className="rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#185FA5]">テンプレートとして保存</span>
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
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#B5D4F4] focus:outline-none focus:ring-2 focus:ring-[#B5D4F4]"
              />
              <button
                onClick={handleGsSaveTemplate}
                disabled={!gsTemplateName.trim()}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[#378ADD] hover:bg-[#185FA5] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
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
                className="w-full rounded-xl border border-[#B5D4F4] bg-white/80 px-4 py-3 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleGsCopyAndOpen}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D9E75] hover:bg-[#0F6E56] px-4 py-2 text-sm font-medium text-white shadow-sm"
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
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1D9E75] hover:bg-[#0F6E56] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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

// 個別結果パネル（左右並列表示の各カード）
function ResultPanel({
  label,
  text,
  simplifying,
  showSummarize,
  summarizing,
  onSummarize,
  onUpdate,
  onSimplify,
  onSave,
  onCopy,
  onDownloadTxt,
  onDownloadMd,
  onDownloadWord,
}: {
  type: AnalysisType;
  label: string;
  text: string;
  simplifying: boolean;
  showSummarize?: boolean;
  summarizing?: boolean;
  onSummarize?: (length: string) => void | Promise<boolean>;
  onUpdate: (text: string) => void;
  onSimplify: () => void;
  onSave: () => void | Promise<void>;
  onCopy: () => void;
  onDownloadTxt: () => void | Promise<void>;
  onDownloadMd: () => void | Promise<void>;
  onDownloadWord: () => void | Promise<void>;
}) {
  const [editedText, setEditedText] = useState(text);
  const [isEditing, setIsEditing] = useState(false);
  // チェイン「詳細にまとめる」の出力文字数選択（書き起こしカードのみ）
  const [summaryLength, setSummaryLength] = useState("");
  // 校正モーダルの表示
  const [showProofread, setShowProofread] = useState(false);
  // タイトル生成を伴う非同期処理の進行中状態
  const [pending, setPending] = useState<"save" | "txt" | "md" | "word" | null>(null);
  // 本文エリアの高さ（プリセット値・初期値=M=350）
  const [panelHeight, setPanelHeight] = useState<number>(350);
  // 保存済み表示の状態（このカード単位・ボタン種別ごとに保持）。
  // メモリ内stateのみ（新storageキーは作らない）。保存を伴うボタンが
  // 今後増えても action 文字列を足すだけで使い回せる汎用の形。
  const [savedActions, setSavedActions] = useState<Set<string>>(new Set());

  // text が外から変わった（平易化・編集確定など）ときに同期。
  // 内容が変わったら保存済み表示は通常表示に戻す（内容とストックの不一致を防ぐ）。
  useEffect(() => {
    setEditedText(text);
    setSavedActions(new Set());
  }, [text]);

  const currentLength = isEditing ? editedText.length : text.length;

  // タイトル生成を伴う処理を呼び出す共通ラッパー
  const runWithPending = async (
    kind: "save" | "txt" | "md" | "word",
    fn: () => void | Promise<void>
  ) => {
    if (pending !== null) return;
    setPending(kind);
    try {
      await fn();
      // 保存成功後のみ「保存済み」を立てる（失敗時＝throw時は立てない）
      if (kind === "save") {
        setSavedActions((prev) => new Set(prev).add("save"));
      }
    } finally {
      setPending(null);
    }
  };
  const isBusy = pending !== null;

  // 詳細にまとめる（AI生成＋新カード保存）。成功時のみ「保存済み」を立てる。
  // disabled にはせず、文字数を変えた再実行を許容する（クリックで再生成）。
  const handleSummarize = async () => {
    if (summarizing) return;
    const ok = await onSummarize?.(summaryLength);
    if (ok) {
      setSavedActions((prev) => new Set(prev).add("summarize"));
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white/80 p-4 flex flex-col gap-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#378ADD]">{label}</span>
        <span className="text-xs text-gray-400">
          {currentLength.toLocaleString()} 文字
        </span>
      </div>

      {/* 高さプリセット切替 */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-400 mr-1">高さ:</span>
        {HEIGHT_PRESETS.map(({ label, h }) => (
          <button
            key={label}
            onClick={() => setPanelHeight(h)}
            className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
              panelHeight === h
                ? "bg-[#378ADD] text-white border-[#378ADD]"
                : "border-gray-200 text-gray-500 hover:border-[#378ADD]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 本文（リサイズ可能ラッパー） */}
      {isEditing ? (
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          style={{
            height: panelHeight === 9999 ? "auto" : `${panelHeight}px`,
            minHeight: "200px",
          }}
          className="w-full rounded-lg border-2 border-[#378ADD] bg-white p-3 text-sm leading-relaxed resize-y focus:border-[#378ADD] focus:outline-none"
        />
      ) : (
        <div
          className="overflow-y-auto resize-y rounded border border-gray-100 p-2 bg-white/60"
          style={{
            height: panelHeight === 9999 ? "auto" : `${panelHeight}px`,
            minHeight: "200px",
          }}
        >
          <div className="max-w-none text-gray-700 text-sm">
            <MarkdownView>{text}</MarkdownView>
          </div>
        </div>
      )}

      {/* アクションボタン群 */}
      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={onCopy}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 inline-flex items-center gap-1"
        >
          <Copy className="h-3 w-3" /> コピー
        </button>
        <button
          onClick={() => runWithPending("txt", onDownloadTxt)}
          disabled={isBusy}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 inline-flex items-center gap-1 disabled:opacity-50"
        >
          {pending === "txt" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> タイトル生成中...
            </>
          ) : (
            <>
              <Download className="h-3 w-3" /> テキスト
            </>
          )}
        </button>
        <button
          onClick={() => runWithPending("md", onDownloadMd)}
          disabled={isBusy}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 inline-flex items-center gap-1 disabled:opacity-50"
        >
          {pending === "md" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> タイトル生成中...
            </>
          ) : (
            <>
              <Download className="h-3 w-3" /> MD
            </>
          )}
        </button>
        <button
          onClick={() => runWithPending("word", onDownloadWord)}
          disabled={isBusy}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 inline-flex items-center gap-1 disabled:opacity-50"
          title="Word(.docx)で保存（見出し・箇条書き・表を保持した編集可能な文書）"
        >
          {pending === "word" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> タイトル生成中...
            </>
          ) : (
            <>
              <Download className="h-3 w-3" /> Word
            </>
          )}
        </button>
        <button
          onClick={() => runWithPending("save", onSave)}
          disabled={isBusy || savedActions.has("save")}
          title={savedActions.has("save") ? "このカードはストックに保存済みです" : undefined}
          className={`text-xs px-3 py-1.5 rounded-lg text-white inline-flex items-center gap-1 ${
            savedActions.has("save")
              ? "bg-[#1D9E75] cursor-default disabled:opacity-100"
              : "bg-[#378ADD] hover:bg-[#185FA5] disabled:opacity-50"
          }`}
        >
          {pending === "save" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> タイトル生成中...
            </>
          ) : savedActions.has("save") ? (
            <>✓ 保存済み</>
          ) : (
            <>
              <BookmarkPlus className="h-3 w-3" /> ストック
            </>
          )}
        </button>
        <button
          onClick={onSimplify}
          disabled={simplifying}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#1D9E75] hover:bg-[#167a5c] text-white disabled:opacity-50 inline-flex items-center gap-1"
        >
          {simplifying ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> 変換中...
            </>
          ) : (
            <>✨ わかりやすく変換</>
          )}
        </button>
        {showSummarize && (
          <>
            <select
              value={summaryLength}
              onChange={(e) => setSummaryLength(e.target.value)}
              disabled={summarizing}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-500 disabled:opacity-50"
              title="詳細まとめの出力文字数"
            >
              <option value="">文字数指定なし</option>
              <option value="3000">3000字</option>
              <option value="5000">5000字</option>
              <option value="8000">8000字</option>
              <option value="12000">12000字</option>
            </select>
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              title={
                savedActions.has("summarize")
                  ? "文字数を変えて再実行できます"
                  : undefined
              }
              className={`text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50 inline-flex items-center gap-1 ${
                savedActions.has("summarize")
                  ? "bg-[#1D9E75] hover:bg-[#167a5c]"
                  : "bg-[#378ADD] hover:bg-[#185FA5]"
              }`}
            >
              {summarizing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> まとめ中...
                </>
              ) : savedActions.has("summarize") ? (
                <>✓ 保存済み</>
              ) : (
                <>📝 詳細にまとめる</>
              )}
            </button>
          </>
        )}
        <button
          onClick={() => setShowProofread(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white inline-flex items-center gap-1"
        >
          🔎 校正
        </button>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
          >
            ✏️ 編集
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                onUpdate(editedText);
                setIsEditing(false);
                toastOk("分析結果を更新しました");
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#378ADD] hover:bg-[#185FA5] text-white"
            >
              ✅ 完了
            </button>
            <button
              onClick={() => {
                setEditedText(text);
                setIsEditing(false);
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
            >
              ✕ キャンセル
            </button>
          </>
        )}
      </div>

      {showProofread && (
        <ProofreadModal
          sourceText={text}
          sourceTitle={label}
          onClose={() => setShowProofread(false)}
          onSaveCard={(title, content, before) => {
            saveAnalysis({
              fileName: label,
              analysisType: "proofread",
              analysisLabel: "校正済み",
              content,
              tags: [],
              folder: "校正",
              title,
              proofreadBefore: before,
            });
          }}
        />
      )}
    </div>
  );
}
