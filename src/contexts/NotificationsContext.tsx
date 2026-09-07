import { useCallback, useMemo, useState, type ReactNode } from "react"

import {
  NotificationsContext,
  VIEW_TOKEN_TTL_SECONDS,
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
    // 審査待ちは本部にだけ見せる
    const pendingForReview =
      scope.role === "operator" ? requests.filter((r) => r.status === "pending") : []
    // 結果は申請した本人にだけ見せる
    const resultsForMe = requests.filter(
      (r) =>
        r.requesterAccountId === account.id &&
        r.status !== "pending" &&
        !r.readByRequester
    )
    return {
      requests,
      pendingForReview,
      resultsForMe,
      unreadCount: pendingForReview.length + resultsForMe.length,
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
