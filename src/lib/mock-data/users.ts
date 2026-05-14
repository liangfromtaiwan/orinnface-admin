import type { ActivityRecord, User } from "./types"
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

const CARE_VIDEOS = [
  "肩こり解消ストレッチ",
  "首回り軽体操",
  "全身リラックス瞑想",
  "腰痛改善ヨガ",
  "目の疲れケア",
  "腹式呼吸エクササイズ",
]

function generateActivityLog(
  seed: number,
  latest: Omit<ActivityRecord, "careVideoTitle" | "careCompleted">
): ActivityRecord[] {
  const rng = mulberry32(seed)
  const count = 6 + Math.floor(rng() * 3) // 6-8 件

  const records: ActivityRecord[] = [
    {
      ...latest,
      careVideoTitle: CARE_VIDEOS[Math.floor(rng() * CARE_VIDEOS.length)],
      careCompleted: rng() > 0.3,
    },
  ]

  let cursorMs = new Date(latest.analyzedAt + "Z").getTime()
  for (let i = 1; i < count; i++) {
    const daysBack = 2 + Math.floor(rng() * 5)
    cursorMs -= daysBack * 86400000
    const dt = new Date(cursorMs)
    dt.setUTCHours(8 + Math.floor(rng() * 12), Math.floor(rng() * 60), 0, 0)

    const aiLevel = Math.floor(rng() * 5)
    const ai = FATIGUES[aiLevel]

    // 25% 強制落差(警告色テスト用)、それ以外は AI レベルに近い主観
    let subj: (typeof SUBJECTIVE_FATIGUES)[number]
    if (rng() < 0.25) {
      subj = aiLevel < 2 ? SUBJECTIVE_FATIGUES[2] : SUBJECTIVE_FATIGUES[0]
    } else {
      const subjIdx = aiLevel < 2 ? 0 : aiLevel < 4 ? 1 : 2
      subj = SUBJECTIVE_FATIGUES[subjIdx]
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
        rng() > 0.3
          ? CARE_VIDEOS[Math.floor(rng() * CARE_VIDEOS.length)]
          : undefined,
      careCompleted: rng() > 0.35,
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
    id: 3,
    name: "佐藤 一郎",
    companyId: 1,
    plan: "Member",
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
    id: 11,
    name: "吉田 大輔",
    companyId: 2,
    plan: "Member",
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

export const users: User[] = baseUsers.map((u) => ({
  ...u,
  activityLog: generateActivityLog(u.id * 137 + 31, {
    analyzedAt: u.lastAnalysisAt,
    expression: u.expression,
    fatigueAi: u.fatigueAi,
    subjectiveFatigue: u.subjectiveFatigue,
    subjectiveFocus: u.subjectiveFocus,
    bodyPart: u.bodyPart,
  }),
}))

export function getUsersByCompany(companyId: number): User[] {
  return users.filter((u) => u.companyId === companyId)
}

export function getUserById(id: number): User | undefined {
  return users.find((u) => u.id === id)
}
