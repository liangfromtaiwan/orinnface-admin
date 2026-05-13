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

export type ActivityRecord = {
  analyzedAt: string
  expression: Expression
  fatigueAi: Fatigue
  subjectiveFatigue: SubjectiveFatigue
  subjectiveFocus?: SubjectiveFocus
  bodyPart?: BodyPart
  careVideoTitle?: string
  careCompleted?: boolean
}

export type User = {
  id: number
  name: string
  companyId: number
  plan: Plan
  expression: Expression
  fatigueAi: Fatigue
  subjectiveFatigue: SubjectiveFatigue
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

export function fatigueGap(user: User): number {
  return Math.abs(
    fatigueLevel(user.fatigueAi) - subjectiveLevel(user.subjectiveFatigue)
  )
}

export function hasFatigueGap(user: User): boolean {
  return fatigueGap(user) >= 2
}

export function recordHasGap(r: ActivityRecord): boolean {
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
