/**
 * ダッシュボード (仕様書 v1.0 §4, §6)
 *
 * 全社 KPI、期間・会社・店舗 filter、母数・欠測表示。
 * 🔴 KPI の定義は §6 が正。ここで別定義の同名指標を作らない。
 */

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { AggregateStat } from "@/components/AggregateStat"
import { ChartCard } from "@/components/ChartCard"
import { PageHeader, PeriodBanner, SpecNote } from "@/components/PageHeader"
import { PlanCompositionCard } from "@/components/PlanCompositionCard"
import { PremiumSignalCard } from "@/components/PremiumSignalCard"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSession } from "@/contexts/session-context"
import {
  careCompletionRate,
  careExecutionRate,
  churnRiskUsers,
  continuingUsers,
  improvementRate,
  monthlyActiveUsers,
  monthlySeries,
  totalAnalyses,
  type ImprovementBaseline,
} from "@/lib/domain/kpi"
import { getMetric, METRIC_CATALOG } from "@/lib/domain/metrics"
import {
  buildPeriod,
  PERIOD_LABEL,
  recentMonths,
  type PeriodKey,
} from "@/lib/domain/periods"
import { ROLE_LABEL } from "@/lib/domain/types"
import { planComposition, premiumSignal } from "@/lib/domain/plans"
import { NOW, planChangeEvents, recommendationRuns } from "@/lib/mock/seed"

const IMPROVEMENT_METRICS = METRIC_CATALOG.filter((m) => m.group === "range")

/** 営収シグナルの表示日数。 */
const PREMIUM_SIGNAL_DAYS = 30

/** 月別チャートの表示月数。期間 filter とは独立(1ヶ月だけでは推移が読めないため)。 */
const TREND_MONTHS = 8

/**
 * X 軸の月ラベル。
 * "2026-07" をそのまま出すと 8 本ぶんの幅に収まらず、
 * Recharts が重なるラベルを黙って間引いてしまう(7月が消えていた)ため短縮する。
 * 年をまたぐ場合に備え、1月と先頭だけ年を添える。
 */
function monthTick(value: string, index: number) {
  const [year, month] = value.split("-")
  const m = Number(month)
  return index === 0 || m === 1 ? `${year}/${m}` : `${m}月`
}

const trendConfig = {
  activeUsers: { label: "アクティブユーザー", color: "var(--chart-1)" },
  analyses: { label: "分析回数", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function DashboardPage() {
  const { scope, customers, analysisSessions, carePlaybacks, storeDataLinks, stores } =
    useSession()

  const [periodKey, setPeriodKey] = useState<PeriodKey>("last_3m")
  const [storeId, setStoreId] = useState<string>("all")
  const [metricCode, setMetricCode] = useState(IMPROVEMENT_METRICS[0].code)
  const [baseline, setBaseline] = useState<ImprovementBaseline>("first")

  const period = useMemo(() => buildPeriod(periodKey), [periodKey])

  const sessions = useMemo(
    () =>
      storeId === "all"
        ? analysisSessions
        : analysisSessions.filter((s) => s.storeId === storeId),
    [analysisSessions, storeId]
  )

  const subjectIds = useMemo(() => {
    const ids = new Set(sessions.map((s) => s.dataSubjectId))
    return customers.filter((c) => ids.has(c.dataSubjectId)).map((c) => c.dataSubjectId)
  }, [sessions, customers])

  const mau = monthlyActiveUsers(sessions, period)
  const total = totalAnalyses(sessions, period)
  const continuing = continuingUsers(sessions, period)
  const churn = churnRiskUsers(sessions, storeDataLinks, period)

  const improvement = improvementRate(
    sessions,
    subjectIds,
    metricCode,
    "face",
    baseline,
    period,
    "avg-2026Q2"
  )

  /** 推奨が表示された人 = 正式 run が存在する人。 */
  const recommendedSubjectIds = useMemo(() => {
    const byId = new Map(sessions.map((s) => [s.id, s.dataSubjectId]))
    const ids = new Set<string>()
    for (const run of recommendationRuns) {
      const subject = byId.get(run.analysisSessionId)
      if (subject) ids.add(subject)
    }
    return [...ids]
  }, [sessions])

  const careExec = careExecutionRate(carePlaybacks, recommendedSubjectIds, period)
  const careDone = careCompletionRate(carePlaybacks, period)

  const months = recentMonths(TREND_MONTHS)
  const series = monthlySeries(sessions, months)

  const metricDef = getMetric(metricCode)

  return (
    <div className="space-y-4">
      <PageHeader
        title="ダッシュボード"
        description={
          <>
            {ROLE_LABEL[scope.role]} のスコープで集計しています
            {scope.crossCompany
              ? "(全会社・全店舗を横断)"
              : `(${stores.length} 店舗 / 顧客 ${customers.length} 名)`}
          </>
        }
        actions={
          <>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="店舗" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての店舗</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={periodKey}
              onValueChange={(v) => setPeriodKey(v as PeriodKey)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="期間" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PERIOD_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <PeriodBanner
        period={period}
        note={
          storeId === "all"
            ? "すべての店舗"
            : stores.find((s) => s.id === storeId)?.name
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AggregateStat title="月間アクティブユーザー" aggregate={mau} format="count" unit="名" />
        <AggregateStat title="総分析回数" aggregate={total} format="count" unit="回" />
        <AggregateStat title="継続分析ユーザー" aggregate={continuing} format="count" unit="名" />
        <AggregateStat title="離脱リスク" aggregate={churn} format="count" unit="名" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`月別アクティブユーザー(直近${TREND_MONTHS}ヶ月)`}
          description={`JST 月内に completed 分析が1回以上ある一意 data_subject 数(重複除外)。推移を読むため、上部の集計期間とは独立に直近 ${TREND_MONTHS} ヶ月を表示します。`}
        >
          <ChartContainer config={trendConfig} className="h-56 w-full">
            <LineChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                // 間引かせない(1本でも欠けると欠測に見える)
                interval={0}
                tickFormatter={monthTick}
              />
              <YAxis tickLine={false} axisLine={false} width={32} fontSize={11} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="activeUsers"
                type="monotone"
                stroke="var(--color-activeUsers)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={`月別分析回数(直近${TREND_MONTHS}ヶ月)`}
          description={`completed analysis_session 数(失敗・取消を除外)。推移を読むため、上部の集計期間とは独立に直近 ${TREND_MONTHS} ヶ月を表示します。`}
        >
          <ChartContainer config={trendConfig} className="h-56 w-full">
            <BarChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                // 間引かせない(1本でも欠けると欠測に見える)
                interval={0}
                tickFormatter={monthTick}
              />
              <YAxis tickLine={false} axisLine={false} width={32} fontSize={11} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="analyses" fill="var(--color-analyses)" radius={3} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 会員プランは B2C を含む全体の指標のため本部スコープのみ。
          店舗スコープでは B2C 顧客が含まれず数字の意味が変わる。 */}
      {scope.crossCompany ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PremiumSignalCard
              points={premiumSignal(
                customers,
                planChangeEvents,
                NOW,
                PREMIUM_SIGNAL_DAYS
              )}
              days={PREMIUM_SIGNAL_DAYS}
            />
          </div>
          <PlanCompositionCard composition={planComposition(customers)} />
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">改善・care 実施</h2>
          <Select value={metricCode} onValueChange={setMetricCode}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="指標" />
            </SelectTrigger>
            <SelectContent>
              {IMPROVEMENT_METRICS.map((m) => (
                <SelectItem key={m.code} value={m.code}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={baseline}
            onValueChange={(v) => setBaseline(v as ImprovementBaseline)}
          >
            <SelectTrigger className="h-8 w-64 text-xs">
              <SelectValue placeholder="比較基準" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first">本人の同一分析種別の初回適格分析</SelectItem>
              <SelectItem value="previous">直前分析</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AggregateStat
            title="改善率"
            aggregate={improvement}
            format="rate"
            provisional={metricDef?.provisional}
          />
          <AggregateStat title="care実施率" aggregate={careExec} format="rate" />
          <AggregateStat title="care完了率" aggregate={careDone} format="rate" />
        </div>
      </div>

      <SpecNote>
        「初回」は同一人物・同一分析種別の最初の有効な completed 分析です。登録日・契約日・
        Premium 開始日・初回来店は初回ではありません。failed / cancelled / invalid と、
        新規撮影を伴わない再解析は適格分析から除外しています。
        {metricDef?.provisional ? (
          <>
            {" "}
            改善率の metric_direction は仕様書 §16 P1 の未決事項(指標責任者承認待ち)のため
            「暫定」と表示しています。
          </>
        ) : null}
      </SpecNote>
    </div>
  )
}
