/**
 * SessionContext の context 本体と hook。
 * (Provider component は SessionContext.tsx。fast-refresh のため分離している)
 */

import { createContext, useContext } from "react"

import type { Branding } from "@/lib/domain/branding"
import type { MembershipTarget, Scope } from "@/lib/domain/scope"
import type {
  AccountId,
  AdminAccount,
  AuditEvent,
  CareAssignment,
  CareVideoAsset,
  CompanyId,
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

  /* ---- membership の付与・剥奪 (§4.1, §4.2) ---- */

  /**
   * membership 行を足す・消す。
   * 🔴 呼ぶ前に `decideMembershipEdit()` で可否を判定すること。
   *    ここは画面の state を動かすだけで、権限判定はしない。
   *    実 API 接続時は POST/DELETE のたびに Backend 側でも再検証する。
   * 🔴 変更は §11 の変更監査に role_change として必ず 1 件残る。
   */
  changeMembership: (
    accountId: AccountId,
    target: MembershipTarget,
    action: "grant" | "revoke",
    reason: string
  ) => void
  /** 監査ログ。画面で起きた変更を seed の履歴に足して見せる。 */
  auditEvents: AuditEvent[]

  /* ---- care 動画 (§7) ---- */

  careAssets: CareVideoAsset[]
  careAssignments: CareAssignment[]
  /**
   * 本部デフォルトの asset を直接差し替える (§7.1)。
   * 🔴 呼ぶ前に `decideCareReplacement()` が direct を返すことを確認する。
   *    契約企業・店舗は申請を経由するので、この関数を通さない。
   */
  replaceCareAsset: (
    videoCode: string,
    careAssetId: string,
    reason: string
  ) => void
  /**
   * 既存の枠に動画を追加する。
   * 🔴 追加できるのは asset だけ。枠(slot)は V1 では増やせない (§7, §12)。
   */
  addCareVideoAsset: (input: {
    videoCode: string
    title: string
    provider: string
    durationSeconds: number
    rightsCleared: boolean
    sourceFileName?: string
  }) => void

  /* ---- 視点(どの組織を見ているか) ---- */

  /**
   * 現在の視点となっている企業。undefined = 全社横断(本部のみ)。
   * 🔴 これは「見え方の絞り込み」であって権限ではない。権限は scope が持つ。
   *    本部が 1 社に絞っても operator の capability は失われない。
   */
  viewCompanyId?: CompanyId
  /** 視点として選べる企業。本部は全契約企業、それ以外は自社 1 件のみ。 */
  viewableCompanies: Company[]
  /** 視点を切り替える。undefined で全社横断へ戻す。 */
  setViewCompany: (companyId?: CompanyId) => void
  /** 現在の視点で表示するブランド。本部視点は常に orinnFACE。 */
  branding: Branding

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
