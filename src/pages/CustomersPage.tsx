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

import { CustomerBadges } from "@/components/CustomerBadges"
import { BADGE_HINT } from "@/components/badge-hints"
import { HintBadge } from "@/components/HintBadge"
import { InfoHint } from "@/components/InfoHint"
import { PageHeader, SpecNote } from "@/components/PageHeader"
import { TableEmpty } from "@/components/TableEmpty"
import { QualityBadge } from "@/components/QualityBadge"
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
  customerIdLabel,
  customerLabel,
  customerSearchText,
} from "@/lib/domain/customers"
import { careEntitlement } from "@/lib/domain/care-catalog"
import {
  CUSTOMER_FILTER_LABEL,
  CUSTOMER_FILTER_ORDER,
  matchesCustomerFilter,
  type CustomerFilterKey,
} from "@/lib/domain/plans"
import {
  isChurnRisk,
  isEligible,
  formatDate,
  formatMonthDay,
  jstMonth,
  latestEligible,
} from "@/lib/domain/kpi"
import { RETENTION_STATE_LABEL } from "@/lib/domain/types"
import { NOW, rawImageAssets, recommendationRuns } from "@/lib/mock/seed"

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
  const [status, setStatus] = useState<CustomerFilterKey | "all">("all")

  const currentMonth = jstMonth(NOW.toISOString())

  /**
   * filter の選択肢に出す件数。検索前の母数で数える。
   * 🔴 プラン軸と連携軸は別契約で排他ではないので、合計は顧客数を超える。
   */
  const statusCounts = useMemo(() => {
    const map = new Map<CustomerFilterKey, number>()
    for (const k of CUSTOMER_FILTER_ORDER) {
      map.set(
        k,
        customers.filter((c) =>
          matchesCustomerFilter(
            c,
            storeDataLinks.some(
              (l) => l.dataSubjectId === c.dataSubjectId && l.status === "active"
            ),
            k
          )
        ).length
      )
    }
    return map
  }, [customers, storeDataLinks])

  const rows = useMemo(() => {
    return customers
      // 🔴 バッジと同じ判定で絞る。別々に書くと表示と食い違う
      .filter((c) =>
        status === "all"
          ? true
          : matchesCustomerFilter(
              c,
              storeDataLinks.some(
                (l) => l.dataSubjectId === c.dataSubjectId && l.status === "active"
              ),
              status
            )
      )
      .filter((c) => {
        if (!query.trim()) return true
        const q = query.trim().toLowerCase()
        /* 名前を持たない未登録の仮データは、匿名識別子で探せるようにする */
        return customerSearchText(c).includes(q)
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
        // §5.1 の care 欄は 推奨表示 / 再生開始 / 完了 / 直近実施 / 月次回数
        const ownSessionIds = new Set(own.map((s) => s.id))
        const recommended = recommendationRuns
          .filter((r) => ownSessionIds.has(r.analysisSessionId))
          .reduce((n, r) => n + r.items.length, 0)
        const completedPlays = plays.filter((p) => p.completedAt)
        const monthlyCompleted = completedPlays.filter(
          (p) => jstMonth(p.completedAt!) === currentMonth
        ).length
        const lastDoneAt = completedPlays
          .map((p) => p.completedAt!)
          .sort()
          .pop()
        const retention = rawImageAssets.find(
          (a) => a.dataSubjectId === c.dataSubjectId
        )

        return {
          customer: c,
          eligibleCount,
          latestFace,
          activeLink,
          careRecommended: recommended,
          careCompleted: completedPlays.length,
          careStarted: plays.length,
          careMonthly: monthlyCompleted,
          careLastDoneAt: lastDoneAt,
          // 標準動画の上限は本人のプランで決まる(店舗提供動画は別枠)
          careLimit: careEntitlement(c.plan).monthlyLimit,
          retention,
          // ダッシュボードの KPI と同じ関数で判定する(種別を問わない)
          atRisk: isChurnRisk(
            analysisSessions,
            c.dataSubjectId,
            storeDataLinks,
            NOW.getTime()
          ),
        }
      })
  }, [customers, analysisSessions, carePlaybacks, storeDataLinks, status, query, currentMonth])

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
                placeholder="顧客番号・表示名・匿名ID"
                className="h-9 w-56 pl-8"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as CustomerFilterKey | "all")}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="状態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて ({customers.length})</SelectItem>
                {CUSTOMER_FILTER_ORDER.map((k) => (
                  <SelectItem key={k} value={k}>
                    {CUSTOMER_FILTER_LABEL[k]} ({statusCounts.get(k) ?? 0})
                  </SelectItem>
                ))}
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
                <TableHead>
                  <span className="inline-flex items-center gap-1.5">
                    顧客(名前 / ID)
                    {/*
                      🔴 Guest 会員が店舗連携済みという状態はあり得る
                         (吉田さん確定 2026-09-25)。未登録の仮データと同じに
                         見えないよう、2 つの違いをここで説明する。
                    */}
                    <InfoHint label="バッジの見かた">
                      <p className="font-medium text-foreground">
                        Guest / Member / Premium
                      </p>
                      <p className="mt-1">
                        登録済みの方のプランです。プランと店舗連携は別契約なので、
                        <strong className="font-medium text-foreground">
                          Guest のまま店舗連携済み
                        </strong>
                        という状態もあります（「Guest」と「連携済み」が並びます）。
                      </p>
                      <p className="mt-2 font-medium text-foreground">
                        未登録（仮データ）
                      </p>
                      <p className="mt-1">
                        まだ登録していない方の未連携分析です。アカウントが無いので
                        プランも店舗連携も持たず、生画像は分析完了から 180 日で
                        期限を迎えます。
                      </p>
                    </InfoHint>
                  </span>
                </TableHead>
                <TableHead>店舗</TableHead>
                <TableHead>最新分析</TableHead>
                <TableHead className="text-right">適格分析</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1.5">
                    care
                    <InfoHint label="care 欄の見かた">
                      <p className="font-medium text-foreground">care</p>
                      <p className="mt-1">
                        上段は「完了 / 再生開始」の playback 数。分母はその顧客が
                        再生を開始した回数なので、分析回数が違えば人によって変わります。
                      </p>
                      <p className="mt-1">
                        下段は 推奨表示回数・当月の完了回数・直近実施日。Member は
                        JST 暦月 10 回が上限なので「今月 2/10」の形で出します。
                        Guest は再生できませんが推奨はロック表示されるため、
                        推奨回数だけ表示します。
                      </p>
                    </InfoHint>
                  </span>
                </TableHead>
                <TableHead>保持</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  filtered={query.trim() !== "" || status !== "all"}
                  emptyLabel="表示できる顧客がいません"
                  filteredLabel="条件に合う顧客がいません（未登録の方は名前を持たないので、匿名ID か顧客番号で探してください）。"
                  onClear={() => {
                    setQuery("")
                    setStatus("all")
                  }}
                />
              ) : null}
              {rows.map((r) => (
                <TableRow
                  key={r.customer.dataSubjectId}
                  className="relative cursor-pointer has-[a:focus-visible]:bg-muted/50"
                >
                  <TableCell>
                    {/*
                      after:inset-0 で行全体をリンクの当たり判定にする。
                      onClick + navigate ではなく実際の <a> のままにしているので、
                      ⌘+クリックで新しいタブ・右クリック・キーボード操作が効く。
                      この行に他のボタンを置くときは覆いを外すこと。
                      hover で説明を出すバッジは z-10 で覆いより前に出している
                      (HintBadge 側で指定)。
                    */}
                    {/* 探すときに見るのは名前なので、名前を上・ID を下に置く */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        to={`/customers/${r.customer.dataSubjectId}`}
                        className="font-medium underline-offset-4 after:absolute after:inset-0 after:content-[''] hover:underline"
                      >
                        {/* 🔴 登録していない人に名前は無い (§9 仮データは匿名識別子) */}
                        <span
                          className={
                            r.customer.displayName
                              ? undefined
                              : "text-muted-foreground"
                          }
                        >
                          {customerLabel(r.customer)}
                        </span>
                      </Link>
                      <CustomerBadges
                        customer={r.customer}
                        linked={!!r.activeLink}
                      />
                    </div>
                    <div className="font-mono text-xs text-muted-foreground tabular-nums">
                      {customerIdLabel(r.customer)}
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
                        {formatDate(r.latestFace.completedAt)}
                        {r.latestFace.quality === "ok" ? null : (
                          <QualityBadge
                            quality={r.latestFace.quality}
                            className="ml-1"
                          />
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {r.eligibleCount}
                    {r.atRisk ? (
                      <HintBadge hint={BADGE_HINT.churn_risk} className="ml-1">
                        離脱リスク
                      </HintBadge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.careStarted === 0 ? (
                      <span className="text-muted-foreground tabular-nums">—</span>
                    ) : (
                      <span className="tabular-nums">
                        {r.careCompleted} / {r.careStarted}
                      </span>
                    )}
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      推奨 {r.careRecommended}
                      {r.customer.plan === "guest" ? (
                        <span className="ml-1">(ロック表示)</span>
                      ) : (
                        <>
                          {" · 今月 "}
                          {r.careMonthly}
                          {r.careLimit === null ? "" : `/${r.careLimit}`}
                          {r.careLastDoneAt
                            ? ` · 直近 ${formatMonthDay(r.careLastDoneAt)}`
                            : ""}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.retention ? (
                      <>
                        <div>{RETENTION_STATE_LABEL[r.retention.state]}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(r.retention.expiresAt)} まで
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
