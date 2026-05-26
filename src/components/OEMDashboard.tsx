import {
  Building2Icon,
  ShieldIcon,
  SparklesIcon,
  StoreIcon,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  XAxis,
} from "recharts"
import { useSearchParams } from "react-router-dom"

import { ChartCard } from "@/components/ChartCard"
import { StatCard, type StatDelta } from "@/components/StatCard"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { getActiveUserStats, getAnalytics } from "@/lib/mock-data/analytics"
import { useCompanies } from "@/contexts/CompaniesContext"
import { getPlanStats } from "@/lib/mock-data/plans"
import type {
  CompanySubType,
  DailyAnalytics,
  PlanStats,
  User,
} from "@/lib/mock-data/types"
import {
  EXPRESSIONS,
  FATIGUES,
  PLANS,
  hasFatigueGap,
} from "@/lib/mock-data/types"
import { getUsersByCompany } from "@/lib/mock-data/users"

const DEFAULT_OEM_COMPANY_ID = 1

function LogoFor({ subType }: { subType: CompanySubType }) {
  if (subType === "shop") return <StoreIcon className="size-3.5" />
  if (subType === "influencer") return <SparklesIcon className="size-3.5" />
  if (subType === "company") return <Building2Icon className="size-3.5" />
  return <ShieldIcon className="size-3.5" />
}

function pct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

function weightedAvg(rows: DailyAnalytics[], key: keyof DailyAnalytics): number {
  const totalDau = rows.reduce((s, r) => s + r.dau, 0)
  if (totalDau === 0) return 0
  return rows.reduce((s, r) => s + (r[key] as number) * r.dau, 0) / totalDau
}

function deltaVsLastWeek(
  series: DailyAnalytics[],
  key: keyof DailyAnalytics
): StatDelta {
  const today = series[series.length - 1][key] as number
  const lastWeek = series[series.length - 8][key] as number
  return {
    value: today - lastWeek,
    label: "前週同曜日比",
  }
}

function buildStats(analytics: DailyAnalytics[], oemUsers: User[]) {
  const today = analytics[analytics.length - 1]
  const last7 = analytics.slice(-7)
  const prior7 = analytics.slice(-14, -7)
  const retentionThisWeek = weightedAvg(last7, "retentionRate")
  const retentionPriorWeek = weightedAvg(prior7, "retentionRate")

  const concordanceCount = oemUsers.filter((u) => !hasFatigueGap(u)).length
  const concordanceRate =
    oemUsers.length === 0 ? 0 : concordanceCount / oemUsers.length

  const last30 = analytics.slice(-30)
  const retentionMonth = weightedAvg(last30, "retentionRate")

  return [
    {
      title: "本日の再分析率",
      value: pct(today.reanalysisRate),
      delta: deltaVsLastWeek(analytics, "reanalysisRate"),
    },
    {
      title: "今週の継続率",
      value: pct(retentionThisWeek),
      delta: {
        value: retentionThisWeek - retentionPriorWeek,
        label: "前週比",
      },
    },
    {
      title: "継続率月次(30日)",
      value: pct(retentionMonth),
      description: "過去 30 日間の平均継続率(DAU 加重)",
    },
    {
      title: "本日のケア実行率",
      value: pct(today.careExecutionRate),
      delta: deltaVsLastWeek(analytics, "careExecutionRate"),
    },
    {
      title: "主観とAI一致率",
      value: pct(concordanceRate),
      description: `自社ユーザー ${oemUsers.length} 名のうち、落差 < 2 段階 = ${concordanceCount} 名`,
    },
  ] as const
}

const expressionConfig: ChartConfig = {
  expr_0: { label: EXPRESSIONS[0], color: "var(--chart-1)" },
  expr_1: { label: EXPRESSIONS[1], color: "var(--chart-2)" },
  expr_2: { label: EXPRESSIONS[2], color: "var(--chart-3)" },
  expr_3: { label: EXPRESSIONS[3], color: "var(--chart-4)" },
  expr_4: { label: EXPRESSIONS[4], color: "var(--chart-5)" },
}

const fatigueConfig: ChartConfig = {
  fat_0: { label: FATIGUES[0], color: "var(--chart-1)" },
  fat_1: { label: FATIGUES[1], color: "var(--chart-2)" },
  fat_2: { label: FATIGUES[2], color: "var(--chart-3)" },
  fat_3: { label: FATIGUES[3], color: "var(--chart-4)" },
  fat_4: { label: FATIGUES[4], color: "var(--chart-5)" },
}

function buildDistributionData(analytics: DailyAnalytics[]) {
  return analytics.slice(-7).map((row) => ({
    date: row.date.slice(5),
    expr_0: row.expressionDist[EXPRESSIONS[0]],
    expr_1: row.expressionDist[EXPRESSIONS[1]],
    expr_2: row.expressionDist[EXPRESSIONS[2]],
    expr_3: row.expressionDist[EXPRESSIONS[3]],
    expr_4: row.expressionDist[EXPRESSIONS[4]],
    fat_0: row.fatigueDist[FATIGUES[0]],
    fat_1: row.fatigueDist[FATIGUES[1]],
    fat_2: row.fatigueDist[FATIGUES[2]],
    fat_3: row.fatigueDist[FATIGUES[3]],
    fat_4: row.fatigueDist[FATIGUES[4]],
  }))
}

const planPieConfig: ChartConfig = {
  Guest: { label: "Guest", color: "var(--chart-1)" },
  Member: { label: "Member", color: "var(--chart-2)" },
  Premium: { label: "Premium", color: "var(--chart-3)" },
}

function buildPlanPieData(plans: PlanStats) {
  return PLANS.map((plan) => ({
    plan,
    count: plans.current[plan],
    fill: `var(--color-${plan})`,
  }))
}

function stackedBars(keys: string[]) {
  return keys.map((key, idx) => {
    const isFirst = idx === 0
    const isLast = idx === keys.length - 1
    const radius: number | [number, number, number, number] =
      isFirst && isLast
        ? 4
        : isFirst
          ? [0, 0, 4, 4]
          : isLast
            ? [4, 4, 0, 0]
            : 0
    return (
      <Bar
        key={key}
        dataKey={key}
        stackId="a"
        fill={`var(--color-${key})`}
        radius={radius}
      />
    )
  })
}

export function OEMDashboard() {
  const [searchParams] = useSearchParams()
  const { getCompany } = useCompanies()
  const companyIdRaw = searchParams.get("company_id")
  let companyId =
    companyIdRaw != null ? Number(companyIdRaw) : DEFAULT_OEM_COMPANY_ID
  let company = getCompany(companyId)
  if (!company || company.type !== "oem") {
    company = getCompany(DEFAULT_OEM_COMPANY_ID)
    companyId = DEFAULT_OEM_COMPANY_ID
  }
  // company is guaranteed by mock-data (id=1 always exists)
  if (!company) return null

  const analytics = getAnalytics(companyId)
  const plans = getPlanStats(companyId)
  const oemUsers = getUsersByCompany(companyId)

  const stats = buildStats(analytics, oemUsers)
  const distributionData = buildDistributionData(analytics)
  const planPieData = buildPlanPieData(plans)
  const totalUsers = planPieData.reduce((s, d) => s + d.count, 0)
  const activeStats = getActiveUserStats(analytics)

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">ダッシュボード</h1>
          <Badge variant="secondary" className="gap-1">
            <LogoFor subType={company.subType} />
            {company.name}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          提供先 {company.name} の管理画面 — 自社データのみ表示
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="DAU"
          value={`${activeStats.dau} 名`}
          description="本日アクティブだった自社ユーザー"
        />
        <StatCard
          title="WAU"
          value={`${activeStats.wau} 名`}
          description="過去 7 日間のユニークアクティブ"
        />
        <StatCard
          title="MAU"
          value={`${activeStats.mau} 名`}
          description="過去 30 日間のユニークアクティブ"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="表情カテゴリ分布"
          description="過去 7 日間の自社ユーザー表情分類別人数"
        >
          <ChartContainer
            config={expressionConfig}
            className="aspect-auto h-[260px] w-full"
          >
            <BarChart accessibilityLayer data={distributionData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {stackedBars(Object.keys(expressionConfig))}
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="疲労ステージ分布"
          description="過去 7 日間の自社ユーザー AI 判定別人数"
        >
          <ChartContainer config={fatigueConfig} className="aspect-auto h-[260px] w-full">
            <BarChart accessibilityLayer data={distributionData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {stackedBars(Object.keys(fatigueConfig))}
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="プラン構成比"
          description="自社の会員プラン別ユーザー数"
        >
          <ChartContainer
            config={planPieConfig}
            className="mx-auto aspect-square h-[260px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={planPieData}
                dataKey="count"
                nameKey="plan"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-2xl font-semibold"
                          >
                            {totalUsers}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 22}
                            className="fill-muted-foreground text-xs"
                          >
                            名
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="plan" />} />
            </PieChart>
          </ChartContainer>
        </ChartCard>

      </section>
    </div>
  )
}
