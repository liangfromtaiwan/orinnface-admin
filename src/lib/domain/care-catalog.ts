/**
 * care 動画 固定 13 枠 (仕様書 v1.0 §7)
 *
 * 🔴 V1 はこの 13 枠だけを実装する。slot の新設・14 番目の枠・
 *    「はじめて向け」枠を追加しない。
 * 🚫 training_videos / facial_training / is_starter / release を
 *    V1 の新規実装名に使わない。
 *
 * ユーザー向け機能名は「顔トレ」を維持し、内部総称は care video とする。
 */

import type { CareVideoSlot, PlanCode, PoseCode } from "./types"

const MEMBER_UP: PlanCode[] = ["member", "premium"]
const PREMIUM_ONLY: PlanCode[] = ["premium"]

export const CARE_VIDEO_SLOTS: CareVideoSlot[] = [
  {
    videoCode: "care_orientation",
    category: "orientation",
    // 仕様書 §7 の表では 対象 は「—」(動作に紐づかない案内動画)
    targetLabel: "—",
    // §16 P1 未決: care_orientation の表示面・権限は動画仕様と Figma 待ち。
    requiredPlans: ["guest", "member", "premium"],
  },

  // 1分 (Member / Premium)
  { videoCode: "care_1m_smile", category: "1m", targetLabel: "いー", poseCode: "smile", requiredPlans: MEMBER_UP },
  { videoCode: "care_1m_pucker", category: "1m", targetLabel: "うー", poseCode: "pucker", requiredPlans: MEMBER_UP },
  { videoCode: "care_1m_jaw_open", category: "1m", targetLabel: "あー", poseCode: "jaw_open", requiredPlans: MEMBER_UP },
  { videoCode: "care_1m_eye_open", category: "1m", targetLabel: "目", poseCode: "eye_open", requiredPlans: MEMBER_UP },
  { videoCode: "care_1m_brow_furrow", category: "1m", targetLabel: "眉間", poseCode: "brow_furrow", requiredPlans: MEMBER_UP },

  // 3分 (Premium)
  { videoCode: "care_3m_smile", category: "3m", targetLabel: "いー", poseCode: "smile", requiredPlans: PREMIUM_ONLY },
  { videoCode: "care_3m_pucker", category: "3m", targetLabel: "うー", poseCode: "pucker", requiredPlans: PREMIUM_ONLY },
  { videoCode: "care_3m_jaw_open", category: "3m", targetLabel: "あー", poseCode: "jaw_open", requiredPlans: PREMIUM_ONLY },
  { videoCode: "care_3m_eye_open", category: "3m", targetLabel: "目", poseCode: "eye_open", requiredPlans: PREMIUM_ONLY },
  { videoCode: "care_3m_brow_furrow", category: "3m", targetLabel: "眉間", poseCode: "brow_furrow", requiredPlans: PREMIUM_ONLY },

  // 専門 (Premium)
  { videoCode: "lymph_care", category: "specialist", targetLabel: "リンパ", requiredPlans: PREMIUM_ONLY },
  { videoCode: "nerve_approach", category: "specialist", targetLabel: "神経", requiredPlans: PREMIUM_ONLY },
]

/**
 * 枠数が 13 から動いていないことを検証する (仕様書 v1.0 §7)。
 * `npm run smoke` から呼ばれる。slot を増減したくなったら、まず仕様書を確認すること。
 */
export function assertCareSlotInvariant(): void {
  if (CARE_VIDEO_SLOTS.length !== 13) {
    throw new Error(
      `care slot は固定 13 枠。現在 ${CARE_VIDEO_SLOTS.length} 枠 (仕様書 v1.0 §7 違反)`
    )
  }
}

export const CARE_CATEGORY_LABEL: Record<CareVideoSlot["category"], string> = {
  orientation: "案内",
  "1m": "1分",
  "3m": "3分",
  specialist: "専門",
}

/**
 * filter や見出しに出す 1 行ラベル。
 * 案内は対象動作を持たないため区分だけを返す(「案内 案内」にならないように)。
 */
export function careSlotLabel(slot: CareVideoSlot): string {
  return slot.category === "orientation"
    ? CARE_CATEGORY_LABEL[slot.category]
    : `${CARE_CATEGORY_LABEL[slot.category]} ${slot.targetLabel}`
}

const BY_CODE = new Map(CARE_VIDEO_SLOTS.map((s) => [s.videoCode, s]))

export function getCareSlot(videoCode: string): CareVideoSlot | undefined {
  return BY_CODE.get(videoCode)
}

/** 動作 → 尺 で枠を引く。プラン別は尺だけを切り替える (AI推奨 v1.2)。 */
export function careSlotFor(
  poseCode: Exclude<PoseCode, "neutral">,
  duration: "1m" | "3m"
): CareVideoSlot | undefined {
  return CARE_VIDEO_SLOTS.find(
    (s) => s.poseCode === poseCode && s.category === duration
  )
}

/* ------------------------------------------------------------------ *
 * 会員権限 (§7.2)
 * ------------------------------------------------------------------ */

export type CareEntitlement = {
  /** 再生できるか。Guest は不可。 */
  canPlay: boolean
  /** Guest は推奨 2 件を lock 表示 + 登録 CTA。非表示にはしない。 */
  showLockedWithCta: boolean
  /** JST 暦月あたりの上限。null = 商品上無制限。 */
  monthlyLimit: number | null
  durations: ("1m" | "3m")[]
  specialist: boolean
}

/**
 * 🔴 実際の判定は Backend entitlement が正 (§15 受入条件)。
 *    ここは管理画面で「その顧客に何が見えているはずか」を説明表示するためのもの。
 */
export function careEntitlement(plan: PlanCode): CareEntitlement {
  switch (plan) {
    case "guest":
      return {
        canPlay: false,
        showLockedWithCta: true,
        monthlyLimit: 0,
        durations: [],
        specialist: false,
      }
    case "member":
      return {
        canPlay: true,
        showLockedWithCta: false,
        monthlyLimit: 10,
        durations: ["1m"],
        specialist: false,
      }
    case "premium":
      return {
        canPlay: true,
        showLockedWithCta: false,
        monthlyLimit: null,
        durations: ["1m", "3m"],
        specialist: true,
      }
  }
}

export function planCanUseSlot(plan: PlanCode, slot: CareVideoSlot): boolean {
  return slot.requiredPlans.includes(plan)
}
