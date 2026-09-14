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
 * 🔴 動画ファイルは**選ぶだけで、この画面は保存しない**。保存先・変換・配信は
 *    backend の担当 (この repo はフロントエンドのみ)。尺だけはブラウザで
 *    実ファイルから読めるので、手入力させずにそこから埋める。
 */

import { useEffect, useRef, useState } from "react"
import { FilmIcon, UploadIcon } from "lucide-react"
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
import { formatDateTime } from "@/lib/domain/kpi"
import { can } from "@/lib/domain/scope"
import type { CareVideoAsset, CareVideoSlot } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ *
 * 動画ファイルの選択
 *
 * 差し替えと追加の両方から使う。尺を手入力させると実際の動画とずれても
 * 気付けず、ずれた尺は「1分ケア」「3分ケア」の区分と食い違うため、
 * 実ファイルから読んで埋める。
 * ------------------------------------------------------------------ */

function useVideoFile() {
  const [file, setFile] = useState<File | null>(null)
  /** ファイルから読めた尺(秒)。読めない形式のときは undefined。 */
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>()
  /** 拡張子を落としたファイル名。タイトルの既定値に使う。 */
  const [suggestedTitle, setSuggestedTitle] = useState<string | undefined>()
  /** 選んだ動画をその場で再生して確認するための URL。 */
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)
  /** 解放し忘れないよう、今つかんでいる URL を持っておく。 */
  const urlRef = useRef<string | undefined>(undefined)

  function releaseUrl() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = undefined
    }
  }

  // ダイアログを閉じずに画面を離れても解放する
  useEffect(() => releaseUrl, [])

  /**
   * 🔴 読むだけでアップロードしない。
   *    object URL は尺の読み取りと再生確認の両方で使うので、
   *    次のファイルを選んだときか片付けるときにまとめて解放する。
   */
  function pick(picked: File) {
    releaseUrl()
    setFile(picked)
    setSuggestedTitle(picked.name.replace(/\.[^.]+$/, ""))
    setDurationSeconds(undefined)

    const url = URL.createObjectURL(picked)
    urlRef.current = url
    setPreviewUrl(url)

    const probe = document.createElement("video")
    probe.preload = "metadata"
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setDurationSeconds(Math.round(probe.duration))
      }
    }
    // 尺が読めない形式もある。その場合は手入力に任せる
    probe.src = url
  }

  function reset() {
    releaseUrl()
    setFile(null)
    setDurationSeconds(undefined)
    setSuggestedTitle(undefined)
    setPreviewUrl(undefined)
    if (inputRef.current) inputRef.current.value = ""
  }

  return {
    file,
    durationSeconds,
    suggestedTitle,
    previewUrl,
    inputRef,
    pick,
    reset,
  }
}

/* ------------------------------------------------------------------ *
 * 動画の中身の確認
 *
 * 🔴 登録済みの動画はこの画面では再生できない。配信(署名 URL の発行)は
 *    backend の担当なので、代わりに素性を出して取り違えを防ぐ。
 *    これから上げる動画は手元のファイルなのでその場で再生できる。
 * ------------------------------------------------------------------ */

function CareVideoPreview({
  previewUrl,
  label,
}: {
  previewUrl?: string
  label: string
}) {
  if (previewUrl) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <video
          src={previewUrl}
          controls
          preload="metadata"
          className="max-h-56 w-full rounded-md bg-black"
        />
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/40 p-3 text-center">
        <FilmIcon className="size-4 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          登録済みの動画はこの画面では再生できません
        </p>
        <p className="text-[11px] text-muted-foreground">
          再生には backend の配信(署名 URL)が必要です
        </p>
      </div>
    </div>
  )
}

/** 動画の素性。どれを選んでいるかを取り違えないための一覧。 */
function AssetFacts({
  asset,
  extra,
}: {
  asset: CareVideoAsset
  extra?: { label: string; value: string }[]
}) {
  const rows: { label: string; value: string }[] = [
    { label: "タイトル", value: asset.title },
    { label: "提供者", value: asset.provider },
    { label: "尺", value: `${asset.durationSeconds}秒` },
    {
      label: "権利",
      value: asset.rightsCleared ? "確認済" : "未確認(公開できません)",
    },
    ...(asset.sourceFileName
      ? [{ label: "ファイル", value: asset.sourceFileName }]
      : []),
    ...(extra ?? []),
  ]
  return (
    <dl className="grid gap-x-4 gap-y-0.5 rounded-md border p-2.5 text-xs sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">{r.label}</dt>
          <dd
            className={cn(
              "min-w-0 truncate text-right",
              r.label === "権利" && !asset.rightsCleared && "text-amber-700"
            )}
            title={r.value}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function VideoFilePicker({
  file,
  inputRef,
  onPick,
}: {
  file: File | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onPick: (file: File) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">動画ファイル</label>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) onPick(picked)
        }}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
          {file ? "選び直す" : "動画を選ぶ"}
        </Button>
        {file ? (
          <span className="min-w-0 flex-1 truncate text-xs">
            {file.name}
            <span className="ml-1.5 text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">未選択</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        この画面はファイルを読むだけで保存はしません。保存・変換・配信は backend
        側で実装します。
      </p>
    </div>
  )
}

/** 尺の入力。ファイルから読めていればその旨を出す。 */
function DurationField({
  value,
  onChange,
  fromFile,
  hasFile,
}: {
  value: string
  onChange: (v: string) => void
  fromFile: boolean
  hasFile: boolean
}) {
  return (
    <div className="space-y-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder="尺(秒)"
        className="h-9"
      />
      {fromFile ? (
        <p className="text-xs text-muted-foreground">
          選んだファイルから読み取りました。直接書き換えることもできます。
        </p>
      ) : hasFile ? (
        <p className="text-xs text-muted-foreground">
          このファイルからは尺を読み取れませんでした。秒数を入力してください。
        </p>
      ) : null}
    </div>
  )
}

/** 🔴 権利確認は本部の棚卸し (§7.1, §16 P0)。未確認の動画は公開できない。 */
function RightsField({
  canClear,
  checked,
  onChange,
}: {
  canClear: boolean
  checked: boolean
  onChange: (v: boolean) => void
}) {
  if (!canClear) {
    return (
      <p className="text-xs text-muted-foreground">
        権利確認は本部が行います。追加した動画は権利未確認の状態で登録され、
        確認が済むまで公開できません。
      </p>
    )
  }
  return (
    <label className="flex items-start gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        権利確認済として登録する
        <span className="block text-muted-foreground">
          提供者・内容・権利を確認したうえでチェックしてください。未確認の動画は
          公開できません。
        </span>
      </span>
    </label>
  )
}

/* ------------------------------------------------------------------ *
 * 差し替え(本部デフォルトの直接切り替え)
 * ------------------------------------------------------------------ */

type ReplaceMode = "existing" | "upload"

export function CareReplaceDialog({
  slot,
  currentAssetId,
  children,
}: {
  slot: CareVideoSlot
  currentAssetId?: string
  children: React.ReactNode
}) {
  const { scope, careAssets, careAssignments, replaceCareAsset, addCareVideoAsset } =
    useSession()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ReplaceMode>("existing")
  const [reason, setReason] = useState("")

  /* 登録済みから選ぶ場合 */
  const [pick, setPick] = useState("")

  /* 新しい動画を上げる場合 */
  const video = useVideoFile()
  const [title, setTitle] = useState("")
  const [provider, setProvider] = useState("")
  const [duration, setDuration] = useState("")
  const [rightsCleared, setRightsCleared] = useState(false)

  const canClearRights = can(scope, "care.approve")

  /** 今この枠で公開されている動画。差し替える前に中身を確かめられるようにする。 */
  const current = careAssets.find((a) => a.id === currentAssetId)
  /** いつ・誰が今の状態にしたか。取り違えの確認に使う。 */
  const currentAssignment = careAssignments.find(
    (a) =>
      a.videoCode === slot.videoCode &&
      a.status === "active" &&
      a.careAssetId === currentAssetId
  )

  /** この枠に登録されている動画だけを候補にする(枠をまたいだ差し替えはしない)。 */
  const candidates = careAssets.filter((a) => a.videoCode === slot.videoCode)
  /**
   * 実際に選べるもの。公開中のものは選べないので、これが空なら
   * 「登録済みから選ぶ」は成立しない。
   * 🔴 枠をまたいだ差し替えはしない。案内の枠に 1分ケアを入れられてしまうと
   *    video_code の意味が崩れる (§7.1)。
   */
  const selectable = candidates.filter((a) => a.id !== currentAssetId)
  const picked = candidates.find((a) => a.id === pick)
  /** 🔴 権利確認が済んでいない動画は公開できない (§7.1)。 */
  const pickedBlocked = picked !== undefined && !picked.rightsCleared

  /* ファイルを選んだら、まだ触っていない項目だけ実ファイルの値で埋める */
  const derivedDuration =
    duration || (video.durationSeconds ? String(video.durationSeconds) : "")
  const derivedTitle = title || video.suggestedTitle || ""
  const seconds = Number(derivedDuration)

  const uploadValid =
    video.file !== null &&
    derivedTitle.trim() !== "" &&
    provider.trim() !== "" &&
    Number.isFinite(seconds) &&
    seconds > 0 &&
    // 上げてすぐ公開するので、権利確認が済んでいないと差し替えられない
    rightsCleared

  const canSubmit =
    reason.trim() !== "" &&
    (mode === "existing" ? picked !== undefined && !pickedBlocked : uploadValid)

  function reset() {
    setMode("existing")
    setPick("")
    setReason("")
    setTitle("")
    setProvider("")
    setDuration("")
    setRightsCleared(false)
    video.reset()
  }

  function submit() {
    if (mode === "existing") {
      if (!picked) return
      replaceCareAsset(slot.videoCode, picked.id, reason.trim())
      toast.success(`${slot.videoCode} を「${picked.title}」に切り替えました`, {
        description: "care_asset_id のみ変更。video_code / pose_code は不変です。",
      })
    } else {
      if (!video.file) return
      /*
        追加してそのまま差し替える。asset の登録と assignment の切り替えは
        別の操作なので、監査にも 2 件残る(追加 / 切り替え)。
      */
      const assetId = addCareVideoAsset({
        videoCode: slot.videoCode,
        title: derivedTitle.trim(),
        provider: provider.trim(),
        durationSeconds: seconds,
        rightsCleared,
        sourceFileName: video.file.name,
      })
      replaceCareAsset(slot.videoCode, assetId, reason.trim())
      toast.success(
        `${slot.videoCode} を「${derivedTitle.trim()}」に切り替えました`,
        { description: "動画を追加してから care_asset_id を切り替えました。" }
      )
    }
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{careSlotLabel(slot)} の差し替え</DialogTitle>
          <DialogDescription>
            本部デフォルトの動画を切り替えます。切り替わるのは care_asset_id だけで、
            video_code・pose_code は変わりません。元の動画は履歴に残ります。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* 差し替える前に、今出ているものを確かめられるようにする */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-medium">
              現在公開中
              {currentAssignment?.previousCareAssetId ? (
                <Badge variant="outline" className="px-1 py-0 text-[10px]">
                  差し替え済み
                </Badge>
              ) : null}
            </h3>
            {current ? (
              <>
                <AssetFacts
                  asset={current}
                  extra={[
                    ...(currentAssignment?.startAt
                      ? [
                          {
                            label: "適用",
                            value: formatDateTime(currentAssignment.startAt),
                          },
                        ]
                      : []),
                    ...(currentAssignment?.approvedBy
                      ? [{ label: "実行者", value: currentAssignment.approvedBy }]
                      : []),
                  ]}
                />
                <CareVideoPreview label="中身の確認" />
              </>
            ) : (
              <p className="text-xs text-destructive">
                この枠に公開中の動画がありません。
              </p>
            )}
          </section>

          {/* 登録済みから選ぶか、新しく上げるか */}
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {(
              [
                ["existing", "登録済みから選ぶ"],
                ["upload", "新しい動画を上げる"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={cn(
                  "flex-1 rounded-sm px-2 py-1 text-xs transition-colors",
                  mode === key
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "existing" ? (
            <>
              <Select
                value={pick}
                onValueChange={setPick}
                disabled={selectable.length === 0}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue
                    placeholder={
                      selectable.length === 0
                        ? "この枠には他の動画がありません"
                        : "この枠の動画から選ぶ"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id}
                      disabled={a.id === currentAssetId}
                    >
                      {a.title}
                      {a.id === currentAssetId ? "（公開中）" : ""}
                      {a.rightsCleared ? "" : "（権利未確認）"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectable.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  この枠に登録されている動画は公開中の 1 本だけです。
                  差し替えるには、先に動画を追加してください。
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-1 py-0 text-xs"
                    onClick={() => setMode("upload")}
                  >
                    新しい動画を上げる
                  </Button>
                </p>
              ) : null}

              {picked ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium">切り替え先</h3>
                  <AssetFacts asset={picked} />
                  <CareVideoPreview label="中身の確認" />
                </div>
              ) : null}

              {pickedBlocked ? (
                <p className="text-xs text-amber-700">
                  この動画は権利確認が未完了のため公開できません。先に権利を
                  確認してください。
                </p>
              ) : null}
            </>
          ) : (
            <>
              <VideoFilePicker
                file={video.file}
                inputRef={video.inputRef}
                onPick={video.pick}
              />
              {video.previewUrl ? (
                <CareVideoPreview
                  previewUrl={video.previewUrl}
                  label="上げる動画の確認"
                />
              ) : null}
              <Input
                value={derivedTitle}
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
              <DurationField
                value={derivedDuration}
                onChange={setDuration}
                fromFile={video.durationSeconds !== undefined && duration === ""}
                hasFile={video.file !== null}
              />
              <RightsField
                canClear={canClearRights}
                checked={rightsCleared}
                onChange={setRightsCleared}
              />
              {canClearRights && video.file && !rightsCleared ? (
                <p className="text-xs text-amber-700">
                  上げた動画をそのまま公開するので、権利確認のチェックが必要です。
                </p>
              ) : null}
            </>
          )}

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
            <Button size="sm" disabled={!canSubmit} onClick={submit}>
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
  const video = useVideoFile()

  /** 🔴 権利確認は本部の棚卸し (§7.1, §16 P0)。本部以外は未確認から始める。 */
  const canClearRights = can(scope, "care.approve")

  const derivedDuration =
    duration || (video.durationSeconds ? String(video.durationSeconds) : "")
  const derivedTitle = title || video.suggestedTitle || ""
  const seconds = Number(derivedDuration)

  const valid =
    video.file !== null &&
    videoCode !== "" &&
    derivedTitle.trim() !== "" &&
    provider.trim() !== "" &&
    Number.isFinite(seconds) &&
    seconds > 0

  function reset() {
    setVideoCode("")
    setTitle("")
    setProvider("")
    setDuration("")
    setRightsCleared(false)
    video.reset()
  }

  function submit() {
    if (!video.file) return
    addCareVideoAsset({
      videoCode,
      title: derivedTitle.trim(),
      provider: provider.trim(),
      durationSeconds: seconds,
      rightsCleared: canClearRights && rightsCleared,
      sourceFileName: video.file.name,
    })
    toast.success(`「${derivedTitle.trim()}」を追加しました`, {
      description:
        canClearRights && rightsCleared
          ? "差し替えの候補として選べます。"
          : "権利確認が未完了のため、このままでは公開できません。",
    })
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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

          <VideoFilePicker
            file={video.file}
            inputRef={video.inputRef}
            onPick={video.pick}
          />
          {video.previewUrl ? (
            <CareVideoPreview
              previewUrl={video.previewUrl}
              label="追加する動画の確認"
            />
          ) : null}

          <Input
            value={derivedTitle}
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
          <DurationField
            value={derivedDuration}
            onChange={setDuration}
            fromFile={video.durationSeconds !== undefined && duration === ""}
            hasFile={video.file !== null}
          />
          <RightsField
            canClear={canClearRights}
            checked={rightsCleared}
            onChange={setRightsCleared}
          />

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

/** ファイルサイズを人が読める形にする。 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
