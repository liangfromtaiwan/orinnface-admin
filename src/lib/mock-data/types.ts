export type CompanyType = "admin" | "oem" | "b2b"

// operator   = OrinnME運営
// shop       = 店家(美容サロン等)
// influencer = 網紅(KOL)
// company    = 企業(BtoB クライアント)
export type CompanySubType = "operator" | "shop" | "influencer" | "company"

export type Company = {
  id: number
  name: string
  type: CompanyType
  subType: CompanySubType
  createdAt: string
}

export type Expression =
  | "張り(強)"
  | "張り(弱)"
  | "おだやか"
  | "ゆらぎ(強)"
  | "ゆらぎ(弱)"

export type Fatigue =
  | "軽やか"
  | "いつも通り"
  | "ややお疲れ"
  | "蓄積しています"
  | "踏ん張りどき"

export type SubjectiveFatigue =
  | "あまり疲れていない"
  | "少し疲れている"
  | "だいぶ疲れている"

export type SubjectiveFocus =
  | "集中しやすい"
  | "どちらともいえない"
  | "集中しづらい"

export type BodyPart =
  | "上半身"
  | "体幹部"
  | "下半身"
  | "なんとなく全体"
  | "特に気になるところはない"

export type Plan = "Guest" | "Member" | "Premium"

export type VideoCategory =
  | "stretch"
  | "meditation"
  | "yoga"
  | "breathing"
  | "eye-care"

export type Video = {
  id: number
  title: string
  durationSeconds: number
  category: VideoCategory
  // どんな疲労状態のユーザーに推薦されやすいか(optional)
  recommendedFor?: Fatigue[]
}

export type VideoViewRecord = {
  userId: number
  videoId: number
  watchedAt: string
  completed: boolean
  // 視聴後 24 時間以内に再分析を行ったか
  reanalyzedWithin24h: boolean
}

export type PlanChangeEvent = {
  userId: number
  changedAt: string
  fromPlan: Plan
  toPlan: Plan
}

// 規格仕様:Guest / Member は表情のみ、Premium のみ fatigue 両方を持つ。
// このため fatigueAi / subjectiveFatigue を optional 化。
export type ActivityRecord = {
  analyzedAt: string
  expression: Expression
  fatigueAi?: Fatigue
  subjectiveFatigue?: SubjectiveFatigue
  subjectiveFocus?: SubjectiveFocus
  bodyPart?: BodyPart
  careVideoTitle?: string
  careCompleted?: boolean
}

export type Gender = "女性" | "男性" | "回答しない"

export type User = {
  id: number
  name: string
  companyId: number
  plan: Plan
  // 規格 v2 1-1 取得項目:Guest は未登録のため undefined、
  // Member / Premium は登録時に必須入力。
  gender?: Gender
  birthDate?: string // YYYY-MM-DD
  expression: Expression
  fatigueAi?: Fatigue
  subjectiveFatigue?: SubjectiveFatigue
  subjectiveFocus: SubjectiveFocus
  bodyPart: BodyPart
  lastAnalysisAt: string
  activityLog: ActivityRecord[]
}

export type DailyAnalytics = {
  date: string
  dau: number
  reanalysisRate: number
  // 7 日内に再訪したユーザーの割合
  // 規格書 2-1 「継続率(リテンション)」に対応
  retentionRate: number
  careExecutionRate: number
  improvementRate: number
  expressionDist: Record<Expression, number>
  fatigueDist: Record<Fatigue, number>
}

export type PlanStats = {
  current: Record<Plan, number>
  // Premium のみが課金プラン。G→M / M→G は営収に影響しないため、
  // 営収シグナルとなる「Premium 化」と「Premium 離脱」のみを追跡する。
  // newPremium  = M→P + G→P(新たに Premium になった人数)
  // lostPremium = P→M + P→Guest(Premium から離脱した人数)
  daily: { date: string; newPremium: number; lostPremium: number }[]
}

const FATIGUE_AI_ORDER: Fatigue[] = [
  "軽やか",
  "いつも通り",
  "ややお疲れ",
  "蓄積しています",
  "踏ん張りどき",
]

const SUBJECTIVE_FATIGUE_TO_5SCALE: Record<SubjectiveFatigue, number> = {
  "あまり疲れていない": 1,
  "少し疲れている": 3,
  "だいぶ疲れている": 5,
}

export function fatigueLevel(f: Fatigue): number {
  return FATIGUE_AI_ORDER.indexOf(f) + 1
}

export function subjectiveLevel(s: SubjectiveFatigue): number {
  return SUBJECTIVE_FATIGUE_TO_5SCALE[s]
}

// 表情カテゴリの「wellness 順」マッピング(おだやか=5 最良 〜 ゆらぎ強=1 不調)
// 表情は本質的にカテゴリ(順序性無し)だが、推移グラフで他指標と
// 重ね合わせ表示するため敢えて 1-5 にマップ。
// fatigueLevel / subjectiveLevel と Y 軸方向を揃えるため、推移チャート
// 側では subjective / fatigue を invert(6 - level)して「5 = 良好」に統一する。
const EXPRESSION_WELLNESS_SCORE: Record<Expression, number> = {
  "おだやか": 5,
  "張り(弱)": 4,
  "ゆらぎ(弱)": 3,
  "張り(強)": 2,
  "ゆらぎ(強)": 1,
}

export function expressionLevel(e: Expression): number {
  return EXPRESSION_WELLNESS_SCORE[e]
}

// fatigue 両方を持つ Premium ユーザーのみ gap 評価可能。
// Guest / Member は fatigueAi / subjectiveFatigue が undefined のため、
// gap 概念は適用されない(falseを返す)。
export function fatigueGap(user: User): number {
  if (!user.fatigueAi || !user.subjectiveFatigue) return 0
  return Math.abs(
    fatigueLevel(user.fatigueAi) - subjectiveLevel(user.subjectiveFatigue)
  )
}

export function hasFatigueGap(user: User): boolean {
  if (!user.fatigueAi || !user.subjectiveFatigue) return false
  return fatigueGap(user) >= 2
}

export function recordHasGap(r: ActivityRecord): boolean {
  if (!r.fatigueAi || !r.subjectiveFatigue) return false
  return (
    Math.abs(fatigueLevel(r.fatigueAi) - subjectiveLevel(r.subjectiveFatigue)) >=
    2
  )
}

export const EXPRESSIONS: Expression[] = [
  "張り(強)",
  "張り(弱)",
  "おだやか",
  "ゆらぎ(強)",
  "ゆらぎ(弱)",
]

export const FATIGUES: Fatigue[] = FATIGUE_AI_ORDER

export const SUBJECTIVE_FATIGUES: SubjectiveFatigue[] = [
  "あまり疲れていない",
  "少し疲れている",
  "だいぶ疲れている",
]

export const SUBJECTIVE_FOCUSES: SubjectiveFocus[] = [
  "集中しやすい",
  "どちらともいえない",
  "集中しづらい",
]

export const BODY_PARTS: BodyPart[] = [
  "上半身",
  "体幹部",
  "下半身",
  "なんとなく全体",
  "特に気になるところはない",
]

export const PLANS: Plan[] = ["Guest", "Member", "Premium"]

export const VIDEO_CATEGORIES: VideoCategory[] = [
  "stretch",
  "meditation",
  "yoga",
  "breathing",
  "eye-care",
]

export const VIDEO_CATEGORY_LABEL: Record<VideoCategory, string> = {
  stretch: "ストレッチ",
  meditation: "瞑想",
  yoga: "ヨガ",
  breathing: "呼吸",
  "eye-care": "アイケア",
}

// 動画尺バケット(6 段階、規格指定の粒度)。
// 現 catalog は 30/60/120 秒のみで前 3 バケットに集中、
// 後 3 バケットは将来の長尺動画追加に備えた予約枠。
export type DurationBucket = {
  key: string
  label: string
  minSeconds: number
  maxSeconds: number
}

export const DURATION_BUCKETS: DurationBucket[] = [
  { key: "0-30s", label: "30秒以下", minSeconds: 0, maxSeconds: 30 },
  { key: "30-60s", label: "30秒〜1分", minSeconds: 31, maxSeconds: 60 },
  { key: "1-2min", label: "1〜2分", minSeconds: 61, maxSeconds: 120 },
  { key: "2-3min", label: "2〜3分", minSeconds: 121, maxSeconds: 180 },
  { key: "3-5min", label: "3〜5分", minSeconds: 181, maxSeconds: 300 },
  { key: "5min+", label: "5分以上", minSeconds: 301, maxSeconds: 99999 },
]

export function getDurationBucket(seconds: number): DurationBucket {
  return (
    DURATION_BUCKETS.find(
      (b) => seconds >= b.minSeconds && seconds <= b.maxSeconds
    ) ?? DURATION_BUCKETS[DURATION_BUCKETS.length - 1]
  )
}

// ─────────────────────────────────────────────────────────────
// CTA 効果分析(2026-05-18 雇主授権・規格 v2)
// ─────────────────────────────────────────────────────────────

export type CTAType = "guest_to_member" | "free_to_premium"

// G-* = Guest → Member 訴求、M-* = Member → Premium 訴求
export type CTATiming =
  | "after_survey" // G-1: アンケート結束後
  | "before_care" // G-2: ケア開始前
  | "daily_limit" // G-3: 日上限阻擋
  | "video_7_to_8" // M-1: 第 7→8 回時
  | "video_7_to_10_each" // M-2: 第 7-10 回 每次
  | "monthly_limit" // M-3: 月上限阻擋(強制)
  | "day_30" // M-4: Day30 累積

export type CTAEvent = {
  id: string
  userId: number
  ctaType: CTAType
  ctaTiming: CTATiming
  triggeredAt: string // ISO date
  clicked: boolean
  converted: boolean
  convertedAt?: string
}

export const CTA_TIMINGS: CTATiming[] = [
  "after_survey",
  "before_care",
  "daily_limit",
  "video_7_to_8",
  "video_7_to_10_each",
  "monthly_limit",
  "day_30",
]

export const CTA_TIMING_LABEL: Record<CTATiming, string> = {
  after_survey: "アンケート結束後",
  before_care: "ケア開始前",
  daily_limit: "日上限阻擋",
  video_7_to_8: "第7→8回時",
  video_7_to_10_each: "第7-10回 毎回",
  monthly_limit: "月上限阻擋(強制)",
  day_30: "Day30 累積",
}

export const CTA_TIMING_TO_TYPE: Record<CTATiming, CTAType> = {
  after_survey: "guest_to_member",
  before_care: "guest_to_member",
  daily_limit: "guest_to_member",
  video_7_to_8: "free_to_premium",
  video_7_to_10_each: "free_to_premium",
  monthly_limit: "free_to_premium",
  day_30: "free_to_premium",
}

export const CTA_TYPE_LABEL: Record<CTAType, string> = {
  guest_to_member: "無料登録",
  free_to_premium: "Premium 升級",
}
