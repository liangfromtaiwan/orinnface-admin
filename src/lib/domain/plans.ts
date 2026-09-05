/**
 * 会員プランの構成比と課金シグナル
 *
 * ℹ️ 仕様書 v1.0 §6 の正式 KPI ではない。本部(operator)が B2C を含む全体の
 *    会員構成と Premium の増減を把握するための補助指標。
 *    課金プランは Premium のみ。Guest / Member は無料のため、
 *    営収シグナルは「Premium への新規」と「Premium からの離脱」だけを追う。
 *
 * 🔴 店舗スコープでは B2C 顧客が含まれず数字の意味が変わるため、
 *    この指標は crossCompany(本部)のみに表示する。
 */

import { jstDate, jstMonth } from "./kpi"
import { PLAN_LABEL, type Customer, type PlanChangeEvent, type PlanCode } from "./types"

export const PLAN_ORDER: PlanCode[] = ["guest", "member", "premium"]

/**
 * ダッシュボードの表示区分。
 *
 * 🔴 B2B / B2C は「その顧客に active な店舗連携があるか」で分ける。
 *    判断基準は「店舗に課金できるか」。連携がなければ店舗へ請求できないので、
 *    過去に店舗で撮った分析であっても B2C として扱う(使用者確定 2026-09-05)。
 *
 * ⚠️ そのため、連携を解除した顧客の過去の分析は B2B 側から抜けます。
 *    店舗へ過去に発行した請求書の数字とは一致しません。
 */
export type DashboardSegment = "all" | "b2b" | "b2c"

export const SEGMENT_LABEL: Record<DashboardSegment, string> = {
  all: "全体",
  b2b: "B2B(店舗)",
  b2c: "B2C",
}

export type PlanSlice = {
  plan: PlanCode
  label: string
  count: number
}

export type PlanComposition = {
  slices: PlanSlice[]
  total: number
}

/** 現在の会員プラン別ユーザー数。 */
export function planComposition(customers: Customer[]): PlanComposition {
  const counts = new Map<PlanCode, number>(PLAN_ORDER.map((p) => [p, 0]))
  for (const c of customers) {
    counts.set(c.plan, (counts.get(c.plan) ?? 0) + 1)
  }
  const slices = PLAN_ORDER.map((plan) => ({
    plan,
    label: PLAN_LABEL[plan],
    count: counts.get(plan) ?? 0,
  }))
  return { slices, total: slices.reduce((n, s) => n + s.count, 0) }
}

/**
 * 期間に応じた集計粒度。ダッシュボードの全チャートで共通に使う。
 *
 * 1 ヶ月を超えたら月次にまとめる。3 ヶ月を日次で出すと 90 点を超え、
 * 1 日あたり 0〜3 という小さな値が尖ったノイズになって傾向が読めないため。
 * 逆に「今月」を月次にすると 1 点しか出ないので日次にする。
 */
export type SignalGranularity = "day" | "month"

export const DAILY_MAX_DAYS = 35

export function granularityFor(days: number): SignalGranularity {
  return days <= DAILY_MAX_DAYS ? "day" : "month"
}

export type PremiumSignalPoint = {
  /** 日次は JST の YYYY-MM-DD、月次は YYYY-MM */
  date: string
  /** その日に Premium になった人数 (Member→Premium, Guest→Premium) */
  newPremium: number
  /** その日に Premium から離脱した人数 (Premium→Member, Premium→Guest) */
  lostPremium: number
  /** その日終了時点の Premium 会員数 */
  premiumTotal: number
}

/**
 * 過去 n 日の Premium 新規 / 離脱 / 会員数。
 *
 * 会員数は「現在の Premium 数」から履歴を遡って復元する。
 * 実 API 接続時は日次スナップショットをサーバから受け取ること
 * (クライアントで遡る方式はイベント欠損に弱い)。
 */
export function premiumSignal(
  customers: Customer[],
  events: PlanChangeEvent[],
  now: Date,
  days = 30,
  granularity: SignalGranularity = granularityFor(days)
): PremiumSignalPoint[] {
  const daily = dailyPremiumSignal(customers, events, now, days)
  if (granularity === "day") return daily

  // 月次: 新規と離脱は合計、会員数はその月の最終日の値を採用する。
  const buckets = new Map<string, PremiumSignalPoint>()
  for (const p of daily) {
    const key = jstMonth(`${p.date}T00:00:00+09:00`)
    const cur = buckets.get(key)
    if (!cur) {
      buckets.set(key, { ...p, date: key })
    } else {
      cur.newPremium += p.newPremium
      cur.lostPremium += p.lostPremium
      cur.premiumTotal = p.premiumTotal
    }
  }
  return [...buckets.values()]
}

function dailyPremiumSignal(
  customers: Customer[],
  events: PlanChangeEvent[],
  now: Date,
  days: number
): PremiumSignalPoint[] {
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    dates.push(jstDate(new Date(now.getTime() - i * 86_400_000).toISOString()))
  }

  const byDate = new Map<string, { gained: number; lost: number }>()
  for (const d of dates) byDate.set(d, { gained: 0, lost: 0 })

  for (const e of events) {
    const d = jstDate(e.changedAt)
    const bucket = byDate.get(d)
    if (!bucket) continue
    const wasPremium = e.fromPlan === "premium"
    const isPremium = e.toPlan === "premium"
    if (!wasPremium && isPremium) bucket.gained += 1
    if (wasPremium && !isPremium) bucket.lost += 1
  }

  const currentPremium = customers.filter((c) => c.plan === "premium").length

  // 末日から遡って各日の会員数を復元する。
  const totals = new Array<number>(dates.length)
  totals[dates.length - 1] = currentPremium
  for (let i = dates.length - 1; i > 0; i--) {
    const b = byDate.get(dates[i])!
    totals[i - 1] = totals[i] - b.gained + b.lost
  }

  return dates.map((date, i) => {
    const b = byDate.get(date)!
    return {
      date,
      newPremium: b.gained,
      lostPremium: b.lost,
      premiumTotal: totals[i],
    }
  })
}
