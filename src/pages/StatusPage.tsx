import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Navigate, useSearchParams } from "react-router-dom"

import { ChartCard } from "@/components/ChartCard"
import { StatCard } from "@/components/StatCard"
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
import { useCompanies } from "@/contexts/CompaniesContext"
import {
  CHANGE_KIND_LABEL,
  allPlanChangeEvents,
  buildPlanTimeSeries,
  calculateChurnRate,
  calculateNetPremiumChange,
  classifyChange,
  getPlanChangeEventsByCompany,
  type ChangeKind,
} from "@/lib/mock-data/plan-history"
import { users } from "@/lib/mock-data/users"

const planAreaConfig: ChartConfig = {
  Guest: { label: "Guest", color: "var(--chart-1)" },
  Member: { label: "Member", color: "var(--chart-2)" },
  Premium: { label: "Premium", color: "var(--chart-3)" },
}

const CHANGE_KIND_BADGE: Record<
  ChangeKind,
  { variant: "secondary" | "outline" | "destructive"; label: string }
> = {
  upgrade: { variant: "secondary", label: CHANGE_KIND_LABEL.upgrade },
  reactivate: { variant: "outline", label: CHANGE_KIND_LABEL.reactivate },
  downgrade: { variant: "outline", label: CHANGE_KIND_LABEL.downgrade },
  cancel: { variant: "destructive", label: CHANGE_KIND_LABEL.cancel },
}

function pct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ")
}

export default function StatusPage() {
  const [searchParams] = useSearchParams()
  const { getCompany } = useCompanies()
  const type = searchParams.get("type") ?? "admin"

  // b2b はプラン変更履歴 = 個別社員の課金状態であり、商業意義が無く規格にも記載無いため非表示
  if (type === "b2b") return <Navigate to="/dashboard" replace />

  const companyIdRaw = searchParams.get("company_id")
  const companyId = companyIdRaw != null ? Number(companyIdRaw) : 0
  const company = type === "oem" ? getCompany(companyId) : null

  // scope user IDs(admin = 全社、oem = 自社のみ)
  const scopeUserIds: number[] | "all" =
    type === "admin"
      ? "all"
      : users.filter((u) => u.companyId === companyId).map((u) => u.id)

  // 30 日間時系列
  const series = buildPlanTimeSeries(scopeUserIds, 30)
  const today = series[series.length - 1]
  const initial = series[0]

  // KPI 集計
  const churn = calculateChurnRate(scopeUserIds)
  const churnEventCount = Math.round(churn * initial.Premium)
  const netPremium = calculateNetPremiumChange(scopeUserIds)

  // Events(admin 全社、oem 自社 filter)
  const scopedEvents =
    type === "admin"
      ? allPlanChangeEvents
      : getPlanChangeEventsByCompany(companyId)
  const totalEvents = scopedEvents.length

  // 種別 breakdown
  const eventsByKind: Record<ChangeKind, number> = {
    upgrade: 0,
    downgrade: 0,
    cancel: 0,
    reactivate: 0,
  }
  for (const e of scopedEvents) {
    eventsByKind[classifyChange(e)]++
  }

  // 漏斗別カウント(規格 v1 2-5 プラン転換数)
  const guestToMemberCount = scopedEvents.filter(
    (e) => e.fromPlan === "Guest" && e.toPlan === "Member"
  ).length
  const memberToPremiumCount = scopedEvents.filter(
    (e) => e.fromPlan === "Member" && e.toPlan === "Premium"
  ).length

  const subtitle =
    type === "admin"
      ? "全提供先の会員ステータス履歴とプラン変更ログ"
      : `${company?.name ?? "—"} の会員ステータス履歴`

  const stats = [
    {
      title: "現在の Premium 会員数",
      value: `${today.Premium} 名`,
      description: `Guest ${today.Guest} / Member ${today.Member}(合計 ${
        today.Guest + today.Member + today.Premium
      } 名)`,
    },
    {
      title: "G→M 件数(30 日)",
      value: `${guestToMemberCount} 件 (${
        initial.Guest === 0
          ? "—"
          : `${((guestToMemberCount / initial.Guest) * 100).toFixed(1)}%`
      })`,
      description: `期初 Guest ${initial.Guest} 名のうち ${guestToMemberCount} 名が無料登録(Member)へ`,
    },
    {
      title: "M→P 件数(30 日)",
      value: `${memberToPremiumCount} 件 (${
        initial.Member === 0
          ? "—"
          : `${((memberToPremiumCount / initial.Member) * 100).toFixed(1)}%`
      })`,
      description: `期初 Member ${initial.Member} 名のうち ${memberToPremiumCount} 名が Premium 課金へ`,
    },
    {
      title: "Premium 純増(30 日)",
      value: `${netPremium >= 0 ? "+" : ""}${netPremium} 件 (${
        initial.Premium === 0
          ? "—"
          : `${((netPremium / initial.Premium) * 100).toFixed(1)}%`
      })`,
      description: `期初 ${initial.Premium} → 本日 ${today.Premium} 名`,
    },
    {
      title: "チャーン率(30 日)",
      value: pct(churn),
      description: `Premium 離脱 ${churnEventCount} 件 / 期初 ${initial.Premium} 名`,
    },
    {
      title: "プラン変更総件数(30 日)",
      value: `${totalEvents} 件`,
      description: `アップ ${eventsByKind.upgrade} ・ 再開 ${eventsByKind.reactivate} ・ ダウン ${eventsByKind.downgrade} ・ 解約 ${eventsByKind.cancel}`,
    },
  ] as const

  // chart 用 data:date を MM-DD に短縮
  const chartData = series.map((row) => ({
    date: row.date.slice(5),
    Guest: row.Guest,
    Member: row.Member,
    Premium: row.Premium,
  }))

  // table 用 events:新→旧 sort、ユーザー名 join
  const tableRows = [...scopedEvents]
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    .map((e) => {
      const user = users.find((u) => u.id === e.userId)
      const kind = classifyChange(e)
      return {
        event: e,
        userName: user?.name ?? `#${e.userId}`,
        kind,
        badge: CHANGE_KIND_BADGE[kind],
      }
    })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ステータス</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </section>

      <ChartCard
        title="プラン構成 推移"
        description="過去 30 日間の各プラン人数(stacked)"
      >
        <ChartContainer config={planAreaConfig} className="aspect-auto h-[300px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 8, right: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={4}
              fontSize={11}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={32}
              fontSize={11}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="Guest"
              stackId="1"
              type="monotone"
              fill="var(--color-Guest)"
              fillOpacity={0.7}
              stroke="var(--color-Guest)"
            />
            <Area
              dataKey="Member"
              stackId="1"
              type="monotone"
              fill="var(--color-Member)"
              fillOpacity={0.7}
              stroke="var(--color-Member)"
            />
            <Area
              dataKey="Premium"
              stackId="1"
              type="monotone"
              fill="var(--color-Premium)"
              fillOpacity={0.85}
              stroke="var(--color-Premium)"
            />
          </AreaChart>
        </ChartContainer>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>プラン変更ログ</CardTitle>
          <CardDescription>
            過去 30 日間のプラン変更イベント(新しい順)。{totalEvents} 件
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tableRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              該当期間にプラン変更はありません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>ユーザー</TableHead>
                  <TableHead>プラン遷移</TableHead>
                  <TableHead>種別</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map(({ event, userName, badge }) => (
                  <TableRow key={`${event.userId}-${event.changedAt}`}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatDate(event.changedAt)}
                    </TableCell>
                    <TableCell className="font-medium">{userName}</TableCell>
                    <TableCell className="tabular-nums">
                      <span className="text-muted-foreground">
                        {event.fromPlan}
                      </span>
                      <span className="mx-1.5">→</span>
                      <span className="font-medium">{event.toPlan}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
