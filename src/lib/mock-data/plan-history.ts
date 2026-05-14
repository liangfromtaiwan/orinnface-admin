import type { Plan, PlanChangeEvent } from "./types"
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

// 30 日間の目標イベント分布(force-count、SaaS 漏斗ファネルを模擬):
// - 2 件 M→P(Premium 新規アップグレード)
// - 1 件 P→M(Premium 解約 ≒ ダウングレード)
// - 2 件 G→M(無料登録ストーリー)
// - 2 件 M→G(Member 離脱ストーリー)
// 結果:Premium 期初 4 → 現在 5(net +1)、チャーン率 25%(1/4 small base)
const EVENT_TARGETS = {
  upgradeMtoP: 2,
  lossPtoM: 1,
  registerGtoM: 2,
  dropMtoG: 2,
} as const

function generateAllEvents(): PlanChangeEvent[] {
  const rng = mulberry32(42)
  const events: PlanChangeEvent[] = []

  const premiumUsers = users.filter((u) => u.plan === "Premium")
  const memberUsers = users.filter((u) => u.plan === "Member")
  const guestUsers = users.filter((u) => u.plan === "Guest")

  function pickDate(): string {
    // 30 日間にバラけるように分布:3〜28 日前
    const daysBack = 3 + Math.floor(rng() * 25)
    const hour = 9 + Math.floor(rng() * 10)
    const minute = Math.floor(rng() * 60)
    const dt = new Date(END_DATE_MS - daysBack * 86400000)
    dt.setUTCHours(hour, minute, 0, 0)
    return dt.toISOString().slice(0, 19)
  }

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  // 1) 3 件 M→P:現在 Premium のユーザーから 3 名選出(30 日前は Member だった)
  for (const u of shuffle(premiumUsers).slice(0, EVENT_TARGETS.upgradeMtoP)) {
    events.push({
      userId: u.id,
      changedAt: pickDate(),
      fromPlan: "Member",
      toPlan: "Premium",
    })
  }

  // 2) 1 件 P→M:現在 Member のユーザーから 1 名選出(30 日前は Premium だった)
  for (const u of shuffle(memberUsers).slice(0, EVENT_TARGETS.lossPtoM)) {
    events.push({
      userId: u.id,
      changedAt: pickDate(),
      fromPlan: "Premium",
      toPlan: "Member",
    })
  }

  // 3) 3 件 G→M:現在 Member の別ユーザーから 3 名選出(30 日前は Guest)
  const memberIdsUsed = new Set(events.filter((e) => e.toPlan === "Member").map((e) => e.userId))
  const memberCandidates = memberUsers.filter((u) => !memberIdsUsed.has(u.id))
  for (const u of shuffle(memberCandidates).slice(0, EVENT_TARGETS.registerGtoM)) {
    events.push({
      userId: u.id,
      changedAt: pickDate(),
      fromPlan: "Guest",
      toPlan: "Member",
    })
  }

  // 4) 1 件 M→G:現在 Guest のユーザーから 1 名選出(30 日前は Member だった)
  for (const u of shuffle(guestUsers).slice(0, EVENT_TARGETS.dropMtoG)) {
    events.push({
      userId: u.id,
      changedAt: pickDate(),
      fromPlan: "Member",
      toPlan: "Guest",
    })
  }

  return events.sort((a, b) => a.changedAt.localeCompare(b.changedAt))
}

export const allPlanChangeEvents: PlanChangeEvent[] = generateAllEvents()

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function getPlanChangeEventsForScope(
  scopeUserIds: number[] | "all"
): PlanChangeEvent[] {
  if (scopeUserIds === "all") return allPlanChangeEvents
  const set = new Set(scopeUserIds)
  return allPlanChangeEvents.filter((e) => set.has(e.userId))
}

export function getPlanChangeEventsByCompany(
  companyId: number
): PlanChangeEvent[] {
  const userIds = users
    .filter((u) => u.companyId === companyId)
    .map((u) => u.id)
  return getPlanChangeEventsForScope(userIds)
}

// ある時点の user の plan を逆算
export function getUserPlanAtDate(
  userId: number,
  dateIso: string,
  currentPlan: Plan
): Plan {
  const userEvents = allPlanChangeEvents
    .filter((e) => e.userId === userId)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt))

  if (userEvents.length === 0) return currentPlan

  // 全イベントより前 → 最初の fromPlan
  if (dateIso < userEvents[0].changedAt) return userEvents[0].fromPlan

  // 該当日に到達するまで toPlan を辿る
  let plan = userEvents[0].fromPlan
  for (const e of userEvents) {
    if (e.changedAt <= dateIso) plan = e.toPlan
    else break
  }
  return plan
}

// 過去 N 日間の プラン構成 推移
export type PlanTimeSeriesRow = {
  date: string
  Guest: number
  Member: number
  Premium: number
}

export function buildPlanTimeSeries(
  scopeUserIds: number[] | "all",
  days = WINDOW_DAYS
): PlanTimeSeriesRow[] {
  const userList =
    scopeUserIds === "all"
      ? users
      : users.filter((u) => scopeUserIds.includes(u.id))

  const series: PlanTimeSeriesRow[] = []
  for (let i = days - 1; i >= 0; i--) {
    const ms = END_DATE_MS - i * 86400000
    const dateStr = new Date(ms).toISOString().slice(0, 10)
    const isoForCompare = `${dateStr}T23:59:59`
    const counts: Record<Plan, number> = { Guest: 0, Member: 0, Premium: 0 }
    for (const u of userList) {
      const plan = getUserPlanAtDate(u.id, isoForCompare, u.plan)
      counts[plan]++
    }
    series.push({ date: dateStr, ...counts })
  }
  return series
}

// 過去 N 日の チャーン率 = (期間中の Premium 離脱件数) / (期間開始時の Premium 数)
export function calculateChurnRate(
  scopeUserIds: number[] | "all",
  days = WINDOW_DAYS
): number {
  const userList =
    scopeUserIds === "all"
      ? users
      : users.filter((u) => scopeUserIds.includes(u.id))

  const startMs = END_DATE_MS - days * 86400000
  const startIso = new Date(startMs).toISOString().slice(0, 19)

  const initialPremium = userList.filter(
    (u) => getUserPlanAtDate(u.id, startIso, u.plan) === "Premium"
  ).length
  if (initialPremium === 0) return 0

  const churnEvents = allPlanChangeEvents.filter(
    (e) =>
      userList.some((u) => u.id === e.userId) &&
      e.fromPlan === "Premium" &&
      e.toPlan !== "Premium"
  )
  return churnEvents.length / initialPremium
}

// 過去 N 日の Premium 純増 = (Premium 入 - Premium 出)
export function calculateNetPremiumChange(
  scopeUserIds: number[] | "all"
): number {
  const events = getPlanChangeEventsForScope(scopeUserIds)
  const gained = events.filter(
    (e) => e.toPlan === "Premium" && e.fromPlan !== "Premium"
  ).length
  const lost = events.filter(
    (e) => e.fromPlan === "Premium" && e.toPlan !== "Premium"
  ).length
  return gained - lost
}

// プラン変更イベントの種別判定(表示用)
export type ChangeKind = "upgrade" | "downgrade" | "cancel" | "reactivate"

const PLAN_RANK: Record<Plan, number> = { Guest: 0, Member: 1, Premium: 2 }

export function classifyChange(e: PlanChangeEvent): ChangeKind {
  const from = PLAN_RANK[e.fromPlan]
  const to = PLAN_RANK[e.toPlan]
  if (e.toPlan === "Guest") return "cancel"
  if (e.fromPlan === "Guest" && to > 0) return "reactivate"
  if (to > from) return "upgrade"
  return "downgrade"
}

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  upgrade: "アップグレード",
  downgrade: "ダウングレード",
  cancel: "解約",
  reactivate: "再開",
}
