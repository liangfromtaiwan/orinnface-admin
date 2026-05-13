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

function buildDaily(seed: number, baseNewPremium: number, baseLostPremium: number) {
  const rng = mulberry32(seed)
  const result: PlanStats["daily"] = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDateOffsetDaysBack(END_DATE, i)
    const newPremium = Math.max(
      0,
      Math.round(baseNewPremium * (0.5 + rng() * 1.1))
    )
    const lostPremium = Math.max(
      0,
      Math.round(baseLostPremium * (0.4 + rng() * 1.2))
    )
    result.push({ date, newPremium, lostPremium })
  }
  return result
}

// Premium 加入は健全な成長を示すため、離脱より明確に多めに設定
const BASE_BY_COMPANY: Record<number, { newP: number; lostP: number }> = {
  1: { newP: 1.0, lostP: 0.4 },
  2: { newP: 0.7, lostP: 0.3 },
  3: { newP: 1.5, lostP: 0.5 },
  4: { newP: 1.2, lostP: 0.4 },
}

export const plansByCompany: Record<number, PlanStats> = Object.fromEntries(
  Object.entries(BASE_BY_COMPANY).map(([id, base]) => {
    const cid = Number(id)
    return [
      cid,
      {
        current: currentByCompany(cid),
        daily: buildDaily(200 + cid, base.newP, base.lostP),
      } satisfies PlanStats,
    ]
  })
)

export const globalPlans: PlanStats = {
  current: currentByCompany(0),
  daily: Array.from({ length: DAYS }, (_, i) => {
    const dailyByCompany = Object.values(plansByCompany).map((p) => p.daily[i])
    return {
      date: dailyByCompany[0].date,
      newPremium: dailyByCompany.reduce((s, d) => s + d.newPremium, 0),
      lostPremium: dailyByCompany.reduce((s, d) => s + d.lostPremium, 0),
    }
  }),
}

export function getPlanStats(companyId: number): PlanStats {
  if (companyId === 0) return globalPlans
  return (
    plansByCompany[companyId] ?? {
      current: { Guest: 0, Member: 0, Premium: 0 },
      daily: [],
    }
  )
}
