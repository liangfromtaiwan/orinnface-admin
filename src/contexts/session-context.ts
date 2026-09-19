/**
 * SessionContext の context 本体と hook。
 * (Provider component は SessionContext.tsx。fast-refresh のため分離している)
 */

import { createContext, useContext } from "react"

import type { Branding } from "@/lib/domain/branding"
import type { CareRequestAction } from "@/lib/domain/care-catalog"
import type {
  RecommendationPose,
  SetAction,
} from "@/lib/domain/recommendation"
import type { MembershipTarget, Scope } from "@/lib/domain/scope"
import type {
  AccountId,
  AdminAccount,
  AuditEvent,
  CareAssignment,
  CareVideoAsset,
  CompanyId,
  AnalysisSession,
  RecommendationBaselineSet,
  RecommendationPolicySet,
  CarePlayback,
  Company,
  Customer,
  Store,
  StoreDataLink,
} from "@/lib/domain/types"
import {
  companies as allCompanies,
  stores as allStores,
} from "@/lib/mock/seed"

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
  /**
   * メールアドレスで招待して担当を割り当てる (吉田さん確定 2026-09-14)。
   * 🔴 呼ぶ前に `decideInvite()` で可否を判定すること。
   * 🔴 招待中のアカウントは本人がパスワードを設定するまで使えない。
   *    招待メールの送信は backend の担当。
   */
  inviteMember: (
    email: string,
    displayName: string,
    target: MembershipTarget,
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
   * 既存の枠に動画を追加し、追加した asset の id を返す。
   * 🔴 追加できるのは asset だけ。枠(slot)は V1 では増やせない (§7, §12)。
   * id を返すのは、追加してそのまま差し替えたい導線があるため。
   */
  addCareVideoAsset: (input: {
    videoCode: string
    title: string
    provider: string
    durationSeconds: number
    rightsCleared: boolean
    sourceFileName?: string
  }) => string

  /**
   * 差し替え申請の審査 (§7.1)。
   * 🔴 呼ぶ前に `decideCareRequestAction()` で可否を判定すること。
   * 🔴 承認すると、同じ枠・同じ範囲で公開中だったものは終了する。
   * 🔴 §11 の変更監査に care_replacement として 1 件残る。
   */
  reviewCareRequest: (
    requestId: string,
    action: CareRequestAction,
    reason: string
  ) => void

  /* ---- 推奨基準値・方針 (§8) ---- */

  baselineSets: RecommendationBaselineSet[]
  policySets: RecommendationPolicySet[]
  /**
   * 基準値の draft を作る。
   * 🔴 呼ぶ前に `decideDraftCreate()` で可否を判定すること。
   * 🔴 作れるのは draft だけ。active を直接書き換える関数は用意しない (§8)。
   */
  createBaselineDraft: (input: {
    values: { poseCode: RecommendationPose; baseline: number }[]
    note?: string
  }) => void
  /**
   * 下書き・承認済の中身を直す (§8 が禁じているのは active の更新)。
   * 🔴 呼ぶ前に `decideSetEdit()` で可否を判定すること。
   * 🔴 承認済を直すと下書きへ戻り、有効化の予約も外れる。
   */
  updateBaselineDraft: (
    version: string,
    input: {
      values: { poseCode: RecommendationPose; baseline: number }[]
      note?: string
    }
  ) => void
  updatePolicyDraft: (
    version: string,
    input: {
      tieBreak: string
      missingValueHandling: string
      fallback: string
      note?: string
    }
  ) => void
  /**
   * 下書き・承認済を消す。
   * 🔴 呼ぶ前に `decideSetDelete()` で可否を判定すること。
   * 🔴 消せるのは有効化していない版だけ。退役した版は過去の推奨の根拠なので消さない。
   * 🔴 §11 の変更監査に deletion として残る。理由は必須。
   */
  deleteBaselineDraft: (version: string, reason: string) => void
  deletePolicyDraft: (version: string, reason: string) => void
  /** 方針の draft を作る。判定は同じく `decideDraftCreate()`。 */
  createPolicyDraft: (input: {
    tieBreak: string
    missingValueHandling: string
    fallback: string
    note?: string
  }) => void
  /**
   * 承認・有効化・有効化予約・rollback を実行する。
   * 🔴 呼ぶ前に `decideSetAction()` で可否を判定すること。
   * 🔴 rollback は retired を戻すのではなく新 draft を起こす (§8)。
   * 🔴 どの操作も §11 の変更監査に 1 件残る(基準値 / 方針 / rollback)。
   */
  runBaselineAction: (
    version: string,
    action: SetAction,
    reason: string,
    scheduledAt?: string
  ) => void
  runPolicyAction: (
    version: string,
    action: SetAction,
    reason: string,
    scheduledAt?: string
  ) => void

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

/**
 * 会社名の解決。
 * 🔴 適用範囲などを「会社全体」とだけ書かない。本部は全社を横断して見るので、
 *    どの会社かを書かないと「全社共通」と読まれる。
 */
export function useCompanyName() {
  const { companies } = useSession()
  return (companyId?: string) => {
    if (!companyId) return "—"
    const found =
      companies.find((c) => c.id === companyId) ??
      allCompanies.find((c) => c.id === companyId)
    return found?.name ?? companyId
  }
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
