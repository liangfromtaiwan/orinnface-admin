/**
 * 生画像の一時閲覧ビュー (仕様書 v1.0 §11)
 *
 * 承認された署名 URL は 300 秒で失効する。残り時間を常に見せ、
 * 失効したら画像を閉じる。この閲覧自体が image_access_logs に記録される
 * ことも画面上に出す(あとで監査されることを閲覧者が認識できるように)。
 *
 * ⚠️ 画像はデモ用のダミー。実装では署名 URL を img に渡す。
 *    Cache-Control: private, no-store のため保存・共有はできない。
 */

import { useEffect, useState } from "react"
import { AlertTriangleIcon, LockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDateTime } from "@/lib/domain/kpi"
import type { ViewGrant } from "@/contexts/notifications"
import { cn } from "@/lib/utils"

function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function RawImageViewer({
  grant,
  open,
  onOpenChange,
}: {
  grant: ViewGrant | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // 1 秒ごとに再描画させ、残り時間は render 時に計算する
  // (effect 内で同期に setState しないため)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!open || !grant) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [open, grant])

  if (!grant) return null
  const left = secondsLeft(grant.expiresAt)
  const expired = left <= 0
  const urgent = left > 0 && left <= 60

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            生画像の一時閲覧
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 font-mono text-xs tabular-nums",
                expired
                  ? "bg-muted text-muted-foreground"
                  : urgent
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-foreground"
              )}
            >
              {expired ? "失効" : `残り ${mmss(left)}`}
            </span>
          </DialogTitle>
          <DialogDescription>
            この閲覧は image_access_logs に記録されます。画像は保存・共有できません。
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-md border bg-muted/40">
          {expired ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
              <LockIcon className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">有効期限が切れました</p>
              <p className="text-xs text-muted-foreground">
                続けて確認する場合は、理由を入力して再度発行してください。
              </p>
            </div>
          ) : (
            <div className="relative flex h-64 items-center justify-center bg-zinc-900">
              {/* デモ用のダミー。実装では署名 URL の画像を表示する。 */}
              <svg viewBox="0 0 200 200" className="h-56 w-56" aria-label="ダミー画像">
                <ellipse cx="100" cy="100" rx="52" ry="66" fill="none"
                         stroke="#4b5563" stroke-width="1.5" />
                <g fill="#7CB518">
                  <circle cx="82" cy="88" r="2.5" /><circle cx="118" cy="88" r="2.5" />
                  <circle cx="100" cy="104" r="2.5" /><circle cx="88" cy="124" r="2.5" />
                  <circle cx="112" cy="124" r="2.5" /><circle cx="100" cy="128" r="2.5" />
                  <circle cx="70" cy="100" r="2" /><circle cx="130" cy="100" r="2" />
                  <circle cx="76" cy="76" r="2" /><circle cx="124" cy="76" r="2" />
                </g>
                <g stroke="#7CB518" stroke-width="1" opacity=".55" fill="none">
                  <path d="M76 76 L82 88 L70 100 L88 124 L100 128 L112 124 L130 100 L118 88 L124 76" />
                  <path d="M82 88 L100 104 L118 88" />
                </g>
              </svg>
              <span className="absolute bottom-2 left-3 font-mono text-[11px] text-zinc-500">
                デモ用のダミー画像（骨格点オーバーレイ）
              </span>
            </div>
          )}
        </div>

        <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-2 border-b py-1">
            <dt className="text-muted-foreground">対象 asset</dt>
            <dd className="font-mono">{grant.rawImageAssetId}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b py-1">
            <dt className="text-muted-foreground">閲覧者</dt>
            <dd>{grant.viewerName}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b py-1">
            <dt className="text-muted-foreground">request ID</dt>
            <dd className="font-mono">{grant.requestId}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b py-1">
            <dt className="text-muted-foreground">失効</dt>
            <dd className="tabular-nums">{formatDateTime(grant.expiresAt)}</dd>
          </div>
          <div className="border-b py-1 sm:col-span-2">
            <dt className="text-muted-foreground">閲覧理由（監査に記録）</dt>
            <dd className="mt-0.5">{grant.reason}</dd>
          </div>
        </dl>

        {urgent ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangleIcon className="size-3.5" />
            まもなく失効します。
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
