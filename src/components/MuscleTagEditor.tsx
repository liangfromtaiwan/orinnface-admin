/**
 * 動作ごとの関連筋肉タグの編集（吉田さん確定 2026-09-24）
 *
 * 🔴 「その動作に関係する筋肉を示す表示用タグ」。**表示用のみ**で、AI 分析・判定・
 *    推奨順位には影響させない。
 * 🔴 編集できるのは本部だけ。可否は `decideAddMuscleTag()` の 1 箇所で決める。
 * 🔴 押した瞬間には反映しない。編集内容をためて、**保存の前に差分を見せる**。
 *    ユーザーの結果画面に出るものなので、意図しない変更に気付けないと困る。
 * 🔴 保存すると履歴に残る。誰がいつ何を変えたかを後から追えるようにする。
 * 🔴 同じ筋肉が複数の動作に付く(口輪筋・口角下制筋)。名前を直すときは**全動作を
 *    まとめて**直す。1 か所だけ直すと、同じ筋肉が画面上で 2 つの名前になる。
 */

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
import { formatDateTime } from "@/lib/domain/kpi"
import { POSE_DISPLAY } from "@/lib/domain/metrics"
import {
  MAX_TAGS_PER_POSE,
  MUSCLE_TAG_DENIAL_LABEL,
  MUSCLE_TAG_DESCRIPTION,
  addMuscleTag,
  allMuscleNames,
  decideAddMuscleTag,
  diffMuscleTags,
  removeMuscleTag,
  renameMuscleTag,
  type MuscleTagChange,
  type MuscleTagMap,
} from "@/lib/domain/muscles"
import { can } from "@/lib/domain/scope"

/** 1 件の変更を日本語 1 行にする。差分の表示と履歴で同じ文を使う。 */
function changeLabel(change: MuscleTagChange): string {
  const poseLabel = (pose: string) =>
    POSE_DISPLAY.find((p) => p.pose === pose)?.label ?? pose
  if (change.kind === "renamed") {
    return `「${change.from}」を「${change.to}」に改名（${change.poses
      .map(poseLabel)
      .join("・")}）`
  }
  return change.kind === "added"
    ? `${poseLabel(change.pose)} に「${change.name}」を追加`
    : `${poseLabel(change.pose)} から「${change.name}」を削除`
}

function PoseRow({
  pose,
  label,
  cue,
  tags,
  canEdit,
  onAdd,
  onRemove,
}: {
  pose: string
  label: string
  cue: string
  tags: string[]
  canEdit: boolean
  onAdd: (name: string) => void
  onRemove: (name: string) => void
}) {
  const [input, setInput] = useState("")
  const decision = decideAddMuscleTag(canEdit, tags, input)

  function submit() {
    if (decision.kind !== "allowed") return
    onAdd(input)
    setInput("")
  }

  return (
    <div className="space-y-2 border-t py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{cue}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{pose}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {tags.length === 0 ? (
          <span className="text-xs text-muted-foreground">タグなし</span>
        ) : (
          tags.map((tag) => (
            <Badge key={tag} variant="outline" className="gap-1 py-0.5 pr-1 pl-2">
              {tag}
              {canEdit ? (
                <button
                  type="button"
                  aria-label={`${tag} を外す`}
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  onClick={() => onRemove(tag)}
                >
                  <XIcon className="size-3" />
                </button>
              ) : null}
            </Badge>
          ))
        )}
      </div>

      {canEdit ? (
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit()
            }}
            placeholder="筋肉名を追加"
            className="h-8 w-48"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={decision.kind !== "allowed"}
            onClick={submit}
          >
            <PlusIcon /> 追加
          </Button>
          {/* 🔴 弾いた理由は入力欄の側に出す。ボタンを無効にするだけにしない */}
          {input.trim() && decision.kind !== "allowed" ? (
            <span className="text-xs text-destructive">
              {MUSCLE_TAG_DENIAL_LABEL[decision.reason]}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {tags.length} / {MAX_TAGS_PER_POSE} 件（上限は暫定）
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** 全動作にまたがる改名。同じ筋肉が複数の動作に付くため、まとめて直す。 */
function RenameRow({
  draft,
  onRename,
}: {
  draft: MuscleTagMap
  onRename: (from: string, to: string) => void
}) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const names = allMuscleNames(draft)
  const usedIn = from
    ? POSE_DISPLAY.filter((p) => draft[p.pose].includes(from)).length
    : 0
  const ready = Boolean(from) && Boolean(to.trim()) && to.trim() !== from

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm font-medium">筋肉名をまとめて直す</p>
      <p className="text-xs text-muted-foreground">
        同じ筋肉が複数の動作に付いています。1 か所だけ直すと、画面上で同じ筋肉が
        2 つの名前で出ます。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">直す筋肉を選ぶ</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">→</span>
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="新しい名前"
          className="h-8 w-40"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!ready}
          onClick={() => {
            onRename(from, to)
            setFrom("")
            setTo("")
          }}
        >
          直す
        </Button>
        {from ? (
          <span className="text-xs text-muted-foreground">
            {usedIn} 動作で使用中
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function MuscleTagEditor() {
  const { scope, muscleTags, muscleTagHistory, saveMuscleTags } = useSession()
  const canEdit = can(scope, "recommendation.draft")
  /** 保存するまで反映しない編集中の状態。 */
  const [draft, setDraft] = useState<MuscleTagMap>(muscleTags)
  const [confirming, setConfirming] = useState(false)

  const changes = diffMuscleTags(muscleTags, draft)
  const dirty = changes.length > 0

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{MUSCLE_TAG_DESCRIPTION}です。</p>

      <div>
        {POSE_DISPLAY.map((p) => (
          <PoseRow
            key={p.pose}
            pose={p.pose}
            label={p.label}
            cue={p.cue}
            tags={draft[p.pose]}
            canEdit={canEdit}
            onAdd={(name) => setDraft((prev) => addMuscleTag(prev, p.pose, name))}
            onRemove={(name) =>
              setDraft((prev) => removeMuscleTag(prev, p.pose, name))
            }
          />
        ))}
        {canEdit ? (
          <RenameRow
            draft={draft}
            onRename={(from, to) =>
              setDraft((prev) => renameMuscleTag(prev, from, to))
            }
          />
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {dirty
              ? `未保存の変更が ${changes.length} 件あります`
              : "変更はありません"}
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty}
              onClick={() => setDraft(muscleTags)}
            >
              元に戻す
            </Button>
            {/* 🔴 押した瞬間には反映しない。何が変わるかを見せてから保存する */}
            <Dialog open={confirming} onOpenChange={setConfirming}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!dirty}>
                  変更を確認して保存
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>筋肉タグの変更</DialogTitle>
                  <DialogDescription>
                    保存するとユーザーの結果画面に反映されます。AI 分析・判定・
                    推奨の順位には影響しません。
                  </DialogDescription>
                </DialogHeader>
                <ul className="space-y-1">
                  {changes.map((c) => (
                    <li key={changeLabel(c)} className="text-sm">
                      ・{changeLabel(c)}
                    </li>
                  ))}
                </ul>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>
                    やめる
                  </Button>
                  <Button
                    onClick={() => {
                      saveMuscleTags(draft)
                      toast.success(`筋肉タグを保存しました（${changes.length} 件）`)
                      setConfirming(false)
                    }}
                  >
                    保存する
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </span>
        </div>
      ) : null}

      {/* 🔴 誰がいつ何を変えたかを追えるようにする(吉田さん確定 2026-09-24) */}
      <div className="border-t pt-3">
        <p className="text-sm font-medium">変更履歴</p>
        {muscleTagHistory.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            まだ変更はありません。
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {muscleTagHistory.map((entry) => (
              <li key={entry.id} className="border-b pb-2 last:border-0">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(entry.at)} / {entry.by}
                </p>
                <ul className="mt-0.5">
                  {entry.changes.map((c) => (
                    <li key={changeLabel(c)} className="text-sm">
                      ・{changeLabel(c)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
