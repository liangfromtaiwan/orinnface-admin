/**
 * 会社・店舗 (仕様書 v1.0 §4)
 *
 * 契約状態、店舗、membership、利用状況。V1 の契約作成は手動運用。
 * 🔴 画面表示は「店舗」に統一する。内部コードの partner を出さない。
 *
 * 会社数が増えても目的の会社に辿り着けるよう、既定は折りたたみ表示にし、
 * 店舗一覧は展開したときだけ出す。検索時は一致した会社を自動で開く。
 */

import { useMemo, useState } from "react"
import { ChevronRightIcon, SearchIcon } from "lucide-react"

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { useSession } from "@/contexts/session-context"
import { isEligible } from "@/lib/domain/kpi"
import { ROLE_LABEL, type Company, type Store } from "@/lib/domain/types"
import { adminAccounts } from "@/lib/mock/seed"

const CONTRACT_LABEL: Record<Company["contractStatus"], string> = {
  active: "契約中",
  suspended: "停止中",
  terminated: "解約",
}

type StoreStats = { customers: number; eligible: number }

export default function OrganizationsPage() {
  const { companies, stores, storeDataLinks, analysisSessions } = useSession()
  const [query, setQuery] = useState("")
  const [contract, setContract] = useState<Company["contractStatus"] | "all">("all")
  const [manuallyOpen, setManuallyOpen] = useState<Set<string>>(new Set())

  const statsByStore = useMemo(() => {
    const map = new Map<string, StoreStats>()
    for (const s of stores) map.set(s.id, { customers: 0, eligible: 0 })
    for (const l of storeDataLinks) {
      if (l.status !== "active") continue
      const e = map.get(l.storeId)
      if (e) e.customers += 1
    }
    for (const s of analysisSessions) {
      if (!s.storeId || !isEligible(s)) continue
      const e = map.get(s.storeId)
      if (e) e.eligible += 1
    }
    return map
  }, [stores, storeDataLinks, analysisSessions])

  const membershipsByStore = useMemo(() => {
    const map = new Map<string, { name: string; role: string }[]>()
    for (const a of adminAccounts) {
      for (const m of a.storeMemberships) {
        const list = map.get(m.storeId) ?? []
        list.push({ name: a.displayName, role: ROLE_LABEL[m.role] })
        map.set(m.storeId, list)
      }
    }
    return map
  }, [])

  /** filter の選択肢に件数を出すため、検索前の母数で数える。 */
  const contractCounts = useMemo(() => {
    const map = new Map<Company["contractStatus"], number>()
    for (const c of companies) map.set(c.contractStatus, (map.get(c.contractStatus) ?? 0) + 1)
    return map
  }, [companies])

  const q = query.trim().toLowerCase()

  /** 会社名の一致、または配下店舗名の一致で絞り込む。 */
  const rows = useMemo(() => {
    return companies
      .map((company) => {
        const own = stores.filter((s) => s.companyId === company.id)
        const companyHit = company.name.toLowerCase().includes(q)
        const hitStores = own.filter((s) => s.name.toLowerCase().includes(q))
        return { company, own, companyHit, hitStores }
      })
      .filter((r) => contract === "all" || r.company.contractStatus === contract)
      .filter((r) => !q || r.companyHit || r.hitStores.length > 0)
  }, [companies, stores, q, contract])

  const visibleStoreCount = rows.reduce((n, r) => n + r.own.length, 0)

  function toggle(companyId: string) {
    setManuallyOpen((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="会社・店舗"
        description={`${rows.length} 社 / ${visibleStoreCount} 店舗。契約作成は V1 では手動運用です。`}
        actions={
          <>
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="会社名・店舗名"
                className="h-9 w-64 pl-8"
              />
            </div>
            <Select
              value={contract}
              onValueChange={(v) => setContract(v as Company["contractStatus"] | "all")}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="契約状態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  すべての契約状態 ({companies.length})
                </SelectItem>
                {(
                  Object.keys(CONTRACT_LABEL) as Company["contractStatus"][]
                ).map((status) => (
                  <SelectItem key={status} value={status}>
                    {CONTRACT_LABEL[status]} ({contractCounts.get(status) ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {q ? `「${query}」に一致する会社・店舗はありません` : "該当する会社はありません"}
            {contract !== "all" ? `(契約状態: ${CONTRACT_LABEL[contract]})` : ""}
          </CardContent>
        </Card>
      ) : null}

      {rows.map(({ company, own, hitStores }) => {
        // 検索中は一致した会社を自動で開く。それ以外は既定で閉じる。
        const open = q ? true : manuallyOpen.has(company.id)
        const companyAdmins = adminAccounts.filter((a) =>
          a.organizationMemberships.some(
            (m) => m.companyId === company.id && m.role === "company_admin"
          )
        )
        const totals = own.reduce(
          (acc, s) => {
            const st = statsByStore.get(s.id)
            acc.customers += st?.customers ?? 0
            acc.eligible += st?.eligible ?? 0
            return acc
          },
          { customers: 0, eligible: 0 }
        )
        // 検索で店舗だけが一致した場合は、その店舗を先頭に見せる。
        const listed =
          q && hitStores.length > 0 && !company.name.toLowerCase().includes(q)
            ? hitStores
            : own

        return (
          <Collapsible
            key={company.id}
            open={open}
            onOpenChange={() => toggle(company.id)}
            asChild
          >
            <Card className="gap-0 overflow-hidden py-0">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  aria-label={`${company.name} の店舗一覧を${open ? "閉じる" : "開く"}`}
                >
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />

                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="font-medium">{company.name}</span>
                    <Badge
                      variant={
                        company.contractStatus === "active" ? "outline" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {CONTRACT_LABEL[company.contractStatus]}
                    </Badge>
                    {company.kind === "internal" ? (
                      <Badge variant="secondary" className="text-[10px]">
                        本部
                      </Badge>
                    ) : null}
                  </div>

                  {/* 閉じたままでも規模が分かるよう、要約は常に出す */}
                  <dl className="hidden shrink-0 gap-4 text-xs text-muted-foreground sm:flex">
                    <div className="flex gap-1">
                      <dt>店舗</dt>
                      <dd className="tabular-nums text-foreground">{own.length}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>連携顧客</dt>
                      <dd className="tabular-nums text-foreground">{totals.customers}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>適格分析</dt>
                      <dd className="tabular-nums text-foreground">{totals.eligible}</dd>
                    </div>
                  </dl>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t">
                  {companyAdmins.length > 0 ? (
                    <p className="px-4 pt-3 text-xs text-muted-foreground">
                      契約企業管理者: {companyAdmins.map((a) => a.displayName).join(" / ")}
                    </p>
                  ) : null}

                  {listed.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">
                      スコープ内に表示できる店舗はありません
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>店舗</TableHead>
                          <TableHead>状態</TableHead>
                          <TableHead className="text-right">連携顧客</TableHead>
                          <TableHead className="text-right">適格分析</TableHead>
                          <TableHead>担当者</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listed.map((store: Store) => {
                          const st = statsByStore.get(store.id)
                          const members = membershipsByStore.get(store.id) ?? []
                          return (
                            <TableRow key={store.id}>
                              <TableCell className="font-medium">{store.name}</TableCell>
                              <TableCell className="text-sm">
                                {store.status === "active" ? "営業中" : "閉店"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {st?.customers ?? 0}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {st?.eligible ?? 0}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {members.length === 0
                                  ? "—"
                                  : members.map((m) => `${m.name}(${m.role})`).join(" / ")}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )
      })}

      <SpecNote>
        単店舗契約でも内部的に会社と店舗を作成します。複数店舗を横断管理へ変更する場合は
        同じアカウントに契約企業管理者を付与し、アカウント・顧客・分析履歴・同意・保存期限を
        作り直しません。一部の店舗だけを管理する担当者には、対象店舗ごとに店舗管理者の
        担当を複数割り当てます(固定のエリア管理者ロールは追加しません)。
      </SpecNote>
    </div>
  )
}
