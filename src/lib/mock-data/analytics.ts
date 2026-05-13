import type { DailyAnalytics, Expression, Fatigue } from "./types"
import { EXPRESSIONS, FATIGUES } from "./types"

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

function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0)
  const raw = weights.map((w) => (w / sum) * total)
  const floored = raw.map((r) => Math.floor(r))
  let remaining = total - floored.reduce((s, x) => s + x, 0)
  const fractions = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < remaining; k++) {
    floored[fractions[k % fractions.length].i] += 1
  }
  return floored
}

function buildSeries(seed: number, baseDau: number): DailyAnalytics[] {
  const rng = mulberry32(seed)
  const series: DailyAnalytics[] = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = isoDateOffsetDaysBack(END_DATE, i)
    const dauJitter = 1 + (rng() - 0.5) * 0.3
    const dau = Math.max(1, Math.round(baseDau * dauJitter))
    const reanalysisRate = 0.45 + (rng() - 0.5) * 0.18
    const careExecutionRate = 0.62 + (rng() - 0.5) * 0.16
    const improvementRate = 0.38 + (rng() - 0.5) * 0.2

    const expressionWeights = [
      0.18 + rng() * 0.06,
      0.22 + rng() * 0.05,
      0.32 + rng() * 0.08,
      0.14 + rng() * 0.05,
      0.14 + rng() * 0.05,
    ]
    const expressionCounts = distribute(dau, expressionWeights)
    const expressionDist = EXPRESSIONS.reduce(
      (acc, key, idx) => {
        acc[key] = expressionCounts[idx]
        return acc
      },
      {} as Record<Expression, number>
    )

    const fatigueWeights = [
      0.22 + rng() * 0.06,
      0.3 + rng() * 0.06,
      0.24 + rng() * 0.06,
      0.14 + rng() * 0.05,
      0.1 + rng() * 0.05,
    ]
    const fatigueCounts = distribute(dau, fatigueWeights)
    const fatigueDist = FATIGUES.reduce(
      (acc, key, idx) => {
        acc[key] = fatigueCounts[idx]
        return acc
      },
      {} as Record<Fatigue, number>
    )

    series.push({
      date,
      dau,
      reanalysisRate: round(reanalysisRate),
      careExecutionRate: round(careExecutionRate),
      improvementRate: round(improvementRate),
      expressionDist,
      fatigueDist,
    })
  }
  return series
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

const COMPANY_BASE_DAU: Record<number, number> = {
  1: 22,
  2: 14,
  3: 38,
  4: 31,
}

export const analyticsByCompany: Record<number, DailyAnalytics[]> = {
  1: buildSeries(101, COMPANY_BASE_DAU[1]),
  2: buildSeries(102, COMPANY_BASE_DAU[2]),
  3: buildSeries(103, COMPANY_BASE_DAU[3]),
  4: buildSeries(104, COMPANY_BASE_DAU[4]),
}

function sumDay(rows: DailyAnalytics[]): DailyAnalytics {
  const dau = rows.reduce((s, r) => s + r.dau, 0)
  const weighted = (key: "reanalysisRate" | "careExecutionRate" | "improvementRate") =>
    round(rows.reduce((s, r) => s + r[key] * r.dau, 0) / Math.max(1, dau))
  const expressionDist = EXPRESSIONS.reduce(
    (acc, key) => {
      acc[key] = rows.reduce((s, r) => s + r.expressionDist[key], 0)
      return acc
    },
    {} as Record<Expression, number>
  )
  const fatigueDist = FATIGUES.reduce(
    (acc, key) => {
      acc[key] = rows.reduce((s, r) => s + r.fatigueDist[key], 0)
      return acc
    },
    {} as Record<Fatigue, number>
  )
  return {
    date: rows[0].date,
    dau,
    reanalysisRate: weighted("reanalysisRate"),
    careExecutionRate: weighted("careExecutionRate"),
    improvementRate: weighted("improvementRate"),
    expressionDist,
    fatigueDist,
  }
}

export const globalAnalytics: DailyAnalytics[] = Array.from({ length: DAYS }, (_, i) => {
  const dayRows = Object.values(analyticsByCompany).map((s) => s[i])
  return sumDay(dayRows)
})

export function getAnalytics(companyId: number): DailyAnalytics[] {
  if (companyId === 0) return globalAnalytics
  return analyticsByCompany[companyId] ?? []
}
