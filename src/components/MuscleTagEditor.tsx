/**
 * 動作ごとの関連筋肉タグの編集
 *
 * 🔴 ユーザー向け結果画面の各動作カードに出るタグ。表示だけの情報で、推奨の順位や
 *    判定には使わない。
 * 🔴 編集できるのは本部だけ。可否は `decideAddMuscleTag()` の 1 箇所で決める。
 * 🔴 同じ筋肉が複数の動作に付く(口輪筋・口角下制筋)。名前を直すときは**全動作を
 *    まとめて**直す。1 か所だけ直すと、同じ筋肉が画面上で 2 つの名前になる。
 */

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSession } from "@/contexts/session-context"
import { POSE_DISPLAY } from "@/lib/domain/metrics"
import {
  MAX_TAGS_PER_POSE,
  MUSCLE_TAG_DENIAL_LABEL,
  allMuscleNames,
  decideAddMuscleTag,
  type MusclePose,
} from "@/lib/domain/muscles"
import { can } from "@/lib/domain/scope"

function PoseRow({ pose, label, cue }: { pose: MusclePose; label: string; cue: string }) {
  const { scope, muscleTags, addMuscleTag, removeMuscleTag } = useSession()
  const canEdit = can(scope, "recommendation.draft")
  const [input, setInput] = useState("")

  const tags = muscleTags[pose]
  const decision = decideAddMuscleTag(canEdit, tags, input)

  function submit() {
    if (decision.kind !== "allowed") return
    addMuscleTag(pose, input)
    toast.success(`${label} に「${input.trim()}」を追加しました`)
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
                  onClick={() => {
                    removeMuscleTag(pose, tag)
                    toast.success(`${label} から「${tag}」を外しました`)
                  }}
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
            title={
              decision.kind !== "allowed" && input.trim()
                ? MUSCLE_TAG_DENIAL_LABEL[decision.reason]
                : undefined
            }
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
              {tags.length} / {MAX_TAGS_PER_POSE} 件
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** 全動作にまたがる改名。同じ筋肉が複数の動作に付くため、まとめて直す。 */
function RenameRow() {
  const { scope, muscleTags, renameMuscleTag } = useSession()
  const canEdit = can(scope, "recommendation.draft")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  if (!canEdit) return null

  const names = allMuscleNames(muscleTags)
  const usedIn = from
    ? POSE_DISPLAY.filter((p) => muscleTags[p.pose].includes(from)).length
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
            renameMuscleTag(from, to)
            toast.success(`「${from}」を「${to.trim()}」に直しました`, {
              description: `${usedIn} 動作に反映しました`,
            })
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
  return (
    <div>
      {POSE_DISPLAY.map((p) => (
        <PoseRow key={p.pose} pose={p.pose} label={p.label} cue={p.cue} />
      ))}
      <RenameRow />
    </div>
  )
}
