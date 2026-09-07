/**
 * 生画像の一時閲覧 (仕様書 v1.0 §2, §11)
 *
 * 🔴 operator でも生画像は通常一覧へ表示しない。
 *    理由入力 + 監査付きの署名 URL 300 秒を「別操作」として発行する。
 * 🔴 権限・所有・active link・目的・理由を検証してから発行する。
 */

import { useState } from "react"
import { EyeIcon, LockIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useNotifications, VIEW_TOKEN_TTL_SECONDS } from "@/contexts/notifications"
import { useSession } from "@/contexts/session-context"
import { can } from "@/lib/domain/scope"

export function RawImagePlaceholder({ label }: { label?: string }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/40 p-4 text-center">
      <LockIcon className="size-4 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">
        {label ?? "生画像は一覧に表示しません"}
      </p>
      <p className="text-[11px] text-muted-foreground">
        閲覧には理由の入力と監査記録が必要です
      </p>
    </div>
  )
}

export function RawImageViewButton({
  rawImageAssetId,
  disabled,
  disabledReason,
}: {
  rawImageAssetId: string
  disabled?: boolean
  disabledReason?: string
}) {
  const { scope } = useSession()
  const { submitRequest, issueDirect } = useNotifications()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [reason, setReason] = useState("")

  // 本部は承認者なので自分で発行できる。それ以外は本部へ申請する。
  const isReviewer = can(scope, "raw_image.view_token")
  const canAct = isReviewer || can(scope, "raw_image.request")
  if (!canAct) {
    return (
      <Button variant="outline" size="sm" disabled title="この権限では申請できません">
        <LockIcon /> 閲覧不可
      </Button>
    )
  }

  function issue() {
    // 実装時は POST /admin/v1/raw-image-assets/{id}/view-tokens を呼ぶ (§12)。
    const trimmed = reason.trim()
    setOpen(false)
    setReason("")
    if (isReviewer) {
      issueDirect({ rawImageAssetId, purpose: trimmed })
      toast.success("一時閲覧を発行しました", {
        description: `通知から閲覧できます（有効 ${VIEW_TOKEN_TTL_SECONDS / 60} 分）`,
      })
      return
    }
    setPending(true)
    submitRequest({ rawImageAssetId, purpose: trimmed })
    window.setTimeout(() => setPending(false), 600)
    toast.info("本部へ申請しました", {
      description: "審査の結果は通知でお知らせします",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || pending}
          title={disabledReason}
        >
          <EyeIcon /> {pending ? "送信中…" : isReviewer ? "一時閲覧" : "閲覧を申請"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isReviewer ? "生画像の一時閲覧" : "生画像の閲覧を申請"}
          </DialogTitle>
          <DialogDescription>
            {isReviewer
              ? `対象 ${rawImageAssetId} の署名 URL を ${VIEW_TOKEN_TTL_SECONDS} 秒だけ発行します。`
              : `対象 ${rawImageAssetId} の閲覧を本部へ申請します。承認されると ${VIEW_TOKEN_TTL_SECONDS} 秒だけ閲覧できます。`}
            閲覧者・対象・理由・日時・request ID が image_access_logs に記録されます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="raw-image-reason">
            {isReviewer ? "閲覧理由(必須)" : "申請理由(必須・本部が審査します)"}
          </label>
          <Input
            id="raw-image-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例: 顧客からの問い合わせ対応 (品質確認)"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={issue} disabled={reason.trim().length < 4}>
            {isReviewer ? "発行する" : "申請する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
