/**
 * ヘッダーの通知ベル
 *
 * V1 で通知するのは生画像の一時閲覧の承認。§11 のとおり検証が通ると
 * 署名 URL が 300 秒だけ有効になるので、承認を知らせてそこから閲覧画面へ入る。
 */

import { useState } from "react"
import { BellIcon } from "lucide-react"

import { RawImageViewer } from "@/components/RawImageViewer"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useNotifications, type ViewGrant } from "@/contexts/notifications"
import { formatDateTime } from "@/lib/domain/kpi"

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [grant, setGrant] = useState<ViewGrant | null>(null)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unreadCount > 0 ? `通知 ${unreadCount} 件（未読）` : "通知"
            }
          >
            <BellIcon />
            {unreadCount > 0 ? (
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center
                           rounded-full bg-destructive text-[10px] font-bold
                           text-destructive-foreground tabular-nums"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-96 p-0">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">通知</span>
            {unreadCount > 0 ? (
              <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={markAllRead}>
                すべて既読
              </Button>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              通知はありません
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="w-full border-b px-3 py-2.5 text-left transition-colors
                               last:border-b-0 hover:bg-muted/50"
                    onClick={() => {
                      markRead(n.id)
                      setGrant(n.grant)
                      setOpen(false)
                    }}
                  >
                    <span className="flex items-start gap-2">
                      {!n.read ? (
                        <span aria-hidden
                              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                      ) : (
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{n.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          対象 {n.grant.rawImageAssetId}／理由「{n.grant.reason}」
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      <RawImageViewer
        grant={grant}
        open={grant !== null}
        onOpenChange={(o) => !o && setGrant(null)}
      />
    </>
  )
}
