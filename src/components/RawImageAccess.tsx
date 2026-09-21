/**
 * 生画像の閲覧 (仕様書 v1.0 §2, §11 / 吉田さん確定 2026-09-07)
 *
 * 🔴 一覧に生画像は出さない。閲覧は必ずこのボタン経由。
 * 🔴 店舗は「自店で撮影した画像」だけを、**理由入力なし**で閲覧できる。
 *    アクセス履歴は自動保存される。
 * 🔴 本部は横断して閲覧できるが、§2 のとおり**理由入力と監査**が必要。
 * 🔴 それ以外(本人撮影分・他店舗撮影分・同意なし)は表示しない。
 */

import { useState } from "react"
import { EyeIcon, LockIcon } from "lucide-react"
import { toast } from "sonner"

import { ReasonField } from "@/components/ReasonField"
import { REASON_MIN_LENGTH, isReasonEnough } from "@/components/reason-rules"
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
import { useNotifications, VIEW_TOKEN_TTL_SECONDS } from "@/contexts/notifications"
import { useSession } from "@/contexts/session-context"
import { decideRawImageView, RAW_IMAGE_DENIED_LABEL } from "@/lib/domain/scope"
import type { StoreId } from "@/lib/domain/types"

export function RawImagePlaceholder({ label }: { label?: string }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/40 p-4 text-center">
      <LockIcon className="size-4 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">
        {label ?? "生画像は一覧に表示しません"}
      </p>
      <p className="text-[11px] text-muted-foreground">
        閲覧するとアクセス履歴が記録されます
      </p>
    </div>
  )
}

export function RawImageViewButton({
  rawImageAssetId,
  captureStoreId,
  hasConsent = true,
  disabled,
  disabledReason,
}: {
  rawImageAssetId: string
  /** その画像を撮影した店舗。本人が自宅で撮影した場合は undefined。 */
  captureStoreId?: StoreId
  /** 本人が撮影・保存に同意しているか。 */
  hasConsent?: boolean
  disabled?: boolean
  disabledReason?: string
}) {
  const { scope } = useSession()
  const { issueDirect } = useNotifications()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  const decision = decideRawImageView(scope, { captureStoreId, hasConsent })

  if (decision.kind === "denied") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <LockIcon className="size-3.5" />
        {RAW_IMAGE_DENIED_LABEL[decision.reason]}
      </span>
    )
  }

  // 店舗が自店で撮影した画像を見る場合 — 理由入力なしで即発行
  if (decision.kind === "direct") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        title={disabledReason}
        onClick={() => {
          issueDirect({
            rawImageAssetId,
            purpose: "自店で撮影した画像の通常閲覧（理由入力なし）",
          })
          toast.success("閲覧できます", {
            description: `通知から開けます（有効 ${VIEW_TOKEN_TTL_SECONDS / 60} 分）`,
          })
        }}
      >
        <EyeIcon /> 閲覧する
      </Button>
    )
  }

  // 本部の横断閲覧 — §2 のとおり理由入力と監査が必要
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} title={disabledReason}>
          <EyeIcon /> 一時閲覧
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>生画像の一時閲覧（本部）</DialogTitle>
          <DialogDescription>
            対象 {rawImageAssetId} の署名 URL を {VIEW_TOKEN_TTL_SECONDS} 秒だけ発行します。
            本部の横断閲覧には理由の入力が必要です。閲覧者・対象・理由・日時・request ID が
            image_access_logs に記録されます。
          </DialogDescription>
        </DialogHeader>
        <ReasonField
          value={reason}
          onChange={setReason}
          label="閲覧理由"
          placeholder="例: 顧客からの問い合わせ対応（品質確認）"
          hint="image_access_logs に残ります。後から見て目的が分かるように書いてください。"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button
            disabled={!isReasonEnough(reason)}
            title={
              !isReasonEnough(reason)
                ? `閲覧理由を ${REASON_MIN_LENGTH} 文字以上で入力してください`
                : undefined
            }
            onClick={() => {
              issueDirect({ rawImageAssetId, purpose: reason.trim() })
              setOpen(false)
              setReason("")
              toast.success("一時閲覧を発行しました", {
                description: `通知から開けます（有効 ${VIEW_TOKEN_TTL_SECONDS / 60} 分）`,
              })
            }}
          >
            発行する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
