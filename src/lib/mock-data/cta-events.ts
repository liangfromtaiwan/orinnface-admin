import type { CTAEvent, CTATiming, CTAType } from "./types"
import { CTA_TIMINGS, CTA_TIMING_TO_TYPE } from "./types"
import { users } from "./users"

const END_DATE_MS = new Date("2026-05-13T00:00:00Z").getTime()
const WINDOW_DAYS = 30

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

// timing 別の発火率パラメータ:
// - click:    CTA を見たユーザーが押す確率
// - convert:  押した場合に実際に登録/課金まで進む確率
// 規格背景:強制系(M-3 / G-3)は離脱を防ぐため押下率が高い、
// 7-10 回目訴求(M-2)は摩擦少なく頻度高 = 押下率低めに調整。
const TIMING_RATES: Record<
  CTATiming,
  { click: number; convertIfClick: number }
> = {
  after_survey: { click: 0.32, convertIfClick: 0.35 },
  before_care: { click: 0.38, convertIfClick: 0.4 },
  daily_limit: { click: 0.65, convertIfClick: 0.5 },
  video_7_to_8: { click: 0.35, convertIfClick: 0.35 },
  video_7_to_10_each: { click: 0.3, convertIfClick: 0.3 },
  monthly_limit: { click: 0.92, convertIfClick: 0.6 },
  day_30: { click: 0.38, convertIfClick: 0.4 },
}

// プラン別の timing 出現プール(重みあり、配列内出現回数 = 重み)
const GUEST_TIMING_POOL: CTATiming[] = [
  "after_survey",
  "after_survey",
  "after_survey",
  "after_survey",
  "after_survey",
  "before_care",
  "before_care",
  "before_care",
  "daily_limit",
]
const MEMBER_TIMING_POOL: CTATiming[] = [
  "video_7_to_8",
  "video_7_to_10_each",
  "video_7_to_10_each",
  "video_7_to_10_each",
  "video_7_to_10_each",
  "video_7_to_10_each",
  "monthly_limit",
  "day_30",
]
// Premium ユーザーは過去 30 日に M-* を踏んで convert したストーリー
const PREMIUM_TIMING_POOL: CTATiming[] = [
  "video_7_to_8",
  "video_7_to_10_each",
  "video_7_to_10_each",
  "video_7_to_10_each",
  "monthly_limit",
  "day_30",
]

function generateAllEvents(): CTAEvent[] {
  const rng = mulberry32(99)
  const events: CTAEvent[] = []
  let counter = 1

  for (const user of users) {
    let pool: CTATiming[]
    let count: number

    if (user.plan === "Guest") {
      pool = GUEST_TIMING_POOL
      count = 8 + Math.floor(rng() * 8) // 8-15
    } else if (user.plan === "Member") {
      pool = MEMBER_TIMING_POOL
      count = 6 + Math.floor(rng() * 7) // 6-12
    } else {
      pool = PREMIUM_TIMING_POOL
      count = 3 + Math.floor(rng() * 4) // 3-6
    }

    for (let i = 0; i < count; i++) {
      const timing = pool[Math.floor(rng() * pool.length)]
      const ctaType = CTA_TIMING_TO_TYPE[timing]
      const rates = TIMING_RATES[timing]

      const clicked = rng() < rates.click
      const converted = clicked && rng() < rates.convertIfClick

      // 30 日内のランダムな日時(1〜29 日前)
      const daysBack = 1 + Math.floor(rng() * (WINDOW_DAYS - 1))
      const hour = 9 + Math.floor(rng() * 12)
      const minute = Math.floor(rng() * 60)
      const dt = new Date(END_DATE_MS - daysBack * 86400000)
      dt.setUTCHours(hour, minute, 0, 0)
      const triggeredAt = dt.toISOString().slice(0, 19)

      let convertedAt: string | undefined
      if (converted) {
        // クリック後 0〜3 時間以内に転換
        const offsetMs = Math.floor(rng() * 3 * 60 * 60 * 1000)
        convertedAt = new Date(dt.getTime() + offsetMs)
          .toISOString()
          .slice(0, 19)
      }

      events.push({
        id: `cta-${counter++}`,
        userId: user.id,
        ctaType,
        ctaTiming: timing,
        triggeredAt,
        clicked,
        converted,
        convertedAt,
      })
    }
  }

  return events.sort((a, b) => a.triggeredAt.localeCompare(b.triggeredAt))
}

export const allCTAEvents: CTAEvent[] = generateAllEvents()

// ─────────────────────────────────────────────────────────────
// Scope / company filter
// ─────────────────────────────────────────────────────────────

export function getCTAEventsForScope(
  scopeUserIds: number[] | "all"
): CTAEvent[] {
  if (scopeUserIds === "all") return allCTAEvents
  const set = new Set(scopeUserIds)
  return allCTAEvents.filter((e) => set.has(e.userId))
}

export function getCTAEventsByCompany(companyId: number): CTAEvent[] {
  const userIds = users
    .filter((u) => u.companyId === companyId)
    .map((u) => u.id)
  return getCTAEventsForScope(userIds)
}

// ─────────────────────────────────────────────────────────────
// KPI helpers
// ─────────────────────────────────────────────────────────────

export type CTAStats = {
  triggered: number
  clicked: number
  converted: number
  cvr: number // converted / triggered
}

function emptyStats(): CTAStats {
  return { triggered: 0, clicked: 0, converted: 0, cvr: 0 }
}

export function getCTAStats(
  events: CTAEvent[],
  ctaType: CTAType,
  daysBack: number = WINDOW_DAYS
): CTAStats {
  const cutoffMs = END_DATE_MS - daysBack * 86400000
  const stats = emptyStats()
  for (const e of events) {
    if (e.ctaType !== ctaType) continue
    if (new Date(e.triggeredAt + "Z").getTime() < cutoffMs) continue
    stats.triggered++
    if (e.clicked) stats.clicked++
    if (e.converted) stats.converted++
  }
  stats.cvr = stats.triggered === 0 ? 0 : stats.converted / stats.triggered
  return stats
}

export function getCTAStatsByTiming(
  events: CTAEvent[],
  daysBack: number = WINDOW_DAYS
): Map<CTATiming, CTAStats> {
  const cutoffMs = END_DATE_MS - daysBack * 86400000
  const map = new Map<CTATiming, CTAStats>()
  for (const t of CTA_TIMINGS) map.set(t, emptyStats())

  for (const e of events) {
    if (new Date(e.triggeredAt + "Z").getTime() < cutoffMs) continue
    const stat = map.get(e.ctaTiming)
    if (!stat) continue
    stat.triggered++
    if (e.clicked) stat.clicked++
    if (e.converted) stat.converted++
  }
  for (const stat of map.values()) {
    stat.cvr = stat.triggered === 0 ? 0 : stat.converted / stat.triggered
  }
  return map
}
