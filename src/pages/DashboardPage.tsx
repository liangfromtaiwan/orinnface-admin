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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  dailySeries,
  improvementRate,
  monthlyActiveUsers,
  monthlySeries,
  totalAnalyses,
  type ImprovementBaseline,
} from "@/lib/domain/kpi"
import { CARE_VIDEO_SLOTS, careSlotLabel } from "@/lib/domain/care-catalog"
import { getMetric, METRIC_CATALOG } from "@/lib/domain/metrics"
import {
  buildPeriod,
  PERIOD_LABEL,
  periodDates,
  periodDays,
  periodMonths,
  type PeriodKey,
} from "@/lib/domain/periods"
import { ROLE_LABEL } from "@/lib/domain/types"
import {
  granularityFor,
  planComposition,
  premiumSignal,
  SEGMENT_LABEL,
  type DashboardSegment,
  type SignalGranularity,
} from "@/lib/domain/plans"
import {
  careAssets,
  NOW,
  planChangeEvents,
  recommendationRuns,
} from "@/lib/mock/seed"

const IMPROVEMENT_METRICS = METRIC_CATALOG.filter((m) => m.group === "range")

/**
 * X 軸ラベル。
 * "2026-07" をそのまま出すと本数ぶんの幅に収まらず、Recharts が重なる
 * ラベルを黙って間引いてしまう(7月が消えていた)ため短縮する。
 * 年をまたぐ場合に備え、月次では 1月と先頭だけ年を添える。
 * 日次は本数が多いので、収まる本数だけ残るよう間引き幅を点数から決める。
 */
function makeTrendTick(granularity: SignalGranularity, count: number) {
  if (granularity === "month") {
    return (value: string, index: number) => {
      const [year, month] = value.split("-")
      const m = Number(month)
      return index === 0 || m === 1 ? `${year}/${m}` : `${m}月`
    }
  }
  const step = Math.max(1, Math.ceil(count / 6))
  return (value: string, index: number) =>
    index % step === 0 ? value.slice(5) : ""
}

const trendConfig = {
  activeUsers: { label: "アクティブユーザー", color: "var(--chart-1)" },
  analyses: { label: "分析回数", color: "var(--chart-2)" },
} satisfies ChartConfig

export default function DashboardPage() {
  const { scope, customers, analysisSessions, carePlaybacks, storeDataLinks, stores } =
    useSession()

  const [segment, setSegment] = useState<DashboardSegment>("all")
  const [periodKey, setPeriodKey] = useState<PeriodKey>("last_3m")
  const [storeId, setStoreId] = useState<string>("all")
  const [metricCode, setMetricCode] = useState(IMPROVEMENT_METRICS[0].code)
  const [baseline, setBaseline] = useState<ImprovementBaseline>("first")
  /** §6「care実施率は期間・slot・asset・scope 別」。scope は右上の店舗 filter。 */
  const [careSlot, setCareSlot] = useState<string>("all")
  const [careAssetId, setCareAssetId] = useState<string>("all")

  const period = useMemo(() => buildPeriod(periodKey), [periodKey])

  /**
   * 🔴 B2B / B2C は「その分析を店舗で撮ったか」で分ける。
   *    顧客の現在の連携状態で分けると、連携を解除した人の過去の店舗分析が
   *    B2C 側に移り、店舗へ課金した実績と合わなくなる。
   */
  const sessions = useMemo(() => {
    const bySegment = analysisSessions.filter((s) =>
      segment === "all" ? true : segment === "b2b" ? !!s.storeId : !s.storeId
    )
    return storeId === "all"
      ? bySegment
      : bySegment.filter((s) => s.storeId === storeId)
  }, [analysisSessions, storeId, segment])

  /** B2C には店舗が存在しないので、店舗 filter は B2C タブでは意味を持たない。 */
  const storeFilterEnabled = segment !== "b2c"

  /**
   * 課金の指標の母数。active な店舗連携がある顧客は費用を店舗が負担しており
   * 本人課金が発生しないため除く。
   */
  const payingCustomers = useMemo(
    () =>
      customers.filter(
        (c) =>
          !storeDataLinks.some(
            (l) => l.dataSubjectId === c.dataSubjectId && l.status === "active"
          )
      ),
    [customers, storeDataLinks]
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

  /**
   * 推奨が表示された人 = 正式 run が存在する人。
   *
   * 🔴 slot を絞ったときは分母もその slot を推奨された人だけにする。
   *    分子だけ絞ると実施率が実際より低く出てしまう。
   */
  const recommendedSubjectIds = useMemo(() => {
    const byId = new Map(sessions.map((s) => [s.id, s.dataSubjectId]))
    const ids = new Set<string>()
    for (const run of recommendationRuns) {
      const subject = byId.get(run.analysisSessionId)
      if (!subject) continue
      if (
        careSlot !== "all" &&
        !run.items.some((i) => i.videoCode === careSlot)
      ) {
        continue
      }
      ids.add(subject)
    }
    return [...ids]
  }, [sessions, careSlot])

  /** 枠を変えたら asset の選択は無効になるので戻す。 */
  const slotAssets = useMemo(
    () => (careSlot === "all" ? [] : careAssets.filter((a) => a.videoCode === careSlot)),
    [careSlot]
  )
  const effectiveAssetId =
    careSlot !== "all" && slotAssets.some((a) => a.id === careAssetId)
      ? careAssetId
      : "all"

  const careFilter =
    careSlot === "all"
      ? undefined
      : {
          videoCode: careSlot,
          ...(effectiveAssetId === "all" ? {} : { careAssetId: effectiveAssetId }),
        }

  /**
   * scope(店舗)を playback にも効かせる。
   * 🔴 これを忘れると完了率だけ右上の店舗 filter を無視する。
   */
  const scopedPlaybacks = useMemo(() => {
    const bySegment = carePlaybacks.filter((p) =>
      segment === "all" ? true : segment === "b2b" ? !!p.storeId : !p.storeId
    )
    return storeId === "all"
      ? bySegment
      : bySegment.filter((p) => p.storeId === storeId)
  }, [carePlaybacks, storeId, segment])

  const careExec = careExecutionRate(
    scopedPlaybacks,
    recommendedSubjectIds,
    period,
    careFilter
  )
  const careDone = careCompletionRate(scopedPlaybacks, period, careFilter)

  // 営収シグナルと同じ規則で粒度を切り替える。
  // 「今月」を月次のままにすると 1 点しか出ず推移が読めないため。
  const granularity = granularityFor(periodDays(period))
  // 月次/日次で key 名が違うと Recharts に渡せないため label に正規化する
  const series = (
    granularity === "month"
      ? monthlySeries(sessions, periodMonths(period)).map((p) => ({
          label: p.month,
          activeUsers: p.activeUsers,
          analyses: p.analyses,
        }))
      : dailySeries(sessions, periodDates(period)).map((p) => ({
          label: p.date,
          activeUsers: p.activeUsers,
          analyses: p.analyses,
        }))
  ) satisfies { label: string; activeUsers: number; analyses: number }[]
  const trendTick = makeTrendTick(granularity, series.length)
  // 🔴 日次の activeUsers は DAU であり §6 の MAU とは別物。同名で出さない。
  const trendUnit = granularity === "month" ? "月別" : "日別"

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
            <Select
              value={storeId}
              onValueChange={setStoreId}
              disabled={!storeFilterEnabled}
            >
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

      <Tabs value={segment} onValueChange={(v) => setSegment(v as DashboardSegment)}>
        <TabsList>
          {(Object.keys(SEGMENT_LABEL) as DashboardSegment[]).map((k) => (
            <TabsTrigger key={k} value={k}>
              {SEGMENT_LABEL[k]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <PeriodBanner
        period={period}
        scopeLabel={
          segment === "b2c"
            ? "B2C(店舗で撮っていない分析)"
            : storeId === "all"
              ? segment === "b2b"
                ? "すべての店舗"
                : "全体(B2B + B2C)"
              : (stores.find((s) => s.id === storeId)?.name ?? "すべての店舗")
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
          title={`${trendUnit}アクティブユーザー`}
          description={
            granularity === "month"
              ? "JST 月内に completed 分析が1回以上ある一意 data_subject 数(重複除外)。上の月間アクティブユーザーと同じ定義です。"
              : "その日に completed 分析が1回以上ある一意 data_subject 数(重複除外)。日別のため、上の月間アクティブユーザーとは粒度が異なる別の値です。"
          }
        >
          <ChartContainer config={trendConfig} className="h-56 w-full">
            <LineChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                // 間引きは formatter 側で制御する(Recharts に黙って落とさせない)
                interval={0}
                tickFormatter={trendTick}
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
          title={`${trendUnit}分析回数`}
          description="completed analysis_session 数(失敗・取消を除外)。"
        >
          <ChartContainer config={trendConfig} className="h-56 w-full">
            <BarChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                // 間引きは formatter 側で制御する(Recharts に黙って落とさせない)
                interval={0}
                tickFormatter={trendTick}
              />
              <YAxis tickLine={false} axisLine={false} width={32} fontSize={11} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="analyses" fill="var(--color-analyses)" radius={3} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/*
        課金の指標なので B2C タブでのみ出す。連携済みの顧客は費用を店舗が負担して
        いて本人課金がないため、母数からも外す(混ぜると Premium の課金者数が
        実態より多く見える)。本部スコープ限定なのは B2C 顧客が店舗に紐づかないため。
      */}
      {scope.crossCompany && segment === "b2c" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PremiumSignalCard
              points={premiumSignal(
                payingCustomers,
                planChangeEvents,
                NOW,
                periodDays(period)
              )}
              periodLabel={PERIOD_LABEL[periodKey]}
              granularity={granularityFor(periodDays(period))}
            />
          </div>
          <PlanCompositionCard composition={planComposition(payingCustomers)} />
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
          <Select
            value={careSlot}
            onValueChange={(v) => {
              setCareSlot(v)
              setCareAssetId("all")
            }}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="care 枠" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての care 枠</SelectItem>
              {CARE_VIDEO_SLOTS.map((slot) => (
                <SelectItem key={slot.videoCode} value={slot.videoCode}>
                  {careSlotLabel(slot)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* asset は枠に属するので、枠を選ぶまでは選べない */}
          <Select
            value={effectiveAssetId}
            onValueChange={setCareAssetId}
            disabled={careSlot === "all"}
          >
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue
                placeholder={careSlot === "all" ? "枠を選ぶと asset 別に見られます" : "asset"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての asset</SelectItem>
              {slotAssets.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.title}
                </SelectItem>
              ))}
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
