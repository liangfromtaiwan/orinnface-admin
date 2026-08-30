import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from "recharts"
import { useSearchParams } from "react-router-dom"

import { ChartCard } from "@/components/ChartCard"
import { StatCard, type StatDelta } from "@/components/StatCard"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAnalytics, globalAnalytics } from "@/lib/mock-data/analytics"
import { useCompanies } from "@/contexts/CompaniesContext"
import { globalPlans } from "@/lib/mock-data/plans"
import type { Company, DailyAnalytics } from "@/lib/mock-data/types"
import {
  EXPRESSIONS,
  FATIGUES,
  PLANS,
  hasFatigueGap,
} from "@/lib/mock-data/types"
import { users } from "@/lib/mock-data/users"

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

function buildStats() {
  const last30 = globalAnalytics
  const today = last30[last30.length - 1]

  const last7 = last30.slice(-7)
  const prior7 = last30.slice(-14, -7)
  const retentionThisWeek = weightedAvg(last7, "retentionRate")
  const retentionPriorWeek = weightedAvg(prior7, "retentionRate")

  const concordanceCount = users.filter((u) => !hasFatigueGap(u)).length
  const concordanceRate = concordanceCount / users.length

  const retentionMonth = weightedAvg(last30, "retentionRate")

  return [
    {
      title: "本日の再分析率",
      value: pct(today.reanalysisRate),
      delta: deltaVsLastWeek(last30, "reanalysisRate"),
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
      delta: deltaVsLastWeek(last30, "careExecutionRate"),
    },
    {
      title: "主観とAI一致率",
      value: pct(concordanceRate),
      description: `現在のユーザー ${users.length} 名のうち、落差 < 2 段階 = ${concordanceCount} 名`,
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

function buildDistributionData() {
  return globalAnalytics.slice(-7).map((row) => ({
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

const planTrendConfig: ChartConfig = {
  newPremium: { label: "Premium 新規", color: "var(--chart-2)" },
  lostPremium: { label: "Premium 離脱", color: "var(--destructive)" },
  premiumCount: { label: "Premium 会員数", color: "var(--chart-1)" },
}

function buildPlanPieData() {
  return PLANS.map((plan) => ({
    plan,
    count: globalPlans.current[plan],
    fill: `var(--color-${plan})`,
  }))
}

// Premium 会員数の推移は flow(newPremium / lostPremium)とは独立に生成。
// mock の users.ts と plans.ts は別系統で生成されているため、厳密に
// reconcile できない。デモ用に「3 → 8 名へ緩やかに増加」の trajectory を
// 描画(終点は users.ts の Premium 数と一致させる)。
function buildPlanTrendData() {
  const todayCount = globalPlans.current.Premium
  const N = globalPlans.daily.length
  const startCount = Math.max(1, todayCount - 5)

  return globalPlans.daily.map((d, i) => {
    const progress = i / Math.max(1, N - 1)
    const ideal = startCount + (todayCount - startCount) * progress
    const jitter = Math.sin(i * 0.8) * 0.4
    const premiumCount =
      i === N - 1 ? todayCount : Math.max(0, Math.round(ideal + jitter))
    return {
      ...d,
      date: d.date.slice(5),
      premiumCount,
    }
  })
}

type ProviderRow = {
  company: Company
  dauAvg7: number
  retention7: number
  careExecutionRate: number
}

function buildProviderRows(allCompanies: Company[]): ProviderRow[] {
  return allCompanies
    .filter((c) => c.id !== 0)
    .map((c) => {
      const series = getAnalytics(c.id)
      const today = series[series.length - 1]
      const last7 = series.slice(-7)
      const dauAvg7 = last7.reduce((s, r) => s + r.dau, 0) / last7.length
      return {
        company: c,
        dauAvg7,
        retention7: weightedAvg(last7, "retentionRate"),
        careExecutionRate: today.careExecutionRate,
      }
    })
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

export function AdminDashboard() {
  const stats = buildStats()
  const distributionData = buildDistributionData()
  const planPieData = buildPlanPieData()
  const planTrendData = buildPlanTrendData()
  const totalUsers = planPieData.reduce((s, d) => s + d.count, 0)
  const { companies } = useCompanies()
  const providerRows = buildProviderRows(companies)
  const [searchParams, setSearchParams] = useSearchParams()

  function switchTo(company: Company) {
    const next = new URLSearchParams(searchParams)
    next.set("company_id", String(company.id))
    next.set("type", company.type)
    setSearchParams(next)
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ダッシュボード</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          OrinnFACE 全体の主要指標と推移
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="表情カテゴリ分布"
          description="過去 7 日間の表情分類別ユーザー数"
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
          description="過去 7 日間の AI 判定疲労ステージ別ユーザー数"
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
          description="現在の会員プラン別ユーザー数"
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

        <ChartCard
          title="営収シグナル(Premium 推移)"
          description="過去 30 日間の Premium 新規 vs 離脱(Premium が唯一の課金プラン)"
        >
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">
              現在 Premium 会員数
            </span>
            <span className="text-2xl font-semibold tabular-nums">
              {globalPlans.current.Premium}
            </span>
            <span className="text-sm text-muted-foreground">名</span>
          </div>
          <ChartContainer
            config={planTrendConfig}
            className="aspect-auto h-[260px] w-full"
          >
            <LineChart
              accessibilityLayer
              data={planTrendData}
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={4}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {Object.keys(planTrendConfig).map((key) => (
                <Line
                  key={key}
                  dataKey={key}
                  type="monotone"
                  stroke={`var(--color-${key})`}
                  strokeWidth={key === "premiumCount" ? 2.5 : 2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>提供先別利用状況</CardTitle>
          <CardDescription>
            行クリックで該当の提供先視点に切り替え
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>提供先</TableHead>
                <TableHead>区分</TableHead>
                <TableHead className="text-right">DAU(7日平均)</TableHead>
                <TableHead className="text-right">継続率(7日)</TableHead>
                <TableHead className="text-right">ケア実行率(本日)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providerRows.map(
                ({ company, dauAvg7, retention7, careExecutionRate }) => (
                  <TableRow
                    key={company.id}
                    onClick={() => switchTo(company)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          company.type === "oem" ? "secondary" : "outline"
                        }
                      >
                        {company.type === "oem" ? "OEM" : "BtoB"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(dauAvg7)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(retention7)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(careExecutionRate)}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
