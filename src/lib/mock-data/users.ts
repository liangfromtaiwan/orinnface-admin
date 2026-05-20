import type { ActivityRecord, Gender, Plan, User } from "./types"
import {
  BODY_PARTS,
  EXPRESSIONS,
  FATIGUES,
  SUBJECTIVE_FATIGUES,
  SUBJECTIVE_FOCUSES,
} from "./types"

function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 規格 12 本動画の title 一覧(plan 別 careVideo pool として使う)。
// videos.ts と二重管理だが、users.ts → videos.ts は循環依存になるため別途定義。
const CARE_VIDEOS_30S = [
  "首肩クイックストレッチ",
  "30秒マインドリセット",
  "デスクサイドヨガ30秒",
  "深呼吸30秒",
  "目の疲れ瞬間ケア",
  "朝の目覚めストレッチ",
]
const CARE_VIDEOS_60S = [
  "肩こり解消ストレッチ",
  "1分集中呼吸瞑想",
  "リラックスヨガフロー",
  "腹式呼吸エクササイズ",
  "PC疲労 目元ストレッチ",
  "夜のリラックス瞑想",
]

// plan 別の動画閲覧プール
//   Guest:   閲覧不可 → null
//   Member:  30 秒のみ
//   Premium: 30 秒 + 60 秒
function carePoolForPlan(plan: Plan): string[] | null {
  if (plan === "Guest") return null
  if (plan === "Member") return CARE_VIDEOS_30S
  return [...CARE_VIDEOS_30S, ...CARE_VIDEOS_60S]
}

// 規格 v2 1-1:Member / Premium は登録時に gender / birthDate を入力。
// Guest はアプリ未登録のため undefined。
// 性別分布:女性 50% / 男性 45% / 回答しない 5%
// 年齢分布:20-30 代 30% / 30-40 代 35% / 40-50 代 20% / 50-60 代 15%
//   → 生年 1966-2006 の範囲(基準日 2026-05-18)
function generateProfile(
  seed: number,
  plan: Plan
): { gender?: Gender; birthDate?: string } {
  if (plan === "Guest") return {}

  const rng = mulberry32(seed)
  const g = rng()
  const gender: Gender =
    g < 0.5 ? "女性" : g < 0.95 ? "男性" : "回答しない"

  const a = rng()
  let minBirthYear: number
  let maxBirthYear: number
  if (a < 0.3) {
    // 20 代(20-29 歳)
    minBirthYear = 1997
    maxBirthYear = 2006
  } else if (a < 0.65) {
    // 30 代(30-39 歳)
    minBirthYear = 1987
    maxBirthYear = 1996
  } else if (a < 0.85) {
    // 40 代(40-49 歳)
    minBirthYear = 1977
    maxBirthYear = 1986
  } else {
    // 50 代(50-59 歳)
    minBirthYear = 1967
    maxBirthYear = 1976
  }
  const year =
    minBirthYear + Math.floor(rng() * (maxBirthYear - minBirthYear + 1))
  const month = 1 + Math.floor(rng() * 12)
  const day = 1 + Math.floor(rng() * 28) // 安全に 28 日まで
  const birthDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  return { gender, birthDate }
}

function generateActivityLog(
  seed: number,
  plan: Plan,
  latest: Omit<ActivityRecord, "careVideoTitle" | "careCompleted">
): ActivityRecord[] {
  const rng = mulberry32(seed)
  const count = 6 + Math.floor(rng() * 3) // 6-8 件

  const carePool = carePoolForPlan(plan)
  // Premium のみ fatigue 両方が記録される(規格仕様)
  const hasFatigue = plan === "Premium"

  const records: ActivityRecord[] = [
    {
      ...latest,
      careVideoTitle: carePool
        ? carePool[Math.floor(rng() * carePool.length)]
        : undefined,
      careCompleted: carePool ? rng() > 0.3 : undefined,
    },
  ]

  let cursorMs = new Date(latest.analyzedAt + "Z").getTime()
  for (let i = 1; i < count; i++) {
    const daysBack = 2 + Math.floor(rng() * 5)
    cursorMs -= daysBack * 86400000
    const dt = new Date(cursorMs)
    dt.setUTCHours(8 + Math.floor(rng() * 12), Math.floor(rng() * 60), 0, 0)

    let ai: (typeof FATIGUES)[number] | undefined
    let subj: (typeof SUBJECTIVE_FATIGUES)[number] | undefined

    if (hasFatigue) {
      const aiLevel = Math.floor(rng() * 5)
      ai = FATIGUES[aiLevel]
      // 25% 強制落差(警告色テスト用)、それ以外は AI レベルに近い主観
      if (rng() < 0.25) {
        subj = aiLevel < 2 ? SUBJECTIVE_FATIGUES[2] : SUBJECTIVE_FATIGUES[0]
      } else {
        const subjIdx = aiLevel < 2 ? 0 : aiLevel < 4 ? 1 : 2
        subj = SUBJECTIVE_FATIGUES[subjIdx]
      }
    } else {
      // Member 抽選で rng() の seek を一致させるため空消費(掛け落差ロジック分の 2 回)
      rng()
      rng()
    }

    records.push({
      analyzedAt: dt.toISOString().slice(0, 19),
      expression: EXPRESSIONS[Math.floor(rng() * EXPRESSIONS.length)],
      fatigueAi: ai,
      subjectiveFatigue: subj,
      subjectiveFocus:
        SUBJECTIVE_FOCUSES[Math.floor(rng() * SUBJECTIVE_FOCUSES.length)],
      bodyPart: BODY_PARTS[Math.floor(rng() * BODY_PARTS.length)],
      careVideoTitle:
        carePool && rng() > 0.3
          ? carePool[Math.floor(rng() * carePool.length)]
          : undefined,
      careCompleted: carePool ? rng() > 0.35 : undefined,
    })
  }

  return records
}

const baseUsers: Omit<User, "activityLog">[] = [
  // 店舗A (companyId 1) — 8 users
  {
    id: 1,
    name: "山田 太郎",
    companyId: 1,
    plan: "Premium",
    expression: "おだやか",
    fatigueAi: "いつも通り",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "集中しやすい",
    bodyPart: "上半身",
    lastAnalysisAt: "2026-05-13T09:12:00",
  },
  {
    id: 2,
    name: "鈴木 花子",
    companyId: 1,
    plan: "Member",
    expression: "張り(弱)",
    fatigueAi: "軽やか",
    subjectiveFatigue: "あまり疲れていない",
    subjectiveFocus: "集中しやすい",
    bodyPart: "特に気になるところはない",
    lastAnalysisAt: "2026-05-13T08:30:00",
  },
  {
    // Member→Premium に変更(Premium のみ fatigue 両方を持つため、
    // 規格 3-1「主観 vs AI 落差」警告 demo は Premium ユーザーで実演)
    id: 3,
    name: "佐藤 一郎",
    companyId: 1,
    plan: "Premium",
    expression: "ゆらぎ(強)",
    fatigueAi: "軽やか", // AI = 軽い
    subjectiveFatigue: "だいぶ疲れている", // 本人 = 強い疲労感(gap 4)
    subjectiveFocus: "集中しづらい",
    bodyPart: "上半身",
    lastAnalysisAt: "2026-05-12T19:45:00",
  },
  {
    id: 4,
    name: "田中 美咲",
    companyId: 1,
    plan: "Guest",
    expression: "おだやか",
    fatigueAi: "ややお疲れ",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "どちらともいえない",
    bodyPart: "体幹部",
    lastAnalysisAt: "2026-05-13T11:05:00",
  },
  {
    id: 5,
    name: "高橋 健太",
    companyId: 1,
    plan: "Premium",
    expression: "張り(強)",
    fatigueAi: "軽やか",
    subjectiveFatigue: "あまり疲れていない",
    subjectiveFocus: "集中しやすい",
    bodyPart: "なんとなく全体",
    lastAnalysisAt: "2026-05-13T07:20:00",
  },
  {
    id: 6,
    name: "渡辺 ゆかり",
    companyId: 1,
    plan: "Member",
    expression: "ゆらぎ(弱)",
    fatigueAi: "いつも通り",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "どちらともいえない",
    bodyPart: "下半身",
    lastAnalysisAt: "2026-05-12T16:50:00",
  },
  {
    id: 7,
    name: "伊藤 翔",
    companyId: 1,
    plan: "Guest",
    expression: "おだやか",
    fatigueAi: "ややお疲れ",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "集中しづらい",
    bodyPart: "上半身",
    lastAnalysisAt: "2026-05-11T14:00:00",
  },
  {
    id: 8,
    name: "中村 さくら",
    companyId: 1,
    plan: "Guest",
    expression: "張り(弱)",
    fatigueAi: "軽やか",
    subjectiveFatigue: "あまり疲れていない",
    subjectiveFocus: "集中しやすい",
    bodyPart: "特に気になるところはない",
    lastAnalysisAt: "2026-05-13T10:15:00",
  },

  // KOL B (companyId 2) — 6 users
  {
    id: 9,
    name: "小林 直樹",
    companyId: 2,
    plan: "Premium",
    expression: "張り(強)",
    fatigueAi: "いつも通り",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "集中しやすい",
    bodyPart: "なんとなく全体",
    lastAnalysisAt: "2026-05-13T09:00:00",
  },
  {
    id: 10,
    name: "加藤 麻衣",
    companyId: 2,
    plan: "Guest",
    expression: "おだやか",
    fatigueAi: "軽やか",
    subjectiveFatigue: "あまり疲れていない",
    subjectiveFocus: "集中しやすい",
    bodyPart: "特に気になるところはない",
    lastAnalysisAt: "2026-05-12T22:30:00",
  },
  {
    // Member→Premium に変更(同上、KOL B 配下の gap demo として保持)
    id: 11,
    name: "吉田 大輔",
    companyId: 2,
    plan: "Premium",
    expression: "張り(強)",
    fatigueAi: "踏ん張りどき", // AI = 強い疲労
    subjectiveFatigue: "あまり疲れていない", // 本人 = 元気(gap 4)
    subjectiveFocus: "集中しやすい",
    bodyPart: "なんとなく全体",
    lastAnalysisAt: "2026-05-13T06:45:00",
  },
  {
    id: 12,
    name: "山本 結衣",
    companyId: 2,
    plan: "Member",
    expression: "ゆらぎ(弱)",
    fatigueAi: "ややお疲れ",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "どちらともいえない",
    bodyPart: "上半身",
    lastAnalysisAt: "2026-05-12T20:10:00",
  },
  {
    id: 13,
    name: "佐々木 慎",
    companyId: 2,
    plan: "Guest",
    expression: "おだやか",
    fatigueAi: "いつも通り",
    subjectiveFatigue: "あまり疲れていない",
    subjectiveFocus: "集中しやすい",
    bodyPart: "下半身",
    lastAnalysisAt: "2026-05-13T08:00:00",
  },
  {
    id: 14,
    name: "松本 美穂",
    companyId: 2,
    plan: "Guest",
    expression: "張り(弱)",
    fatigueAi: "蓄積しています",
    subjectiveFatigue: "だいぶ疲れている",
    subjectiveFocus: "集中しづらい",
    bodyPart: "体幹部",
    lastAnalysisAt: "2026-05-13T11:30:00",
  },

  // 企業X (companyId 3) — 8 users
  {
    id: 15,
    name: "井上 拓海",
    companyId: 3,
    plan: "Guest",
    expression: "おだやか",
    fatigueAi: "いつも通り",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "どちらともいえない",
    bodyPart: "上半身",
    lastAnalysisAt: "2026-05-13T09:30:00",
  },
  {
    id: 16,
    name: "木村 葵",
    companyId: 3,
    plan: "Premium",
    expression: "張り(弱)",
    fatigueAi: "軽やか",
    subjectiveFatigue: "あまり疲れていない",
    subjectiveFocus: "集中しやすい",
    bodyPart: "特に気になるところはない",
    lastAnalysisAt: "2026-05-13T08:45:00",
  },
  {
    id: 17,
    name: "林 啓介",
    companyId: 3,
    plan: "Member",
    expression: "張り(強)",
    fatigueAi: "ややお疲れ", // AI = やや疲れ
    subjectiveFatigue: "あまり疲れていない", // 本人 = 元気(gap 2)
    subjectiveFocus: "集中しやすい",
    bodyPart: "なんとなく全体",
    lastAnalysisAt: "2026-05-12T18:20:00",
  },
  {
    id: 18,
    name: "斎藤 沙耶",
    companyId: 3,
    plan: "Member",
    expression: "ゆらぎ(弱)",
    fatigueAi: "いつも通り",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "どちらともいえない",
    bodyPart: "下半身",
    lastAnalysisAt: "2026-05-13T10:00:00",
  },
  {
    id: 19,
    name: "清水 隆志",
    companyId: 3,
    plan: "Member",
    expression: "おだやか",
    fatigueAi: "ややお疲れ",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "集中しづらい",
    bodyPart: "体幹部",
    lastAnalysisAt: "2026-05-13T11:15:00",
  },
  {
    id: 20,
    name: "山崎 香織",
    companyId: 3,
    plan: "Guest",
    expression: "張り(弱)",
    fatigueAi: "軽やか",
    subjectiveFatigue: "あまり疲れていない",
    subjectiveFocus: "集中しやすい",
    bodyPart: "特に気になるところはない",
    lastAnalysisAt: "2026-05-12T17:30:00",
  },
  {
    id: 21,
    name: "森 雄太",
    companyId: 3,
    plan: "Guest",
    expression: "ゆらぎ(強)",
    fatigueAi: "蓄積しています",
    subjectiveFatigue: "だいぶ疲れている",
    subjectiveFocus: "集中しづらい",
    bodyPart: "上半身",
    lastAnalysisAt: "2026-05-13T07:00:00",
  },
  {
    id: 22,
    name: "阿部 萌",
    companyId: 3,
    plan: "Guest",
    expression: "おだやか",
    fatigueAi: "いつも通り",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "どちらともいえない",
    bodyPart: "なんとなく全体",
    lastAnalysisAt: "2026-05-13T09:50:00",
  },

  // 企業Y (companyId 4) — 8 users
  {
    id: 23,
    name: "池田 浩二",
    companyId: 4,
    plan: "Guest",
    expression: "張り(弱)",
    fatigueAi: "軽やか",
    subjectiveFatigue: "あまり疲れていない",
    subjectiveFocus: "集中しやすい",
    bodyPart: "特に気になるところはない",
    lastAnalysisAt: "2026-05-13T08:10:00",
  },
  {
    id: 24,
    name: "橋本 真理子",
    companyId: 4,
    plan: "Premium",
    expression: "おだやか",
    fatigueAi: "いつも通り",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "どちらともいえない",
    bodyPart: "上半身",
    lastAnalysisAt: "2026-05-13T10:25:00",
  },
  {
    id: 25,
    name: "山下 翔太",
    companyId: 4,
    plan: "Member",
    expression: "張り(強)",
    fatigueAi: "蓄積しています", // AI = 蓄積している
    subjectiveFatigue: "あまり疲れていない", // 本人 = 元気(gap 3)
    subjectiveFocus: "集中しやすい",
    bodyPart: "なんとなく全体",
    lastAnalysisAt: "2026-05-12T15:40:00",
  },
  {
    id: 26,
    name: "石川 香奈",
    companyId: 4,
    plan: "Member",
    expression: "ゆらぎ(弱)",
    fatigueAi: "ややお疲れ",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "集中しづらい",
    bodyPart: "下半身",
    lastAnalysisAt: "2026-05-13T09:05:00",
  },
  {
    id: 27,
    name: "中島 篤",
    companyId: 4,
    plan: "Guest",
    expression: "おだやか",
    fatigueAi: "いつも通り",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "どちらともいえない",
    bodyPart: "体幹部",
    lastAnalysisAt: "2026-05-13T11:50:00",
  },
  {
    id: 28,
    name: "前田 楓",
    companyId: 4,
    plan: "Guest",
    expression: "張り(弱)",
    fatigueAi: "軽やか",
    subjectiveFatigue: "あまり疲れていない",
    subjectiveFocus: "集中しやすい",
    bodyPart: "特に気になるところはない",
    lastAnalysisAt: "2026-05-13T07:35:00",
  },
  {
    id: 29,
    name: "藤田 駿",
    companyId: 4,
    plan: "Guest",
    expression: "ゆらぎ(強)",
    fatigueAi: "蓄積しています",
    subjectiveFatigue: "だいぶ疲れている",
    subjectiveFocus: "集中しづらい",
    bodyPart: "上半身",
    lastAnalysisAt: "2026-05-12T21:00:00",
  },
  {
    id: 30,
    name: "後藤 里奈",
    companyId: 4,
    plan: "Guest",
    expression: "おだやか",
    fatigueAi: "ややお疲れ",
    subjectiveFatigue: "少し疲れている",
    subjectiveFocus: "どちらともいえない",
    bodyPart: "なんとなく全体",
    lastAnalysisAt: "2026-05-13T10:40:00",
  },
]

// 規格 1-3 章:Premium のみ fatigue 両方を持つ。
// baseUsers にはデモ用の fatigue 値が定義されているが、Guest / Member は
// undefined に上書き(top-level User と activityLog の latest 両方に反映)。
export const users: User[] = baseUsers.map((u) => {
  const isPremium = u.plan === "Premium"
  const fatigueAi = isPremium ? u.fatigueAi : undefined
  const subjectiveFatigue = isPremium ? u.subjectiveFatigue : undefined
  const profile = generateProfile(u.id * 211 + 13, u.plan)
  return {
    ...u,
    fatigueAi,
    subjectiveFatigue,
    gender: profile.gender,
    birthDate: profile.birthDate,
    activityLog: generateActivityLog(u.id * 137 + 31, u.plan, {
      analyzedAt: u.lastAnalysisAt,
      expression: u.expression,
      fatigueAi,
      subjectiveFatigue,
      subjectiveFocus: u.subjectiveFocus,
      bodyPart: u.bodyPart,
    }),
  }
})

export function getUsersByCompany(companyId: number): User[] {
  return users.filter((u) => u.companyId === companyId)
}

export function getUserById(id: number): User | undefined {
  return users.find((u) => u.id === id)
}

// ─────────────────────────────────────────────────────────────
// 分析実行数 / 1 user 平均分析回数(規格 v1 2-1)
// ─────────────────────────────────────────────────────────────

const ANALYSIS_END_DATE_MS = new Date("2026-05-13T23:59:59Z").getTime()

export type AnalysisStats = {
  total: number // 期間内の分析実行件数(activityLog エントリ数)
  perUser: number // 1 user 平均分析回数(total / 対象ユーザー数)
}

// activityLog の analyzedAt が「過去 N 日内」のエントリを scope ユーザーで集計。
// scope が空の場合は perUser = 0 を返す。
export function getAnalysisStats(
  scopedUsers: User[],
  daysBack: number = 30
): AnalysisStats {
  const cutoffMs = ANALYSIS_END_DATE_MS - daysBack * 86400000
  let total = 0
  for (const u of scopedUsers) {
    for (const r of u.activityLog) {
      if (new Date(r.analyzedAt + "Z").getTime() >= cutoffMs) total++
    }
  }
  const perUser = scopedUsers.length === 0 ? 0 : total / scopedUsers.length
  return { total, perUser }
}

// ─────────────────────────────────────────────────────────────
// 初回 → 2 回目 転換率(規格 v1 2-1)
// ─────────────────────────────────────────────────────────────

export type OnboardingStats = {
  signedUp: number // 期間内に新規登録した user 数(mock では scopedUsers.length とみなす)
  returned: number // うち 2 回目分析まで到達した user 数
  rate: number // returned / signedUp(0-1)
}

// Mock 近似:user.id ベースで deterministic に「2 回目到達」を判定。
// 真實 backend では:
//   分子 = COUNT(DISTINCT user_id) WHERE signup_date >= now()-30d AND analyses_count >= 2
//   分母 = COUNT(DISTINCT user_id) WHERE signup_date >= now()-30d
// 規格 v1 2-1「初回→2回目転換率」対応、KNOWN_ISSUES.md C-2 で詳細記述。
export function getOnboardingConversionStats(
  scopedUsers: User[]
): OnboardingStats {
  const signedUp = scopedUsers.length
  // user.id % 3 !== 0 を「2 回目到達」とみなす(mock 上 約 2/3 が return)
  const returned = scopedUsers.filter((u) => u.id % 3 !== 0).length
  return {
    signedUp,
    returned,
    rate: signedUp === 0 ? 0 : returned / signedUp,
  }
}
