/**
 * care 動画の中身の確認
 *
 * 🔴 §7.1 は本部が「提供者・**内容**・権利・承認状態・公開期間・対象 scope を確認して
 *    approve する」と定めている。素性だけでは内容を確認したことにならないので、
 *    承認の前に必ず再生できる場所を用意する。
 * 🔴 再生元はモック (`mockPlaybackUrl`)。実装では backend の署名 URL に差し替える。
 *    中身は care の動画ではないので、**モックである旨を画面から消さないこと**。
 *    消すと、テストパターンを本物と取り違えたまま承認されうる。
 * 手元で選んだファイル(`previewUrl`)はその場の実ファイルなので、モック注記を出さない。
 */

import { FilmIcon } from "lucide-react"

import { mockPlaybackUrl } from "@/lib/mock/care-video-source"
import type { CareVideoAsset } from "@/lib/domain/types"

export function CareVideoPreview({
  previewUrl,
  asset,
  label,
}: {
  /** これから上げるファイル。手元にあるのでそのまま再生できる。 */
  previewUrl?: string
  /** 登録済みの動画。モックの再生元を引く。 */
  asset?: CareVideoAsset
  label: string
}) {
  const src = previewUrl ?? (asset ? mockPlaybackUrl(asset) : undefined)

  if (!src) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/40 p-3 text-center">
          <FilmIcon className="size-4 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">
            再生できる動画がありません
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <video
        // asset を切り替えたときに前の動画が残らないよう、src を key にする
        key={src}
        src={src}
        controls
        preload="metadata"
        className="max-h-56 w-full rounded-md bg-black"
      />
      {previewUrl ? null : (
        <p className="text-[11px] text-amber-700">
          モックのテストパターンです。実際の配信は backend の署名 URL に差し替えます。
        </p>
      )}
    </div>
  )
}
