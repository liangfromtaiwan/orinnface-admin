import type { Plan, PlanStats } from "./types"
import { PLANS } from "./types"
import { users } from "./users"

const END_DATE = "2026-05-13"
const DAYS = 30

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

function isoDateOffsetDaysBack(end: string, offsetBack: number): string {
  const d = new Date(end + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() - offsetBack)
  return d.toISOString().slice(0, 10)
}

function currentByCompany(companyId: number): Record<Plan, number> {
  const list = companyId === 0 ? users : users.filter((u) => u.companyId === companyId)
  const base = PLANS.reduce(
    (acc, p) => {
      acc[p] = 0
      return acc
    },
    {} as Record<Plan, number>
  )
  for (const u of list) base[u.plan] += 1
  return base
}

function buildDaily(seed: number, baseUpgrades: number, baseCancellations: number) {
  const rng = mulberry32(seed)
  const result: { date: string; upgrades: number; cancellations: number }[] = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDateOffsetDaysBack(END_DATE, i)
    const upgrades = Math.max(0, Math.round(baseUpgrades * (0.6 + rng() * 0.9)))
    const cancellations = Math.max(0, Math.round(baseCancellations * (0.5 + rng() * 0.9)))
    result.push({ date, upgrades, cancellations })
  }
  return result
}

const BASE_BY_COMPANY: Record<number, { up: number; down: number }> = {
  1: { up: 1.4, down: 0.5 },
  2: { up: 1.0, down: 0.4 },
  3: { up: 2.2, down: 0.7 },
  4: { up: 1.8, down: 0.6 },
}

export const plansByCompany: Record<number, PlanStats> = Object.fromEntries(
  Object.entries(BASE_BY_COMPANY).map(([id, base]) => {
    const cid = Number(id)
    return [
      cid,
      {
        current: currentByCompany(cid),
        daily: buildDaily(200 + cid, base.up, base.down),
      } satisfies PlanStats,
    ]
  })
)

export const globalPlans: PlanStats = {
  current: currentByCompany(0),
  daily: Array.from({ length: DAYS }, (_, i) => {
    const date = isoDateOffsetDaysBack(END_DATE, DAYS - 1 - i)
    const upgrades = Object.values(plansByCompany).reduce(
      (s, p) => s + p.daily[i].upgrades,
      0
    )
    const cancellations = Object.values(plansByCompany).reduce(
      (s, p) => s + p.daily[i].cancellations,
      0
    )
    return { date, upgrades, cancellations }
  }),
}

export function getPlanStats(companyId: number): PlanStats {
  if (companyId === 0) return globalPlans
  return plansByCompany[companyId] ?? { current: { Guest: 0, Member: 0, Premium: 0 }, daily: [] }
}
