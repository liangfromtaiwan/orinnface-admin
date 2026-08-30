/**
 * 会社・店舗 (仕様書 v1.0 §4)
 *
 * 契約状態、店舗、membership、利用状況。V1 の契約作成は手動運用。
 * 🔴 画面表示は「店舗」に統一する。内部コードの partner を出さない。
 */

import { useMemo } from "react"

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ROLE_LABEL, type Store } from "@/lib/domain/types"
import { adminAccounts } from "@/lib/mock/seed"

const CONTRACT_LABEL: Record<string, string> = {
  active: "契約中",
  suspended: "停止中",
  terminated: "解約",
}

export default function OrganizationsPage() {
  const { companies, stores, storeDataLinks, analysisSessions } = useSession()

  const statsByStore = useMemo(() => {
    const map = new Map<string, { customers: number; eligible: number }>()
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="会社・店舗"
        description="契約状態・店舗・membership・利用状況。V1 の契約作成は手動運用です。"
      />

      {companies.map((company) => {
        const own = stores.filter((s) => s.companyId === company.id)
        const companyAdmins = adminAccounts.filter((a) =>
          a.organizationMemberships.some(
            (m) => m.companyId === company.id && m.role === "company_admin"
          )
        )
        return (
          <Card key={company.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {company.name}
                <Badge
                  variant={company.contractStatus === "active" ? "outline" : "secondary"}
                >
                  {CONTRACT_LABEL[company.contractStatus]}
                </Badge>
                {company.kind === "internal" ? (
                  <Badge variant="secondary" className="text-[10px]">
                    本部
                  </Badge>
                ) : null}
              </CardTitle>
              {companyAdmins.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  契約企業管理者: {companyAdmins.map((a) => a.displayName).join(" / ")}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {own.length === 0 ? (
                <p className="px-6 pb-4 text-sm text-muted-foreground">
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
                      <TableHead>membership</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {own.map((store: Store) => {
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
                              : members
                                  .map((m) => `${m.name}(${m.role})`)
                                  .join(" / ")}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )
      })}

      <SpecNote>
        単店舗契約でも内部的に会社と店舗を作成します。複数店舗を横断管理へ変更する場合は
        同じアカウントに契約企業管理者を付与し、アカウント・顧客・分析履歴・同意・保存期限を
        作り直しません。一部の店舗だけを管理する担当者には、対象店舗ごとに店舗管理者の
        membership を複数付与します(固定のエリア管理者ロールは追加しません)。
      </SpecNote>
    </div>
  )
}
