/**
 * SessionContext の context 本体と hook。
 * (Provider component は SessionContext.tsx。fast-refresh のため分離している)
 */

import { createContext, useContext } from "react"

import type { Scope } from "@/lib/domain/scope"
import type {
  AdminAccount,
  AnalysisSession,
  CarePlayback,
  Company,
  Customer,
  Store,
  StoreDataLink,
} from "@/lib/domain/types"
import { stores as allStores } from "@/lib/mock/seed"

export type SessionValue = {
  account: AdminAccount
  scope: Scope
  /** デモ用のアカウント切替。実認証実装時に削除する。 */
  accounts: AdminAccount[]
  switchAccount: (accountId: string) => void

  companies: Company[]
  stores: Store[]
  /** scope 内で閲覧できる顧客のみ。 */
  customers: Customer[]
  /** scope 内の顧客に紐づく分析のみ。 */
  analysisSessions: AnalysisSession[]
  carePlaybacks: CarePlayback[]
  storeDataLinks: StoreDataLink[]
  /** 全顧客数 (母数表示で「スコープ外に何件あるか」を出すため)。 */
  totalCustomerCount: number
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used within SessionProvider")
  return ctx
}

/** 店舗名の解決。画面表示は「店舗」で統一する (partner を出さない)。 */
export function useStoreName() {
  const { stores } = useSession()
  return (storeId?: string) => {
    if (!storeId) return "—"
    const found =
      stores.find((s) => s.id === storeId) ?? allStores.find((s) => s.id === storeId)
    return found?.name ?? storeId
  }
}
