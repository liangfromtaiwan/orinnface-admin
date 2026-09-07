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
  const { scope, account } = useSession()
  const { grantView } = useNotifications()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [reason, setReason] = useState("")

  const allowed = can(scope, "raw_image.view_token")
  if (!allowed) {
    return (
      <Button variant="outline" size="sm" disabled title="この権限では発行できません">
        <LockIcon /> 閲覧不可
      </Button>
    )
  }

  function issue() {
    // 実装時は POST /admin/v1/raw-image-assets/{id}/view-tokens を呼ぶ (§12)。
    // §11 のとおり権限・所有・active link・目的・理由を検証してから発行される。
    const trimmed = reason.trim()
    setOpen(false)
    setReason("")
    setPending(true)
    toast.info("一時閲覧を申請しました", {
      description: "権限と理由を検証しています",
    })
    // 検証は非同期。承認されたらヘッダーの通知に届く。
    window.setTimeout(() => {
      setPending(false)
      grantView({
        rawImageAssetId,
        reason: trimmed,
        viewerName: account.displayName,
      })
      toast.success("承認されました", {
        description: `通知から閲覧できます（有効 ${VIEW_TOKEN_TTL_SECONDS / 60} 分）`,
      })
    }, 1200)
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
          <EyeIcon /> {pending ? "検証中…" : "一時閲覧"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>生画像の一時閲覧</DialogTitle>
          <DialogDescription>
            対象 {rawImageAssetId} の署名 URL を {VIEW_TOKEN_TTL_SECONDS} 秒だけ発行します。
            閲覧者・対象・理由・日時・request ID が image_access_logs に記録されます。
            承認されるとヘッダーの通知に届きます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="raw-image-reason">
            閲覧理由(必須)
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
            発行する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
