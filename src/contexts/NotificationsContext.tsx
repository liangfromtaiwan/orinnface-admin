import { useCallback, useMemo, useState, type ReactNode } from "react"

import {
  NotificationsContext,
  VIEW_TOKEN_TTL_SECONDS,
  type NotificationsValue,
  type ViewGrant,
} from "@/contexts/notifications"
import { useSession } from "@/contexts/session-context"
import { ROLE_LABEL } from "@/lib/domain/types"

let seq = 0

function nextIds() {
  seq += 1
  return {
    id: `vgrant_${seq}`,
    requestId: `req_${String(200000 + seq).padStart(6, "0")}`,
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { account, scope } = useSession()
  const [grants, setGrants] = useState<ViewGrant[]>([])

  /**
   * 🔴 可否は呼び出し側の decideRawImageView()。ここは state を積むだけ。
   *    実 API 接続時は署名 URL の発行を backend に投げ、同じ条件を再検証する。
   */
  const issue = useCallback<NotificationsValue["issue"]>(
    ({ rawImageAssetId, purpose }) => {
      const { id, requestId } = nextIds()
      const now = new Date()
      setGrants((prev) => [
        {
          id,
          requestId,
          rawImageAssetId,
          purpose,
          issuerAccountId: account.id,
          issuerName: account.displayName,
          issuerRole: ROLE_LABEL[scope.role],
          issuedAt: now.toISOString(),
          expiresAt: new Date(
            now.getTime() + VIEW_TOKEN_TTL_SECONDS * 1000
          ).toISOString(),
          read: false,
        },
        ...prev,
      ])
    },
    [account, scope.role]
  )

  const markRead = useCallback((grantId: string) => {
    setGrants((prev) =>
      prev.map((g) => (g.id === grantId ? { ...g, read: true } : g))
    )
  }, [])

  const value = useMemo<NotificationsValue>(() => {
    // 🔴 ベルは「自分が発行したもの」だけ。横断で追うのは監査画面の役目
    const mine = grants.filter((g) => g.issuerAccountId === account.id)
    return {
      grants: mine,
      unreadCount: mine.filter((g) => !g.read).length,
      issue,
      markRead,
    }
  }, [grants, account.id, issue, markRead])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}
