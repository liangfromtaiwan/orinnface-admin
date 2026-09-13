/**
 * care 動画の差し替えと追加 (仕様書 v1.0 §7.1)
 *
 * 🔴 申請するのは契約企業・店舗で、本部は承認する側 (§7.1)。
 *    本部に「差し替え申請」を出させると自分で出して自分で承認する往復になるので、
 *    本部は本部デフォルトを直接差し替える。可否は decideCareReplacement() が決める。
 * 🔴 追加できるのは **asset だけ**。枠(slot)は増やせない。
 *    V1 に POST /admin/v1/care-video-slots は無く、14 番目の枠も作らない (§7, §12)。
 * 🔴 切り替わるのは care_asset_id だけ。video_code / pose_code は不変 (§7.1)。
 * 🔴 §13「重い操作は確認画面と理由入力」に従い理由を必須にする。
 *    理由は §11 の変更監査 (care_replacement) に残る。
 */

import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSession } from "@/contexts/session-context"
import { CARE_VIDEO_SLOTS, careSlotLabel } from "@/lib/domain/care-catalog"
import { can } from "@/lib/domain/scope"
import type { CareVideoSlot } from "@/lib/domain/types"

/* ------------------------------------------------------------------ *
 * 差し替え(本部デフォルトの直接切り替え)
 * ------------------------------------------------------------------ */

export function CareReplaceDialog({
  slot,
  currentAssetId,
  children,
}: {
  slot: CareVideoSlot
  currentAssetId?: string
  children: React.ReactNode
}) {
  const { careAssets, replaceCareAsset } = useSession()
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState("")
  const [reason, setReason] = useState("")

  /** この枠に登録されている動画だけを候補にする(枠をまたいだ差し替えはしない)。 */
  const candidates = careAssets.filter((a) => a.videoCode === slot.videoCode)
  const picked = candidates.find((a) => a.id === pick)
  /** 🔴 権利確認が済んでいない動画は公開できない (§7.1)。 */
  const blocked = picked !== undefined && !picked.rightsCleared

  function submit() {
    if (!picked) return
    replaceCareAsset(slot.videoCode, picked.id, reason.trim())
    toast.success(`${slot.videoCode} を「${picked.title}」に切り替えました`, {
      description: "care_asset_id のみ変更。video_code / pose_code は不変です。",
    })
    setOpen(false)
    setPick("")
    setReason("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{careSlotLabel(slot)} の差し替え</DialogTitle>
          <DialogDescription>
            本部デフォルトの動画を切り替えます。切り替わるのは care_asset_id だけで、
            video_code・pose_code は変わりません。元の動画は履歴に残ります。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="この枠の動画から選ぶ" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((a) => (
                <SelectItem key={a.id} value={a.id} disabled={a.id === currentAssetId}>
                  {a.title}
                  {a.id === currentAssetId ? "（公開中）" : ""}
                  {a.rightsCleared ? "" : "（権利未確認）"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {blocked ? (
            <p className="text-xs text-amber-700">
              この動画は権利確認が未完了のため公開できません。先に権利を確認してください。
            </p>
          ) : null}

          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="切り替えの理由(監査に残ります)"
            className="h-9"
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              やめる
            </Button>
            <Button
              size="sm"
              disabled={!picked || blocked || !reason.trim()}
              onClick={submit}
            >
              差し替える
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * 動画の追加(既存の枠に asset を足す)
 * ------------------------------------------------------------------ */

export function CareAssetAddDialog({ children }: { children: React.ReactNode }) {
  const { scope, addCareVideoAsset } = useSession()
  const [open, setOpen] = useState(false)
  const [videoCode, setVideoCode] = useState("")
  const [title, setTitle] = useState("")
  const [provider, setProvider] = useState("")
  const [duration, setDuration] = useState("")
  const [rightsCleared, setRightsCleared] = useState(false)

  /** 🔴 権利確認は本部の棚卸し (§7.1, §16 P0)。本部以外は未確認から始める。 */
  const canClearRights = can(scope, "care.approve")

  const seconds = Number(duration)
  const valid =
    videoCode !== "" &&
    title.trim() !== "" &&
    provider.trim() !== "" &&
    Number.isFinite(seconds) &&
    seconds > 0

  function submit() {
    addCareVideoAsset({
      videoCode,
      title: title.trim(),
      provider: provider.trim(),
      durationSeconds: seconds,
      rightsCleared: canClearRights && rightsCleared,
    })
    toast.success(`「${title.trim()}」を追加しました`, {
      description:
        canClearRights && rightsCleared
          ? "差し替えの候補として選べます。"
          : "権利確認が未完了のため、このままでは公開できません。",
    })
    setOpen(false)
    setVideoCode("")
    setTitle("")
    setProvider("")
    setDuration("")
    setRightsCleared(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>動画を追加</DialogTitle>
          <DialogDescription>
            既存の枠に動画を追加します。追加した動画は差し替えの候補になります。
            枠そのものは V1 では増やせません。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">追加する枠</label>
            <Select value={videoCode} onValueChange={setVideoCode}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="固定 13 枠から選ぶ" />
              </SelectTrigger>
              <SelectContent>
                {CARE_VIDEO_SLOTS.map((s) => (
                  <SelectItem key={s.videoCode} value={s.videoCode}>
                    {careSlotLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="動画のタイトル"
            className="h-9"
          />
          <Input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="提供者(制作・監修)"
            className="h-9"
          />
          <Input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            inputMode="numeric"
            placeholder="尺(秒)"
            className="h-9"
          />

          {canClearRights ? (
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={rightsCleared}
                onChange={(e) => setRightsCleared(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                権利確認済として登録する
                <span className="block text-muted-foreground">
                  提供者・内容・権利を確認したうえでチェックしてください。
                  未確認の動画は公開できません。
                </span>
              </span>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              権利確認は本部が行います。追加した動画は権利未確認の状態で登録され、
              確認が済むまで公開できません。
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            <Badge variant="outline" className="mr-1.5 px-1 py-0 text-[10px]">
              V1
            </Badge>
            追加できるのは動画だけです。枠(video_code)は固定 13 枠から増やせません。
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              やめる
            </Button>
            <Button size="sm" disabled={!valid} onClick={submit}>
              追加する
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
