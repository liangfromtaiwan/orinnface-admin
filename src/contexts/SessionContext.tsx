/**
 * 管理画面のログインセッションと実効スコープ (仕様書 v1.0 §2, §3)
 *
 * 🔴 旧 orinnme-admin の ?company_id / ?type による視点切替は v1.0 と非互換のため廃止。
 *    role は membership から解決する。
 * 🔴 ここでの絞り込みは表示用。実 API 接続時は同じ scope を query に渡し、
 *    Backend 側で membership / store_data_link / 対象 scope を再検証すること。
 */

import { useMemo, useState, type ReactNode } from "react"

import { SessionContext, type SessionValue } from "@/contexts/session-context"
import { resolveScope, visibleCustomerIds } from "@/lib/domain/scope"
import type { DataSubjectId } from "@/lib/domain/types"
import {
  adminAccounts,
  analysisSessions,
  carePlaybacks,
  companies,
  customers,
  storeDataLinks,
  stores,
} from "@/lib/mock/seed"

export function SessionProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useState(adminAccounts[0].id)

  const value = useMemo<SessionValue>(() => {
    const account =
      adminAccounts.find((a) => a.id === accountId) ?? adminAccounts[0]
    const scope = resolveScope(account, stores)

    const allIds = customers.map((c) => c.dataSubjectId)
    const allowedIds = new Set<DataSubjectId>(
      visibleCustomerIds(scope, allIds, storeDataLinks)
    )

    const scopedStores = scope.crossCompany
      ? stores
      : stores.filter((s) => scope.storeIds.includes(s.id))

    return {
      account,
      scope,
      accounts: adminAccounts,
      switchAccount: setAccountId,
      companies: scope.crossCompany
        ? companies
        : companies.filter(
            (c) =>
              c.id === scope.companyId ||
              scopedStores.some((s) => s.companyId === c.id)
          ),
      stores: scopedStores,
      customers: customers.filter((c) => allowedIds.has(c.dataSubjectId)),
      analysisSessions: analysisSessions.filter((s) =>
        allowedIds.has(s.dataSubjectId)
      ),
      carePlaybacks: carePlaybacks.filter((p) => allowedIds.has(p.dataSubjectId)),
      storeDataLinks,
      totalCustomerCount: customers.length,
    }
  }, [accountId])

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}
