import { analyzeWithGemini } from "@/lib/gemini-client";

export const TARGET_OPTIONS = [
  { value: "all_staff", label: "全スタッフ（職種混合）" },
  { value: "management", label: "管理職・リーダー層" },
  { value: "new_staff", label: "新入社員・新人スタッフ" },
  { value: "medical_staff", label: "医療スタッフ（看護師・技師等）" },
  { value: "front_staff", label: "受付・フロントスタッフ" },
  { value: "patients", label: "患者・一般向け" },
  { value: "investors", label: "投資家・金融機関向け" },
  { value: "partners", label: "取引先・パートナー企業向け" },
];

export const LEVEL_OPTIONS = [
  { value: "simple", label: "簡潔（要点のみ・5〜8枚）" },
  { value: "standard", label: "標準（バランス重視・10〜15枚）" },
  { value: "detailed", label: "詳しく（網羅的・20〜30枚）" },
  { value: "expert", label: "専門家向け（データ重視・制限なし）" },
];

export const PURPOSE_OPTIONS = [
  { value: "inform", label: "情報共有・周知" },
  { value: "educate", label: "教育・研修" },
  { value: "persuade", label: "説得・意思決定促進" },
  { value: "motivate", label: "モチベーションアップ" },
  { value: "report", label: "報告・振り返り" },
  { value: "propose", label: "提案・企画" },
  { value: "celebrate", label: "表彰・表彰式" },
];

export const TONE_OPTIONS = [
  { value: "professional", label: "プロフェッショナル（ビジネス調）" },
  { value: "friendly", label: "親しみやすい（カジュアル調）" },
  { value: "inspiring", label: "感動的・ストーリー調" },
  { value: "data_driven", label: "データドリブン（グラフ・数値重視）" },
  { value: "visual", label: "ビジュアル重視（図解・イラスト）" },
];

export function getLabel(
  options: { value: string; label: string }[],
  value: string
) {
  return options.find((o) => o.value === value)?.label ?? value;
}

// 技法自動適用判定
export function getTechniqueFlags(target: string, purpose: string) {
  const emotionTargets = ["all_staff", "new_staff", "medical_staff", "front_staff", "management"];
  const emotionPurposes = ["educate", "motivate", "celebrate"];
  const appliesEmotion = emotionTargets.includes(target) || emotionPurposes.includes(purpose);

  const catchTargets = ["management", "all_staff", "new_staff", "medical_staff", "front_staff"];
  const catchPurposes = ["educate", "persuade", "motivate", "propose"];
  const appliesCatch = catchTargets.includes(target) || catchPurposes.includes(purpose);

  const beforeAfterPurposes = ["inform", "report", "propose"];
  const beforeAfterTargets = ["all_staff", "management", "medical_staff", "front_staff"];
  const appliesBeforeAfter = beforeAfterPurposes.includes(purpose) || beforeAfterTargets.includes(target);

  return { appliesEmotion, appliesCatch, appliesBeforeAfter };
}

export interface GensparkOptions {
  analysisResult: string;
  target: string;
  level: string;
  purpose: string;
  tone: string;
  additionalNotes: string;
}

export function buildGensparkPrompt(opts: GensparkOptions): string {
  const { appliesEmotion, appliesCatch, appliesBeforeAfter } = getTechniqueFlags(opts.target, opts.purpose);

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

  return `あなたはGenspark AIスライド生成に特化したプロンプトエンジニアです。
以下の分析結果とユーザー要件をもとに、Gensparkで最高品質のPPTXスライドを
生成するための完全なプロンプトを日本語で作成してください。

【分析結果】
${opts.analysisResult}

【プレゼン要件】
- ターゲット層: ${getLabel(TARGET_OPTIONS, opts.target)}
- 内容レベル: ${getLabel(LEVEL_OPTIONS, opts.level)}
- プレゼンの目的: ${getLabel(PURPOSE_OPTIONS, opts.purpose)}
- スライドのトーン: ${getLabel(TONE_OPTIONS, opts.tone)}
- 追加要望: ${opts.additionalNotes || "なし"}

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
}

export async function generateGensparkPrompt(
  opts: GensparkOptions,
  fileBase64?: string,
  fileMime?: string
): Promise<{ success: boolean; prompt: string; error?: string }> {
  const promptText = buildGensparkPrompt(opts);

  const data =
    fileBase64 && fileMime
      ? await analyzeWithGemini(fileBase64, fileMime, promptText)
      : await analyzeWithGemini("", "text/plain", promptText);

  if (!data.success) {
    return { success: false, prompt: "", error: data.error || "プロンプト生成に失敗しました" };
  }

  return { success: true, prompt: data.analysis };
}
