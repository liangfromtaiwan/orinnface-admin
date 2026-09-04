/**
 * KPI 算出 (仕様書 v1.0 §6)
 *
 * 🔴 平均値・中央値・改善率は母数・期間・対象条件・欠測数・使用 version を
 *    必ず表示する。少数母数を隠さない。
 *    → そのため戻り値は必ず Aggregate 型で分母を持ち回る。
 * 🔴 集計は冪等。同一 event の重複で回数・課金・quota を増やさない (§13)。
 */

import { isImproved } from "./metrics"
import type {
  AnalysisSession,
  CarePlayback,
  DataSubjectId,
  StoreDataLink,
} from "./types"

/* ------------------------------------------------------------------ *
 * JST 基準の期間ユーティリティ
 * ------------------------------------------------------------------ */

const JST = "Asia/Tokyo"

const JST_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: JST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** ISO 文字列を JST の YYYY-MM-DD にする。 */
export function jstDate(iso: string): string {
  return JST_PARTS.format(new Date(iso))
}

/** ISO 文字列を JST の YYYY-MM にする。MAU / care 上限の暦月判定に使う。 */
export function jstMonth(iso: string): string {
  return jstDate(iso).slice(0, 7)
}

export type Period = {
  /** 含む (JST YYYY-MM-DD) */
  from: string
  /** 含む (JST YYYY-MM-DD) */
  to: string
  label: string
}

export function inPeriod(iso: string | undefined, period: Period): boolean {
  if (!iso) return false
  const d = jstDate(iso)
  return d >= period.from && d <= period.to
}

/* ------------------------------------------------------------------ *
 * 集計結果 (母数を必ず持つ)
 * ------------------------------------------------------------------ */

export type Aggregate = {
  /** 表示する主値。率は 0-100 の百分率。 */
  value: number
  numerator: number
  /** 母数。0 のときは率を出さず「—」表示にする。 */
  denominator: number
  /** 欠測数。比較不能・値なしで母数から外した件数。 */
  missing: number
  period: Period
  /** 対象条件の説明。画面にそのまま出す。 */
  conditionLabel: string
  /** 使用した version (average_version / baseline_version など)。 */
  version?: string
}

function rate(
  numerator: number,
  denominator: number,
  missing: number,
  period: Period,
  conditionLabel: string,
  version?: string
): Aggregate {
  return {
    value: denominator === 0 ? 0 : (numerator / denominator) * 100,
    numerator,
    denominator,
    missing,
    period,
    conditionLabel,
    version,
  }
}

function count(
  n: number,
  period: Period,
  conditionLabel: string,
  denominator = n,
  missing = 0
): Aggregate {
  return { value: n, numerator: n, denominator, missing, period, conditionLabel }
}

/* ------------------------------------------------------------------ *
 * 適格分析の判定 (§5「初回」定義と共通)
 * ------------------------------------------------------------------ */

/**
 * 適格分析 = 新規撮影を伴う completed 分析。
 * failed / cancelled / invalid、新規撮影のない再解析・再スコアリングは除く。
 */
export function isEligible(s: AnalysisSession): boolean {
  return s.status === "completed" && s.newCapture && s.quality !== "insufficient"
}

/**
 * 「初回」= 同一人物・同一分析種別の最初の有効な completed 分析。
 * Guest 移行 / B2B handoff 分を含む。
 * 登録日・Premium 開始日・契約日・初回来店は初回ではない。
 * 顔と姿勢は別管理する。
 */
export function firstEligible(
  sessions: AnalysisSession[],
  dataSubjectId: DataSubjectId,
  analysisType: AnalysisSession["analysisType"]
): AnalysisSession | undefined {
  return sessions
    .filter(
      (s) =>
        s.dataSubjectId === dataSubjectId &&
        s.analysisType === analysisType &&
        isEligible(s)
    )
    .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""))[0]
}

export function latestEligible(
  sessions: AnalysisSession[],
  dataSubjectId: DataSubjectId,
  analysisType: AnalysisSession["analysisType"]
): AnalysisSession | undefined {
  const list = sessions
    .filter(
      (s) =>
        s.dataSubjectId === dataSubjectId &&
        s.analysisType === analysisType &&
        isEligible(s)
    )
    .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""))
  return list[list.length - 1]
}

/* ------------------------------------------------------------------ *
 * KPI
 * ------------------------------------------------------------------ */

/**
 * 月間アクティブユーザー
 * = JST 月内に completed 分析が 1 回以上ある一意 data_subject 数。
 * B2B 課金根拠。重複除外。
 */
export function monthlyActiveUsers(
  sessions: AnalysisSession[],
  period: Period
): Aggregate {
  const ids = new Set<DataSubjectId>()
  for (const s of sessions) {
    if (s.status === "completed" && inPeriod(s.completedAt, period)) {
      ids.add(s.dataSubjectId)
    }
  }
  return count(
    ids.size,
    period,
    "JST 月内に completed 分析が1回以上ある一意 data_subject(重複除外)"
  )
}

/** 総分析回数 = 期間内の completed analysis_session 数。失敗・取消を除外。 */
export function totalAnalyses(
  sessions: AnalysisSession[],
  period: Period
): Aggregate {
  const n = sessions.filter(
    (s) => s.status === "completed" && inPeriod(s.completedAt, period)
  ).length
  return count(n, period, "期間内の completed analysis_session(失敗・取消を除外)")
}

/**
 * 継続分析ユーザー = 期間末までに適格分析が 2 回以上ある一意 subject 数。
 * 母数 = 期間末までに適格分析が 1 回以上ある一意 subject 数。
 */
export function continuingUsers(
  sessions: AnalysisSession[],
  period: Period
): Aggregate {
  const perSubject = new Map<DataSubjectId, number>()
  for (const s of sessions) {
    if (!isEligible(s)) continue
    if (!s.completedAt || jstDate(s.completedAt) > period.to) continue
    perSubject.set(s.dataSubjectId, (perSubject.get(s.dataSubjectId) ?? 0) + 1)
  }
  const denominator = perSubject.size
  const n = [...perSubject.values()].filter((c) => c >= 2).length
  return count(
    n,
    period,
    "期間末までに適格分析が2回以上ある一意 subject(母数=1回以上)",
    denominator
  )
}

export const CHURN_RISK_DAYS = 14

/**
 * 離脱リスク = 最終適格分析から 14 日以上かつ active な account / link。
 * 日数は運用設定 (§6)。
 */
export function churnRiskUsers(
  sessions: AnalysisSession[],
  links: StoreDataLink[],
  period: Period,
  thresholdDays: number = CHURN_RISK_DAYS
): Aggregate {
  const last = new Map<DataSubjectId, string>()
  for (const s of sessions) {
    if (!isEligible(s) || !s.completedAt) continue
    const prev = last.get(s.dataSubjectId)
    if (!prev || s.completedAt > prev) last.set(s.dataSubjectId, s.completedAt)
  }
  const activeSubjects = new Set(
    links.filter((l) => l.status === "active").map((l) => l.dataSubjectId)
  )
  const boundary = new Date(`${period.to}T23:59:59+09:00`).getTime()
  let n = 0
  for (const [id, iso] of last) {
    if (!activeSubjects.has(id)) continue
    const days = (boundary - new Date(iso).getTime()) / 86_400_000
    if (days >= thresholdDays) n += 1
  }
  return count(
    n,
    period,
    `最終適格分析から${thresholdDays}日以上かつ active な account / link`,
    last.size
  )
}

export type ImprovementBaseline = "first" | "previous"

export const IMPROVEMENT_BASELINE_LABEL: Record<ImprovementBaseline, string> = {
  first: "本人の同一分析種別の初回適格分析",
  previous: "直前分析",
}

/**
 * 改善率
 * = 比較可能者のうち metric_direction に沿って最新値が基準時点より
 *   改善した人数 ÷ 比較可能者数 × 100。
 *
 * 🔴 指標・比較基準・母数・欠測を必ず表示する。
 * 🔴 metric_direction は §16 P1 の未決事項。暫定値で出す場合は
 *    画面側で「暫定」を明示すること。
 */
export function improvementRate(
  sessions: AnalysisSession[],
  subjectIds: DataSubjectId[],
  metricCode: string,
  analysisType: AnalysisSession["analysisType"],
  baseline: ImprovementBaseline,
  period: Period,
  version?: string
): Aggregate {
  let improved = 0
  let comparable = 0
  let missing = 0

  for (const id of subjectIds) {
    const eligible = sessions
      .filter(
        (s) =>
          s.dataSubjectId === id &&
          s.analysisType === analysisType &&
          isEligible(s) &&
          s.completedAt &&
          jstDate(s.completedAt) <= period.to
      )
      .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""))

    if (eligible.length < 2) {
      missing += 1
      continue
    }
    const latest = eligible[eligible.length - 1]
    const base = baseline === "first" ? eligible[0] : eligible[eligible.length - 2]

    const baseValue = base.metrics.find((m) => m.metricCode === metricCode)?.value
    const latestValue = latest.metrics.find((m) => m.metricCode === metricCode)?.value

    const verdict = isImproved(metricCode, baseValue, latestValue)
    if (verdict === null) {
      missing += 1
      continue
    }
    comparable += 1
    if (verdict) improved += 1
  }

  return rate(
    improved,
    comparable,
    missing,
    period,
    `指標 ${metricCode} / 基準 ${IMPROVEMENT_BASELINE_LABEL[baseline]}`,
    version
  )
}

/**
 * care 実施率 = care_play_completed 人数 ÷ 推奨表示人数 × 100。
 * 期間 / slot / asset / scope 別に出せる。
 */
export function careExecutionRate(
  playbacks: CarePlayback[],
  recommendedSubjectIds: DataSubjectId[],
  period: Period,
  filter?: { videoCode?: string; careAssetId?: string }
): Aggregate {
  const recommended = new Set(recommendedSubjectIds)
  const completedSubjects = new Set<DataSubjectId>()
  for (const p of playbacks) {
    if (!p.completedAt || !inPeriod(p.completedAt, period)) continue
    if (filter?.videoCode && p.videoCode !== filter.videoCode) continue
    if (filter?.careAssetId && p.careAssetId !== filter.careAssetId) continue
    if (!recommended.has(p.dataSubjectId)) continue
    completedSubjects.add(p.dataSubjectId)
  }
  return rate(
    completedSubjects.size,
    recommended.size,
    0,
    period,
    "care 完了人数 ÷ 推奨表示人数" +
      (filter?.videoCode ? ` / slot ${filter.videoCode}` : "")
  )
}

/**
 * care 完了率 = 完了 playback 数 ÷ 開始 playback 数 × 100。
 * 🔴 再接続は同一 playback として重複除外する。
 *    playback.id が同一のものは 1 件として数える。
 */
export function careCompletionRate(
  playbacks: CarePlayback[],
  period: Period,
  filter?: { videoCode?: string }
): Aggregate {
  const started = new Set<string>()
  const completed = new Set<string>()
  for (const p of playbacks) {
    if (filter?.videoCode && p.videoCode !== filter.videoCode) continue
    if (inPeriod(p.startedAt, period)) started.add(p.id)
    if (p.completedAt && inPeriod(p.completedAt, period)) completed.add(p.id)
  }
  return rate(
    completed.size,
    started.size,
    0,
    period,
    "完了 playback ÷ 開始 playback(再接続は同一 playback として重複除外)"
  )
}

/**
 * 日ごとの推移。グラフ用。
 *
 * 🔴 activeUsers は「その日に completed 分析があった一意 data_subject 数」で、
 *    §6 の月間アクティブユーザー(MAU)とは粒度が違う別の値。
 *    画面では必ず「日別」と明示し、MAU と同じ名前で出さないこと。
 */
export function dailySeries(
  sessions: AnalysisSession[],
  dates: string[]
): { date: string; activeUsers: number; analyses: number }[] {
  const byDate = new Map<string, { subjects: Set<DataSubjectId>; analyses: number }>()
  for (const d of dates) byDate.set(d, { subjects: new Set(), analyses: 0 })
  for (const s of sessions) {
    if (s.status !== "completed" || !s.completedAt) continue
    const bucket = byDate.get(jstDate(s.completedAt))
    if (!bucket) continue
    bucket.subjects.add(s.dataSubjectId)
    bucket.analyses += 1
  }
  return dates.map((date) => {
    const b = byDate.get(date)!
    return { date, activeUsers: b.subjects.size, analyses: b.analyses }
  })
}

/** 月ごとの推移。グラフ用。 */
export function monthlySeries(
  sessions: AnalysisSession[],
  months: string[]
): { month: string; activeUsers: number; analyses: number }[] {
  return months.map((month) => {
    const inMonth = sessions.filter(
      (s) => s.status === "completed" && s.completedAt && jstMonth(s.completedAt) === month
    )
    return {
      month,
      activeUsers: new Set(inMonth.map((s) => s.dataSubjectId)).size,
      analyses: inMonth.length,
    }
  })
}
