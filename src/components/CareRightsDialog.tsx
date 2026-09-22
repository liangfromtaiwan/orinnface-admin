/**
 * 権利確認 (仕様書 v1.0 §7.1)
 *
 * 🔴 §7.1 は本部が「提供者・**内容**・権利」を確認すると定めている。素性を見るだけ
 *    では内容を確認したことにならないので、**中身を再生してから**確認できるようにする。
 * 🔴 確認できるのは本部だけ。可否は `decideRightsClear()` の 1 箇所で決める。
 * 🔴 何を確認したのかを理由として残す。チェックが付いているだけでは、後から
 *    「誰が何をもって確認したのか」が分からない。
 * ⚠️ 確認済に**戻す**操作は用意していない。公開中の動画の権利が切れた場合に何を
 *    どうすべきか(公開も止めるのか)が決まっていないため。→ QUESTIONS #24
 */

import { useState } from "react"
import { toast } from "sonner"

import { CareVideoPreview } from "@/components/CareVideoPreview"
import { ReasonField } from "@/components/ReasonField"
import { isReasonEnough } from "@/components/reason-rules"
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
import { useSession } from "@/contexts/session-context"
import {
  careSlotLabel,
  decideRightsClear,
  getCareSlot,
} from "@/lib/domain/care-catalog"
import type { CareVideoAsset } from "@/lib/domain/types"

/** §7.1 が本部に確認させている項目。確認の観点を画面に出しておく。 */
const CHECK_POINTS = [
  "提供者がこの動画を配信してよい立場にあるか（監修者・制作者との契約）",
  "出演者の肖像の利用に同意があるか",
  "音源・素材に第三者の権利が残っていないか",
  "中身が枠(video_code)の内容と合っているか",
]

export function CareRightsDialog({ asset }: { asset: CareVideoAsset }) {
  const { scope, clearCareAssetRights } = useSession()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  const decision = decideRightsClear(scope, asset)
  if (decision.kind === "denied") {
    // 確認済み・本部以外にはボタンを出さない(押せないボタンを置かない)
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          確認する
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>権利の確認</DialogTitle>
          <DialogDescription>
            中身を見たうえで確認してください。確認済にすると、この動画を枠へ公開
            できるようになります。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">タイトル</dt>
              <dd>{asset.title}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">提供者</dt>
              <dd>{asset.provider}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">枠</dt>
              <dd className="text-xs">
                <span className="font-mono">{asset.videoCode}</span>
                <span className="block text-muted-foreground">
                  {(() => {
                    const slot = getCareSlot(asset.videoCode)
                    return slot ? careSlotLabel(slot) : "—"
                  })()}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">尺 / ファイル</dt>
              <dd className="text-xs">
                {asset.durationSeconds}秒
                <span className="block text-muted-foreground">
                  {asset.sourceFileName ?? "—"}
                </span>
              </dd>
            </div>
          </dl>

          <CareVideoPreview asset={asset} label="中身の確認" />

          <div className="rounded-md border p-3">
            <p className="text-xs font-medium">確認の観点 (§7.1)</p>
            <ul className="mt-1 space-y-0.5">
              {CHECK_POINTS.map((point) => (
                <li key={point} className="text-xs text-muted-foreground">
                  ・{point}
                </li>
              ))}
            </ul>
          </div>

          <ReasonField
            value={reason}
            onChange={setReason}
            label="確認の記録"
            placeholder="例: ルミエールと2026-09-01付の配信許諾を確認"
            hint="何をもって確認したのかを書いてください。監査に残ります。"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            やめる
          </Button>
          <Button
            disabled={!isReasonEnough(reason)}
            title={
              !isReasonEnough(reason) ? "確認の記録を入力してください" : undefined
            }
            onClick={() => {
              clearCareAssetRights(asset.id, reason.trim())
              toast.success(`「${asset.title}」を権利確認済にしました`, {
                description: "この動画を枠へ公開できるようになりました。",
              })
              setOpen(false)
              setReason("")
            }}
          >
            確認済にする
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
