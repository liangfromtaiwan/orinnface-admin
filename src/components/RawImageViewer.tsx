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
import type { ViewRequest } from "@/contexts/notifications"
import { cn } from "@/lib/utils"

/**
 * ダミー画像の特徴点。眉・目・鼻・唇・輪郭をそれぞれ独立した線として描く。
 * 全部を 1 本の線で繋ぐと顔に見えないため、部位ごとに分けている。
 */
const LANDMARK_GROUPS: [number, number][][] = [
  // 左右の眉
  [[70, 78], [78, 73], [88, 73], [94, 76]],
  [[106, 76], [112, 73], [122, 73], [130, 78]],
  // 左右の目(閉じた輪郭)
  [[73, 88], [80, 83], [89, 83], [95, 88], [88, 92], [80, 92], [73, 88]],
  [[105, 88], [111, 83], [120, 83], [127, 88], [120, 92], [111, 92], [105, 88]],
  // 鼻筋と鼻下
  [[100, 86], [100, 106]],
  [[92, 111], [100, 114], [108, 111]],
  // 唇(上下)
  [[83, 127], [92, 122], [100, 124], [108, 122], [117, 127]],
  [[117, 127], [108, 135], [100, 137], [92, 135], [83, 127]],
  // フェイスライン
  [
    [54, 96], [57, 114], [66, 132], [80, 146], [100, 152],
    [120, 146], [134, 132], [143, 114], [146, 96],
  ],
]

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
  /** 承認済みの申請。expiresAt を持つ。 */
  grant: ViewRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // 1 秒ごとに再描画させ、残り時間は render 時に計算する
  // (effect 内で同期に setState しないため)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!open || !grant?.expiresAt) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [open, grant])

  if (!grant || !grant.expiresAt) return null
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
                {/* 顔の輪郭 */}
                <ellipse cx="100" cy="98" rx="50" ry="64" fill="none"
                         stroke="#3f4652" strokeWidth="1.5" />
                {/* 特徴点群。実装では 478 点の landmark を重ねた画像を表示する */}
                {LANDMARK_GROUPS.map((pts, gi) => (
                  <g key={gi}>
                    <polyline
                      points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
                      fill="none"
                      stroke="#7CB518"
                      strokeWidth="0.9"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                    {pts.map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r="1.5" fill="#7CB518" />
                    ))}
                  </g>
                ))}
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
            <dd>{grant.requesterName}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b py-1">
            <dt className="text-muted-foreground">request ID</dt>
            <dd className="font-mono">{grant.requestId}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b py-1">
            <dt className="text-muted-foreground">承認者</dt>
            <dd>{grant.reviewerName ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b py-1">
            <dt className="text-muted-foreground">失効</dt>
            <dd className="tabular-nums">{formatDateTime(grant.expiresAt)}</dd>
          </div>
          <div className="border-b py-1 sm:col-span-2">
            <dt className="text-muted-foreground">申請理由（監査に記録）</dt>
            <dd className="mt-0.5 break-words">{grant.purpose}</dd>
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
