import { useCallback, useMemo, useState, type ReactNode } from "react"

import {
  NotificationsContext,
  VIEW_TOKEN_TTL_SECONDS,
  type NotificationItem,
  type NotificationsValue,
  type ViewRequest,
} from "@/contexts/notifications"
import { useSession } from "@/contexts/session-context"
import { ROLE_LABEL } from "@/lib/domain/types"

let seq = 0

function nextIds() {
  seq += 1
  return {
    id: `vreq_${seq}`,
    requestId: `req_${String(200000 + seq).padStart(6, "0")}`,
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { account, scope } = useSession()
  const [requests, setRequests] = useState<ViewRequest[]>([])

  const submitRequest = useCallback<NotificationsValue["submitRequest"]>(
    ({ rawImageAssetId, purpose }) => {
      const { id, requestId } = nextIds()
      setRequests((prev) => [
        {
          id,
          requestId,
          rawImageAssetId,
          purpose,
          requesterAccountId: account.id,
          requesterName: account.displayName,
          requesterRole: ROLE_LABEL[scope.role],
          requestedAt: new Date().toISOString(),
          status: "pending",
          readByRequester: true,
        },
        ...prev,
      ])
    },
    [account, scope.role]
  )

  const issueDirect = useCallback<NotificationsValue["issueDirect"]>(
    ({ rawImageAssetId, purpose }) => {
      const { id, requestId } = nextIds()
      const now = new Date()
      setRequests((prev) => [
        {
          id,
          requestId,
          rawImageAssetId,
          purpose,
          requesterAccountId: account.id,
          requesterName: account.displayName,
          requesterRole: ROLE_LABEL[scope.role],
          requestedAt: now.toISOString(),
          status: "approved",
          reviewerName: account.displayName,
          reviewedAt: now.toISOString(),
          expiresAt: new Date(
            now.getTime() + VIEW_TOKEN_TTL_SECONDS * 1000
          ).toISOString(),
          readByRequester: false,
        },
        ...prev,
      ])
    },
    [account, scope.role]
  )

  const approve = useCallback(
    (id: string) => {
      const now = new Date()
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "approved",
                reviewerName: account.displayName,
                reviewedAt: now.toISOString(),
                expiresAt: new Date(
                  now.getTime() + VIEW_TOKEN_TTL_SECONDS * 1000
                ).toISOString(),
                readByRequester: false,
              }
            : r
        )
      )
    },
    [account.displayName]
  )

  const reject = useCallback(
    (id: string, reason: string) => {
      const now = new Date()
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "rejected",
                reviewerName: account.displayName,
                reviewedAt: now.toISOString(),
                rejectReason: reason,
                readByRequester: false,
              }
            : r
        )
      )
    },
    [account.displayName]
  )

  const markResultRead = useCallback((id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, readByRequester: true } : r))
    )
  }, [])

  const value = useMemo<NotificationsValue>(() => {
    const isOperator = scope.role === "operator"

    // 本部は全件(審査対象)、それ以外は自分が出した申請だけ。
    // 既読になっても一覧からは消さない。
    const items: NotificationItem[] = requests
      .filter((r) => isOperator || r.requesterAccountId === account.id)
      .map((r) => {
        const mine = r.requesterAccountId === account.id
        if (r.status === "pending") {
          return {
            request: r,
            // 本部にとっては対応が必要な案件。開いただけでは既読にしない
            // 本部は審査する側、申請者は自分の申請の状況として見る
            kind: isOperator ? "review" : "result",
            unread: isOperator,
          }
        }
        return {
          request: r,
          kind: mine ? "result" : "review",
          unread: mine ? !r.readByRequester : false,
        }
      })

    return {
      requests,
      items,
      unreadCount: items.filter((i) => i.unread).length,
      submitRequest,
      issueDirect,
      approve,
      reject,
      markResultRead,
    }
  }, [
    requests,
    scope.role,
    account.id,
    submitRequest,
    issueDirect,
    approve,
    reject,
    markResultRead,
  ])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}
