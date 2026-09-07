/**
 * ヘッダーの通知ベル
 *
 * 出す内容はアカウントで変わる。
 *   本部(operator) … 審査待ちの申請。ここから承認 / 却下する
 *   申請者          … 自分の申請の結果。承認なら閲覧、却下なら理由を見る
 */

import { useState } from "react"
import { BellIcon, CheckIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { RawImageViewer } from "@/components/RawImageViewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useNotifications, type ViewRequest } from "@/contexts/notifications"
import { formatDateTime } from "@/lib/domain/kpi"

export function NotificationBell() {
  const {
    pendingForReview,
    resultsForMe,
    unreadCount,
    approve,
    reject,
    markResultRead,
  } = useNotifications()

  const [open, setOpen] = useState(false)
  const [reviewing, setReviewing] = useState<ViewRequest | null>(null)
  const [viewing, setViewing] = useState<ViewRequest | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  function closeReview() {
    setReviewing(null)
    setRejecting(false)
    setRejectReason("")
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative"
                  aria-label={unreadCount > 0 ? `通知 ${unreadCount} 件` : "通知"}>
            <BellIcon />
            {unreadCount > 0 ? (
              <span aria-hidden
                    className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center
                               rounded-full bg-destructive text-[10px] font-bold
                               text-destructive-foreground tabular-nums">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-[26rem] p-0">
          <div className="border-b px-3 py-2 text-sm font-medium">通知</div>

          {unreadCount === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              通知はありません
            </p>
          ) : null}

          {pendingForReview.length > 0 ? (
            <>
              <p className="bg-muted/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                審査待ちの申請
              </p>
              <ul>
                {pendingForReview.map((r) => (
                  <li key={r.id}>
                    <button type="button"
                            className="w-full border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                            onClick={() => { setReviewing(r); setOpen(false) }}>
                      <span className="flex items-start gap-2">
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            生画像の一時閲覧の申請
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {r.requesterName}（{r.requesterRole}）／対象 {r.rawImageAssetId}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                            {formatDateTime(r.requestedAt)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {resultsForMe.length > 0 ? (
            <>
              <p className="bg-muted/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                自分の申請の結果
              </p>
              <ul>
                {resultsForMe.map((r) => (
                  <li key={r.id}>
                    <button type="button"
                            className="w-full border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                            onClick={() => {
                              markResultRead(r.id)
                              setOpen(false)
                              if (r.status === "approved") setViewing(r)
                              else
                                toast.error("申請は却下されました", {
                                  description: `理由: ${r.rejectReason}`,
                                })
                            }}>
                      <span className="flex items-start gap-2">
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {r.status === "approved" ? "承認されました" : "却下されました"}
                            <Badge variant={r.status === "approved" ? "default" : "secondary"}
                                   className="px-1 py-0 text-[10px]">
                              {r.status === "approved" ? "閲覧できます" : "理由あり"}
                            </Badge>
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            対象 {r.rawImageAssetId}／審査 {r.reviewerName}
                          </span>
                          {r.status === "rejected" ? (
                            <span className="mt-0.5 block text-xs text-destructive">
                              {r.rejectReason}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </PopoverContent>
      </Popover>

      {/* 本部の審査画面 */}
      <Dialog open={reviewing !== null} onOpenChange={(o) => !o && closeReview()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生画像 一時閲覧の審査</DialogTitle>
            <DialogDescription>
              承認すると申請者に通知され、署名 URL が 300 秒だけ有効になります。
              判断と理由は監査に記録されます。
            </DialogDescription>
          </DialogHeader>

          {reviewing ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3 border-b py-1">
                <dt className="text-muted-foreground">申請者</dt>
                <dd>{reviewing.requesterName}（{reviewing.requesterRole}）</dd>
              </div>
              <div className="flex justify-between gap-3 border-b py-1">
                <dt className="text-muted-foreground">対象 asset</dt>
                <dd className="font-mono text-xs">{reviewing.rawImageAssetId}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b py-1">
                <dt className="text-muted-foreground">申請日時</dt>
                <dd className="tabular-nums">{formatDateTime(reviewing.requestedAt)}</dd>
              </div>
              <div className="border-b py-1">
                <dt className="text-muted-foreground">申請理由</dt>
                <dd className="mt-0.5">{reviewing.purpose}</dd>
              </div>
            </dl>
          ) : null}

          {rejecting ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="reject-reason">
                却下の理由（申請者に表示されます）
              </label>
              <Input id="reject-reason" value={rejectReason} autoFocus
                     onChange={(e) => setRejectReason(e.target.value)}
                     placeholder="例: 業務上の必要性が確認できません" />
            </div>
          ) : null}

          <DialogFooter>
            {rejecting ? (
              <>
                <Button variant="outline" onClick={() => setRejecting(false)}>
                  戻る
                </Button>
                <Button variant="destructive" disabled={rejectReason.trim().length < 4}
                        onClick={() => {
                          if (!reviewing) return
                          reject(reviewing.id, rejectReason.trim())
                          toast.success("却下しました", {
                            description: "理由が申請者に通知されます",
                          })
                          closeReview()
                        }}>
                  却下する
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setRejecting(true)}>
                  <XIcon /> 却下
                </Button>
                <Button onClick={() => {
                          if (!reviewing) return
                          approve(reviewing.id)
                          toast.success("承認しました", {
                            description: "申請者に通知されます",
                          })
                          closeReview()
                        }}>
                  <CheckIcon /> 承認
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RawImageViewer grant={viewing} open={viewing !== null}
                      onOpenChange={(o) => !o && setViewing(null)} />
    </>
  )
}
