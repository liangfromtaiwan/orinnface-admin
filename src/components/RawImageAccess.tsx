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
import { useSession } from "@/contexts/session-context"
import { can } from "@/lib/domain/scope"

/** 署名 URL の有効秒数 (§11)。 */
export const VIEW_TOKEN_TTL_SECONDS = 300

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
  const [open, setOpen] = useState(false)
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
    // reason / actor / target / request_id は image_access_logs へ記録される。
    toast.success(`一時閲覧 token を発行しました (有効 ${VIEW_TOKEN_TTL_SECONDS} 秒)`, {
      description: `対象 ${rawImageAssetId} / 閲覧者 ${account.displayName} / 理由は監査に記録されます`,
    })
    setOpen(false)
    setReason("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} title={disabledReason}>
          <EyeIcon /> 一時閲覧
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>生画像の一時閲覧</DialogTitle>
          <DialogDescription>
            対象 {rawImageAssetId} の署名 URL を {VIEW_TOKEN_TTL_SECONDS} 秒だけ発行します。
            閲覧者・対象・理由・日時・request ID が image_access_logs に記録されます。
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
