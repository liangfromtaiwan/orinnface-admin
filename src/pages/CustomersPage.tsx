/**
 * 顧客一覧 (仕様書 v1.0 §5.1)
 *
 * 表示項目: 顧客識別 / 店舗 / 最新分析 / 継続 / care / 保持
 * 🔴 顧客識別は必要最小限。analytics へ PII を混入しない。
 * 🔴 生画像は一覧に出さない (§2)。
 */

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { SearchIcon } from "lucide-react"

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSession, useStoreName } from "@/contexts/session-context"
import {
  CHURN_RISK_DAYS,
  isEligible,
  jstDate,
  latestEligible,
} from "@/lib/domain/kpi"
import { PLAN_LABEL, RETENTION_STATE_LABEL, type PlanCode } from "@/lib/domain/types"
import { NOW, rawImageAssets } from "@/lib/mock/seed"

function daysSince(iso: string): number {
  return Math.floor((NOW.getTime() - new Date(iso).getTime()) / 86_400_000)
}

export default function CustomersPage() {
  const {
    customers,
    analysisSessions,
    carePlaybacks,
    storeDataLinks,
    totalCustomerCount,
    scope,
  } = useSession()
  const storeName = useStoreName()

  const [query, setQuery] = useState("")
  const [plan, setPlan] = useState<PlanCode | "all">("all")

  const rows = useMemo(() => {
    return customers
      .filter((c) => (plan === "all" ? true : c.plan === plan))
      .filter((c) => {
        if (!query.trim()) return true
        const q = query.trim().toLowerCase()
        return (
          c.displayCode.toLowerCase().includes(q) ||
          c.displayName.toLowerCase().includes(q)
        )
      })
      .map((c) => {
        const own = analysisSessions.filter(
          (s) => s.dataSubjectId === c.dataSubjectId
        )
        const eligibleCount = own.filter(isEligible).length
        const latestFace = latestEligible(own, c.dataSubjectId, "face")
        const activeLink = storeDataLinks.find(
          (l) => l.dataSubjectId === c.dataSubjectId && l.status === "active"
        )
        const plays = carePlaybacks.filter(
          (p) => p.dataSubjectId === c.dataSubjectId
        )
        const retention = rawImageAssets.find(
          (a) => a.dataSubjectId === c.dataSubjectId
        )
        const idleDays = latestFace?.completedAt
          ? daysSince(latestFace.completedAt)
          : undefined
        return {
          customer: c,
          eligibleCount,
          latestFace,
          activeLink,
          careCompleted: plays.filter((p) => p.completedAt).length,
          careStarted: plays.length,
          retention,
          atRisk: idleDays !== undefined && idleDays >= CHURN_RISK_DAYS && !!activeLink,
        }
      })
  }, [customers, analysisSessions, carePlaybacks, storeDataLinks, plan, query])

  return (
    <div className="space-y-4">
      <PageHeader
        title="顧客"
        description={
          scope.crossCompany
            ? `全 ${totalCustomerCount} 名`
            : `閲覧可能 ${customers.length} 名 / 全 ${totalCustomerCount} 名(スコープ外は取得していません)`
        }
        actions={
          <>
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="顧客番号・表示名"
                className="h-9 w-56 pl-8"
              />
            </div>
            <Select value={plan} onValueChange={(v) => setPlan(v as PlanCode | "all")}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="プラン" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>顧客</TableHead>
                <TableHead>店舗</TableHead>
                <TableHead>最新分析</TableHead>
                <TableHead className="text-right">適格分析</TableHead>
                <TableHead>care</TableHead>
                <TableHead>保持</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.customer.dataSubjectId}>
                  <TableCell>
                    <Link
                      to={`/customers/${r.customer.dataSubjectId}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {r.customer.displayCode}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{r.customer.displayName}</span>
                      <Badge variant="outline" className="px-1 py-0 text-[10px]">
                        {PLAN_LABEL[r.customer.plan]}
                      </Badge>
                      {r.customer.unregistered ? (
                        <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                          未連携分析
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.activeLink ? (
                      storeName(r.activeLink.storeId)
                    ) : (
                      <span className="text-muted-foreground">連携なし</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {r.latestFace?.completedAt ? (
                      <>
                        {jstDate(r.latestFace.completedAt)}
                        {r.latestFace.quality === "warn" ? (
                          <Badge
                            variant="outline"
                            className="ml-1 border-amber-300 px-1 py-0 text-[10px] text-amber-700"
                          >
                            品質注意
                          </Badge>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {r.eligibleCount}
                    {r.atRisk ? (
                      <Badge
                        variant="outline"
                        className="ml-1 border-amber-300 px-1 py-0 text-[10px] text-amber-700"
                      >
                        離脱リスク
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {r.careStarted === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      `${r.careCompleted} / ${r.careStarted}`
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.retention ? (
                      <>
                        <div>{RETENTION_STATE_LABEL[r.retention.state]}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {jstDate(r.retention.expiresAt)} まで
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    条件に一致する顧客はいません
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>

      <SpecNote>
        閲覧範囲は「active な店舗連携」と「その店舗の担当に割り当てられていること」の
        両方で判定しています。
        来店履歴(store_visits)は閲覧権限の判定に使いません。連携を解除した顧客は店舗から
        即時閲覧できなくなりますが、本人の分析・care 履歴は保持されます。
      </SpecNote>
    </div>
  )
}
