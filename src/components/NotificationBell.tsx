/**
 * 通知ベル — 自分が発行した生画像の一時閲覧 (仕様書 v1.0 §11)
 *
 * 🔴 承認の導線は無い(使用者確定 2026-09-21)。見られる人がその場で発行する。
 *    詳しい経緯と権限は `contexts/notifications.ts` の先頭に書いてある。
 * 🔴 既読になっても一覧から消さない。「さっき何を見たか」を後から確認できる。
 *    横断で追うのは監査画面の役目。
 */

import { useState } from "react"
import { BellIcon } from "lucide-react"

import { RawImageViewer } from "@/components/RawImageViewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useNotifications, type ViewGrant } from "@/contexts/notifications"
import { formatDateTime } from "@/lib/domain/kpi"
import { cn } from "@/lib/utils"

function NotificationRow({
  grant,
  now,
  onSelect,
}: {
  grant: ViewGrant
  /** ベルを開いた時刻。render 中に現在時刻を読まないよう、外から渡す。 */
  now: number
  onSelect: () => void
}) {
  const expired = new Date(grant.expiresAt).getTime() < now

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/50",
        grant.read && "opacity-70"
      )}
    >
      <span className="flex items-start gap-2">
        <span
          aria-hidden
          className={cn(
            "mt-1.5 size-1.5 shrink-0 rounded-full",
            grant.read ? "bg-transparent" : "bg-destructive"
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            生画像の閲覧を発行しました
            {/* 🔴 失効済みかどうかは、開く前に分かるようにする */}
            <Badge variant={expired ? "secondary" : "default"} className="px-1 py-0 text-xs">
              {expired ? "失効済み" : "閲覧できます"}
            </Badge>
          </span>
          <span className="mt-0.5 block text-xs break-words text-muted-foreground">
            対象 {grant.rawImageAssetId}／発行 {grant.issuerName}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
            {formatDateTime(grant.issuedAt)}
          </span>
        </span>
      </span>
    </button>
  )
}

export function NotificationBell() {
  const { grants, unreadCount, markRead } = useNotifications()

  const [open, setOpen] = useState(false)
  const [openedAt, setOpenedAt] = useState(0)
  const [viewing, setViewing] = useState<ViewGrant | null>(null)

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setOpenedAt(Date.now())
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative"
                  aria-label={unreadCount > 0 ? `通知 ${unreadCount} 件` : "通知"}>
            <BellIcon />
            {unreadCount > 0 ? (
              <span aria-hidden
                    className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center
                               rounded-full bg-destructive text-xs font-bold
                               text-destructive-foreground tabular-nums">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-[26rem] p-0">
          <div className="border-b px-3 py-2 text-sm font-medium">通知</div>

          {grants.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              通知はありません
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {grants.map((grant) => (
                <li key={grant.id}>
                  <NotificationRow
                    grant={grant}
                    now={openedAt}
                    onSelect={() => {
                      setOpen(false)
                      markRead(grant.id)
                      setViewing(grant)
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      <RawImageViewer grant={viewing} open={viewing !== null}
                      onOpenChange={(o) => !o && setViewing(null)} />
    </>
  )
}
