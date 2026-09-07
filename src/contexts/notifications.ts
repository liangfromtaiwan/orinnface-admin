/**
 * 管理画面の通知 (ヘッダーのベル)
 *
 * V1 で通知が必要なのは、生画像の一時閲覧が承認されたことの伝達。
 * §11 のとおり閲覧は「権限・所有・active link・目的・理由を検証」してから
 * 署名 URL 300 秒を発行する。検証が通ったことを利用者に知らせ、
 * そこから実際の閲覧画面へ入る。
 *
 * ⚠️ 実装では管理 API からの応答で作る。ここは画面側の入れ物のみ。
 */

import { createContext, useContext } from "react"

export type ViewGrant = {
  /** 対象の生画像 asset */
  rawImageAssetId: string
  /** 監査に記録される閲覧理由 */
  reason: string
  /** 閲覧者 */
  viewerName: string
  /** 署名 URL の失効時刻 (ISO) */
  expiresAt: string
  /** 監査ログの request ID */
  requestId: string
}

export type AdminNotification = {
  id: string
  kind: "view_grant"
  title: string
  createdAt: string
  read: boolean
  grant: ViewGrant
}

export type NotificationsValue = {
  notifications: AdminNotification[]
  unreadCount: number
  /** 一時閲覧の承認を受け取る。 */
  grantView: (grant: Omit<ViewGrant, "requestId" | "expiresAt">) => void
  markRead: (id: string) => void
  markAllRead: () => void
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
