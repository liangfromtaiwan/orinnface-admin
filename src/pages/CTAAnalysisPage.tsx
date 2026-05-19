import { Navigate, useSearchParams } from "react-router-dom"

import { StatCard } from "@/components/StatCard"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  allCTAEvents,
  CTA_TIMINGS,
  CTA_TIMING_LABEL,
  CTA_TIMING_TO_TYPE,
  getCTAEventsByCompany,
  getCTAStats,
  getCTAStatsByTiming,
  type CTAStats,
  type CTATiming,
} from "@/lib/mock-data"

function fmtPct(num: number, denom: number): string {
  if (denom === 0) return "—"
  return `${((num / denom) * 100).toFixed(1)}%`
}

function TimingTable({
  title,
  description,
  timings,
  statsByTiming,
}: {
  title: string
  description: string
  timings: CTATiming[]
  statsByTiming: Map<CTATiming, CTAStats>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>タイミング</TableHead>
              <TableHead className="text-right">トリガー</TableHead>
              <TableHead className="text-right">クリック</TableHead>
              <TableHead className="text-right">クリック率</TableHead>
              <TableHead className="text-right">転換</TableHead>
              <TableHead className="text-right">CVR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timings.map((timing) => {
              const stats = statsByTiming.get(timing) ?? {
                triggered: 0,
                clicked: 0,
                converted: 0,
                cvr: 0,
              }
              return (
                <TableRow key={timing}>
                  <TableCell className="font-medium">
                    {CTA_TIMING_LABEL[timing]}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {stats.triggered}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {stats.clicked}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmtPct(stats.clicked, stats.triggered)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {stats.converted}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {fmtPct(stats.converted, stats.triggered)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function CTAAnalysisPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"

  // b2b は個人情報非開示のため CTA 個別効果分析は非表示
  if (type === "b2b") return <Navigate to="/dashboard" replace />

  const companyIdRaw = searchParams.get("company_id")
  const companyId = companyIdRaw != null ? Number(companyIdRaw) : 0

  // admin = 全社、oem = 自社のみ
  const events =
    type === "oem" ? getCTAEventsByCompany(companyId) : allCTAEvents

  const guestStats = getCTAStats(events, "guest_to_member")
  const premiumStats = getCTAStats(events, "free_to_premium")
  const statsByTiming = getCTAStatsByTiming(events)

  const guestTimings = CTA_TIMINGS.filter(
    (t) => CTA_TIMING_TO_TYPE[t] === "guest_to_member"
  )
  const premiumTimings = CTA_TIMINGS.filter(
    (t) => CTA_TIMING_TO_TYPE[t] === "free_to_premium"
  )

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CTA 効果分析</h1>
        <p className="text-sm text-muted-foreground mt-1">
          過去 30 日のコンバージョン分析
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="無料登録 CVR(Guest → Member)"
          value={`${(guestStats.cvr * 100).toFixed(1)}%`}
          description={`トリガー ${guestStats.triggered} 件 / 登録 ${guestStats.converted} 件`}
        />
        <StatCard
          title="Premium 課金 CVR(Free → Premium)"
          value={`${(premiumStats.cvr * 100).toFixed(1)}%`}
          description={`トリガー ${premiumStats.triggered} 件 / 課金 ${premiumStats.converted} 件`}
        />
      </div>

      <TimingTable
        title="無料登録 CTA(Guest → Member)"
        description="アプリ未登録ユーザーへの会員登録訴求"
        timings={guestTimings}
        statsByTiming={statsByTiming}
      />

      <TimingTable
        title="Premium 課金 CTA(Free → Premium)"
        description="Member ユーザーへの Premium プラン訴求"
        timings={premiumTimings}
        statsByTiming={statsByTiming}
      />
    </div>
  )
}
