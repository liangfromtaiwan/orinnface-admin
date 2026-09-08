/**
 * 管理画面のログインセッションと実効スコープ (仕様書 v1.0 §2, §3)
 *
 * 視点切替は「どの組織を見ているか」で行う。誰でログインしているかで見える範囲は
 * すでに決まっているため、視点の主語は人ではなく組織にする。
 * 🔴 視点は**表示の絞り込み**であって権限ではない。本部が 1 社に絞っても
 *    operator の capability は失われない(scope はそのまま)。
 * 🔴 旧 orinnme-admin の ?company_id / ?type は v1.0 と非互換のため URL では持たない。
 * 🔴 ここでの絞り込みは表示用。実 API 接続時は同じ scope を query に渡し、
 *    Backend 側で membership / store_data_link / 対象 scope を再検証すること。
 */

import { useMemo, useState, type ReactNode } from "react"

import { SessionContext, type SessionValue } from "@/contexts/session-context"
import {
  brandingCompanyIdFor,
  resolveBranding,
} from "@/lib/domain/branding"
import { resolveScope, viewScopeFor, visibleCustomerIds } from "@/lib/domain/scope"
import type { CompanyId, DataSubjectId } from "@/lib/domain/types"
import {
  adminAccounts,
  analysisSessions,
  carePlaybacks,
  companies,
  companyBrandings,
  customers,
  storeDataLinks,
  stores,
} from "@/lib/mock/seed"

export function SessionProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useState(adminAccounts[0].id)
  /** 本部が 1 社に絞って見ているときだけ入る。undefined = 全社横断。 */
  const [viewCompanyId, setViewCompanyId] = useState<CompanyId | undefined>()

  /** アカウントを変えたら視点は全社横断に戻す(他社の視点を持ち越さない)。 */
  function switchAccount(id: string) {
    setAccountId(id)
    setViewCompanyId(undefined)
  }

  const value = useMemo<SessionValue>(() => {
    const account =
      adminAccounts.find((a) => a.id === accountId) ?? adminAccounts[0]
    const scope = resolveScope(account, stores)

    const scopedStores = scope.crossCompany
      ? stores
      : stores.filter((s) => scope.storeIds.includes(s.id))

    const scopedCompanies = scope.crossCompany
      ? companies
      : companies.filter(
          (c) =>
            c.id === scope.companyId ||
            scopedStores.some((s) => s.companyId === c.id)
        )

    /*
      視点として選べる企業。本部は全契約企業から選び、
      それ以外は所属企業に固定される(選択肢は 1 件)。
      本部(internal)は契約企業ではないので選択肢に出さない。
    */
    const viewableCompanies = scopedCompanies.filter((c) => c.kind === "partner")

    /*
      実際に見ている企業。
      店舗管理者・店舗スタッフは scope に companyId を持たないため店舗から引き直す。
    */
    const effectiveCompanyId = scope.crossCompany
      ? viewCompanyId
      : brandingCompanyIdFor(scope, stores)

    const viewStores = effectiveCompanyId
      ? scopedStores.filter((s) => s.companyId === effectiveCompanyId)
      : scopedStores

    /*
      本部が 1 社に絞ったときは、その企業の店舗に連携している顧客だけに絞る。
      権限そのものは operator のままなので scope は書き換えない。
    */
    const viewScope = viewScopeFor(scope, effectiveCompanyId, stores)

    const allIds = customers.map((c) => c.dataSubjectId)
    const allowedIds = new Set<DataSubjectId>(
      visibleCustomerIds(viewScope, allIds, storeDataLinks)
    )

    return {
      account,
      scope,
      accounts: adminAccounts,
      switchAccount,
      viewCompanyId: effectiveCompanyId,
      viewableCompanies,
      setViewCompany: setViewCompanyId,
      // 🔴 管理画面の surface。B2C は企業設定を受けない
      branding: resolveBranding("admin", effectiveCompanyId, companyBrandings),
      companies: effectiveCompanyId
        ? scopedCompanies.filter((c) => c.id === effectiveCompanyId)
        : scopedCompanies,
      stores: viewStores,
      customers: customers.filter((c) => allowedIds.has(c.dataSubjectId)),
      analysisSessions: analysisSessions.filter((s) =>
        allowedIds.has(s.dataSubjectId)
      ),
      carePlaybacks: carePlaybacks.filter((p) => allowedIds.has(p.dataSubjectId)),
      storeDataLinks,
      totalCustomerCount: customers.length,
    }
  }, [accountId, viewCompanyId])

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}
