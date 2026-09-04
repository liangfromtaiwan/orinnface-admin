/** 画面共通の期間プリセット (JST 基準)。 */

import { jstDate, jstMonth, type Period } from "./kpi"
import { NOW } from "../mock/seed"

function shiftDays(days: number): string {
  return jstDate(new Date(NOW.getTime() - days * 86_400_000).toISOString())
}

export type PeriodKey = "this_month" | "last_3m" | "last_6m" | "last_12m"

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  this_month: "今月",
  last_3m: "過去3ヶ月",
  last_6m: "過去6ヶ月",
  last_12m: "過去12ヶ月",
}

export function buildPeriod(key: PeriodKey): Period {
  const to = jstDate(NOW.toISOString())
  switch (key) {
    case "this_month": {
      const month = jstMonth(NOW.toISOString())
      return { from: `${month}-01`, to, label: `${month}(JST)` }
    }
    case "last_3m":
      return { from: shiftDays(90), to, label: `${shiftDays(90)} 〜 ${to}(JST)` }
    case "last_6m":
      return { from: shiftDays(180), to, label: `${shiftDays(180)} 〜 ${to}(JST)` }
    case "last_12m":
      return { from: shiftDays(365), to, label: `${shiftDays(365)} 〜 ${to}(JST)` }
  }
}

/** 直近 n ヶ月の JST YYYY-MM 一覧 (推移グラフ用)。 */
export function recentMonths(n: number): string[] {
  const out: string[] = []
  const d = new Date(NOW)
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 15)
    out.push(jstMonth(t.toISOString()))
  }
  return out
}

/** 期間の日数(両端を含む)。日次系列の長さを決めるのに使う。 */
export function periodDays(period: Period): number {
  const from = new Date(`${period.from}T00:00:00+09:00`).getTime()
  const to = new Date(`${period.to}T00:00:00+09:00`).getTime()
  return Math.round((to - from) / 86_400_000) + 1
}
