/**
 * 生画像 一時閲覧の申請・審査 (ヘッダーのベル)
 *
 * 🔴 流れ (使用者確定 2026-09-07):
 *    1. 店舗スタッフ・店舗管理者・契約企業管理者が閲覧を申請する(理由必須)
 *    2. 申請は本部(operator)にだけ通知される
 *    3. 本部が内容を見て「承認」か「却下」を決める
 *    4. 却下する場合は理由を入力し、それが申請者に見える
 *    5. 承認されると申請者に通知が届き、署名 URL 300 秒で閲覧できる
 *
 * ⚠️ 仕様書 v1.0 §11 は「権限・所有・active link・目的・理由を検証し署名URL300秒」
 *    としか書いておらず、人による承認ステップは規定されていない。
 *    この承認フロー自体が §11 への追加なので、確定したら仕様書側にも反映が必要。
 *
 * 本部自身は承認者なので、申請を経ずに直接発行する(§2 の「理由入力と監査付き
 * token を別操作で発行する」に沿う)。
 */

import { createContext, useContext } from "react"

export type ViewRequestStatus = "pending" | "approved" | "rejected"

export const VIEW_REQUEST_STATUS_LABEL: Record<ViewRequestStatus, string> = {
  pending: "審査待ち",
  approved: "承認済み",
  rejected: "却下",
}

export type ViewRequest = {
  id: string
  rawImageAssetId: string
  /** 申請理由。監査に記録される。 */
  purpose: string
  requesterAccountId: string
  requesterName: string
  requesterRole: string
  requestedAt: string
  status: ViewRequestStatus
  /** 監査ログの request ID */
  requestId: string

  reviewerName?: string
  reviewedAt?: string
  /** 却下の理由。申請者に見せる。 */
  rejectReason?: string
  /** 承認時のみ。署名 URL の失効時刻。 */
  expiresAt?: string

  /** 申請者が結果を読んだか(未読バッジ用)。 */
  readByRequester: boolean
}

/**
 * ベルに出す 1 件。既読になっても一覧からは消さず、点だけ落とす。
 *
 * kind:
 *   review … 本部が審査する側として見る。status が pending の間は
 *             対応が必要なので、開いただけでは既読にしない
 *   result … 自分が出した申請の結果として見る。開いたら既読
 */
export type NotificationItem = {
  request: ViewRequest
  kind: "review" | "result"
  unread: boolean
}

export type NotificationsValue = {
  /** すべての申請。 */
  requests: ViewRequest[]
  /** ベルに出す一覧(既読を含む・新しい順)。 */
  items: NotificationItem[]
  unreadCount: number

  submitRequest: (input: {
    rawImageAssetId: string
    purpose: string
  }) => void
  approve: (requestId: string) => void
  reject: (requestId: string, reason: string) => void
  markResultRead: (requestId: string) => void
  /** 本部が申請を経ずに自分で発行する。 */
  issueDirect: (input: { rawImageAssetId: string; purpose: string }) => void
}

export const NotificationsContext = createContext<NotificationsValue | null>(null)

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider")
  }
  return ctx
}

/** 署名 URL の有効秒数 (§11)。 */
export const VIEW_TOKEN_TTL_SECONDS = 300
