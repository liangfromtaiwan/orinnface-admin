import { useCallback, useMemo, useState, type ReactNode } from "react"

import {
  NotificationsContext,
  VIEW_TOKEN_TTL_SECONDS,
  type AdminNotification,
  type NotificationsValue,
  type ViewGrant,
} from "@/contexts/notifications"

let seq = 0

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])

  const grantView = useCallback(
    (grant: Omit<ViewGrant, "requestId" | "expiresAt">) => {
      seq += 1
      const now = new Date()
      const full: ViewGrant = {
        ...grant,
        requestId: `req_${String(200000 + seq).padStart(6, "0")}`,
        expiresAt: new Date(
          now.getTime() + VIEW_TOKEN_TTL_SECONDS * 1000
        ).toISOString(),
      }
      setNotifications((prev) => [
        {
          id: `ntf_${seq}`,
          kind: "view_grant",
          title: "生画像の一時閲覧が承認されました",
          createdAt: now.toISOString(),
          read: false,
          grant: full,
        },
        ...prev,
      ])
    },
    []
  )

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const value = useMemo<NotificationsValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      grantView,
      markRead,
      markAllRead,
    }),
    [notifications, grantView, markRead, markAllRead]
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}
