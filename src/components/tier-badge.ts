/**
 * 段階を表すバッジの見た目 (3 段)
 *
 * プラン(Guest/Member/Premium)と契約状態(解約/停止中/契約中)で共用する。
 * どちらも「弱い ← → 強い」の順序を持つので、同じ語彙で描く。
 *
 * 🔴 段階は色ではなく**塗りの有無**で表す。塗りを持つのは最上位だけなので、
 *    グレースケールでも色覚特性があっても境界が読める。
 *    文字の太さも normal → medium → semibold と変えて手がかりを二重にする。
 * 🔴 行の主役は名前・会社名なので、バッジがそれより目立たない濃さに留める。
 */

import type { Company, PlanCode } from "@/lib/domain/types"

export const TIER_BADGE = {
  /** 最下位。灰の線のみ */
  none: "border-border bg-transparent font-normal text-muted-foreground",
  /** 中間。青の線のみ */
  outline:
    "border-blue-300 bg-transparent font-medium text-blue-700 dark:border-blue-800 dark:text-blue-300",
  /** 最上位。青の塗り */
  fill: "border-blue-300 bg-blue-100 font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-200",
} as const

export type TierStep = keyof typeof TIER_BADGE

/* 段階の割り当ても同じ場所に置く。塗りを持つのは各系列で 1 つだけ。 */

/** プラン。有料の Premium だけが塗りを持つ。 */
export const PLAN_STEP: Record<PlanCode, TierStep> = {
  guest: "none",
  member: "outline",
  premium: "fill",
}

/** 契約状態。契約が生きている active だけが塗りを持つ。 */
export const CONTRACT_STEP: Record<Company["contractStatus"], TierStep> = {
  active: "fill",
  suspended: "outline",
  terminated: "none",
}
