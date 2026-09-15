/**
 * 推奨基準値・方針の操作 (仕様書 v1.0 §8)
 *
 * 🔴 draft 作成・承認・有効化・予約・rollback は operator のみ。
 *    可否の判定は decideDraftCreate() / decideSetAction() の 1 箇所で行い、
 *    ここで role を直接見て分岐しない。
 * 🔴 active は直接編集できない。値を変えたいときは **draft を新しく作る**。
 * 🔴 §13「重い操作は確認画面と理由入力」に従い、状態を進める操作には理由を必須にする。
 *    理由は §11 の変更監査 (baseline_change / policy_change / rollback) に残る。
 * 🔴 影響 preview は**試算**であって recommendation_run ではない。保存しないし、
 *    過去の run を書き換えない。
 */

import { useState } from "react"
import { toast } from "sonner"

import { AggregateStat } from "@/components/AggregateStat"
import { PeriodBanner } from "@/components/PageHeader"
import { BaselineDiff, PolicyDiff } from "@/components/RecommendationDiff"
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
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/contexts/session-context"
import { formatDate } from "@/lib/domain/kpi"
import { buildPeriod } from "@/lib/domain/periods"
import {
  POSE_LABEL,
  RECOMMENDATION_POSES,
  SET_ACTION_DENIAL_LABEL,
  SET_ACTION_LABEL,
  SET_ACTION_WARNING_LABEL,
  baselineValuesOf,
  decideDraftCreate,
  decideSetAction,
  diffBaselineSets,
  diffPolicySets,
  previewBaselineImpact,
  previewPolicyImpact,
  type RecommendationPose,
  type SetActionTarget,
  type SetAction,
} from "@/lib/domain/recommendation"
import { recommendationRuns } from "@/lib/mock/seed"
import type {
  RecommendationBaselineSet,
  RecommendationPolicySet,
} from "@/lib/domain/types"

/** 影響 preview の集計期間。画面で切り替えず、条件を固定して読み違いを防ぐ。 */
const IMPACT_PERIOD_KEY = "last_12m" as const

/** 試算に出すサンプルの件数。全件出すと読めないので先頭だけ見せる。 */
const SAMPLE_LIMIT = 8

/* ------------------------------------------------------------------ *
 * draft 作成
 * ------------------------------------------------------------------ */

/**
 * 基準値の draft を作る。
 * 値は「どれかの版をコピーして直す」形にする。5 動作を白紙から打ち直すと
 * 打ち間違いに気付けないため、必ず既存の版との差分として作らせる。
 */
export function BaselineDraftDialog({
  sets,
}: {
  sets: RecommendationBaselineSet[]
}) {
  const { scope, createBaselineDraft } = useSession()
  const decision = decideDraftCreate(scope)
  const [open, setOpen] = useState(false)
  const base = sets.find((s) => s.status === "active") ?? sets[0]
  const [values, setValues] = useState<Record<RecommendationPose, string>>(() =>
    initialValues(base)
  )
  const [note, setNote] = useState("")

  function initialValues(
    from: RecommendationBaselineSet | undefined
  ): Record<RecommendationPose, string> {
    const v = from ? baselineValuesOf(from) : undefined
    return Object.fromEntries(
      RECOMMENDATION_POSES.map((pose) => [pose, v ? String(v[pose]) : ""])
    ) as Record<RecommendationPose, string>
  }

  const parsed = RECOMMENDATION_POSES.map((pose) => ({
    poseCode: pose,
    baseline: Number(values[pose]),
  }))
  const allValid = parsed.every((p) => Number.isFinite(p.baseline) && p.baseline > 0)
  const changedCount = base
    ? parsed.filter((p) => p.baseline !== baselineValuesOf(base)[p.poseCode]).length
    : parsed.length

  if (decision.kind === "denied") {
    return (
      <Button size="sm" disabled title={SET_ACTION_DENIAL_LABEL[decision.reason]}>
        draft を作成
      </Button>
    )
  }

  function submit() {
    createBaselineDraft({ values: parsed, note: note.trim() || undefined })
    toast.success("基準値の draft を作成しました", {
      description: "承認と有効化は別の操作です。有効化するまで推奨は変わりません。",
    })
    setOpen(false)
    setNote("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setValues(initialValues(base))
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">draft を作成</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>基準値 set の draft を作成</DialogTitle>
          <DialogDescription>
            {base ? (
              <>
                <span className="font-mono">{base.version}</span> の値をコピーしています。
                直したところだけが差分になります。
              </>
            ) : (
              "基準となる版がありません。"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {RECOMMENDATION_POSES.map((pose) => {
            const before = base ? baselineValuesOf(base)[pose] : undefined
            const now = Number(values[pose])
            const delta =
              before !== undefined && Number.isFinite(now)
                ? Number((now - before).toFixed(2))
                : undefined
            return (
              <div key={pose} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm">
                  {POSE_LABEL[pose]}
                  <span className="ml-1 text-xs text-muted-foreground">{pose}</span>
                </span>
                <Input
                  type="number"
                  step="0.1"
                  className="h-9 w-28 tabular-nums"
                  value={values[pose]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [pose]: e.target.value }))
                  }
                />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {before === undefined
                    ? ""
                    : delta === undefined || delta === 0
                      ? `${before.toFixed(1)} から変更なし`
                      : `${before.toFixed(1)} → ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                </span>
              </div>
            )
          })}
        </div>

        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="この draft の根拠(監査に残ります)"
        />

        <p className="text-xs text-muted-foreground">
          draft を作っても推奨は変わりません。承認 → 有効化まで進めて初めて次回以降の
          推奨に効きます。過去の推奨は再計算しません。
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            やめる
          </Button>
          <Button
            disabled={!allValid || changedCount === 0}
            title={
              !allValid
                ? "5 動作すべてに正の数値を入れてください"
                : changedCount === 0
                  ? "コピー元と同じ値では draft を作れません"
                  : undefined
            }
            onClick={submit}
          >
            draft を作成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 方針の draft を作る。3 項目とも文章なので、コピー元から書き換える形にする。 */
export function PolicyDraftDialog({ sets }: { sets: RecommendationPolicySet[] }) {
  const { scope, createPolicyDraft } = useSession()
  const decision = decideDraftCreate(scope)
  const [open, setOpen] = useState(false)
  const base = sets.find((s) => s.status === "active") ?? sets[0]
  const [form, setForm] = useState(() => initialForm())
  const [note, setNote] = useState("")

  function initialForm() {
    return {
      tieBreak: base?.tieBreak ?? "",
      missingValueHandling: base?.missingValueHandling ?? "",
      fallback: base?.fallback ?? "",
    }
  }

  const filled =
    form.tieBreak.trim() && form.missingValueHandling.trim() && form.fallback.trim()
  const changed =
    !base ||
    form.tieBreak !== base.tieBreak ||
    form.missingValueHandling !== base.missingValueHandling ||
    form.fallback !== base.fallback

  if (decision.kind === "denied") {
    return (
      <Button size="sm" disabled title={SET_ACTION_DENIAL_LABEL[decision.reason]}>
        draft を作成
      </Button>
    )
  }

  function submit() {
    createPolicyDraft({
      tieBreak: form.tieBreak.trim(),
      missingValueHandling: form.missingValueHandling.trim(),
      fallback: form.fallback.trim(),
      note: note.trim() || undefined,
    })
    toast.success("方針の draft を作成しました", {
      description: "承認と有効化は別の操作です。有効化するまで推奨は変わりません。",
    })
    setOpen(false)
    setNote("")
  }

  const fields: { key: keyof typeof form; label: string; hint: string }[] = [
    {
      key: "tieBreak",
      label: "tie-break",
      hint: "乖離度が同値になったときにどちらを採るか",
    },
    {
      key: "missingValueHandling",
      label: "欠損の扱い",
      hint: "測れなかった動作を候補・母数にどう扱うか",
    },
    {
      key: "fallback",
      label: "fallback",
      hint: "候補が 2 件に満たないときにどうするか",
    },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setForm(initialForm())
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">draft を作成</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>方針 set の draft を作成</DialogTitle>
          <DialogDescription>
            {base ? (
              <>
                <span className="font-mono">{base.version}</span> の文面をコピーしています。
              </>
            ) : (
              "基準となる版がありません。"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <p className="text-sm font-medium">
                {f.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {f.hint}
                </span>
              </p>
              <Textarea
                rows={2}
                value={form[f.key]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="この draft の根拠(監査に残ります)"
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            やめる
          </Button>
          <Button
            disabled={!filled || !changed}
            title={
              !filled
                ? "3 項目とも入力してください"
                : !changed
                  ? "コピー元と同じ内容では draft を作れません"
                  : undefined
            }
            onClick={submit}
          >
            draft を作成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * 影響 preview
 * ------------------------------------------------------------------ */

/**
 * 基準値 draft の影響。
 * 🔴 出しているのは「この draft を有効化したら次回以降の推奨がどう変わるか」の
 *    試算。保存しないし、過去の recommendation_run は書き換えない。
 */
export function BaselineImpactDialog({
  target,
  activeSet,
}: {
  target: RecommendationBaselineSet
  activeSet?: RecommendationBaselineSet
}) {
  const { analysisSessions } = useSession()
  const [open, setOpen] = useState(false)

  if (!activeSet || activeSet.version === target.version) {
    return (
      <Button variant="outline" size="sm" disabled title="比較する有効な版がありません">
        影響 preview
      </Button>
    )
  }

  const period = buildPeriod(IMPACT_PERIOD_KEY)
  const impact = open
    ? previewBaselineImpact(
        recommendationRuns,
        analysisSessions,
        activeSet,
        target,
        period
      )
    : undefined

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          影響 preview
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-base">{target.version}</span> の影響 preview
          </DialogTitle>
          <DialogDescription>
            有効化した場合に次回以降の推奨がどう変わるかの試算です。保存しません。
            過去の推奨は再計算しません。
          </DialogDescription>
        </DialogHeader>

        <PeriodBanner period={period} scopeLabel="推奨の試算" />

        {impact ? (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <BaselineDiff
              rows={diffBaselineSets(activeSet, target)}
              fromVersion={activeSet.version}
              toVersion={target.version}
            />

            <AggregateStat
              title="推奨動作が入れ替わる割合"
              aggregate={impact.aggregate}
              format="rate"
            />

            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">動作が入れ替わる</dt>
                <dd className="tabular-nums">{impact.changed} 件</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">順位だけ入れ替わる</dt>
                <dd className="tabular-nums">{impact.reordered} 件</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">影響を受ける顧客</dt>
                <dd className="tabular-nums">{impact.changedSubjects} 名</dd>
              </div>
            </dl>

            {impact.samples.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                この期間では推奨の変わる分析はありません。
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  変わる分析(新しい順に {Math.min(SAMPLE_LIMIT, impact.samples.length)}{" "}
                  / {impact.samples.length} 件)
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="py-1 pr-3 text-left font-normal">分析</th>
                      <th className="py-1 pr-3 text-left font-normal">現在</th>
                      <th className="py-1 text-left font-normal">draft 適用後</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.samples.slice(0, SAMPLE_LIMIT).map((s) => (
                      <tr key={s.sessionId} className="border-t align-top">
                        <td className="py-1 pr-3">
                          <span className="font-mono text-xs">{s.sessionId}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(s.runAt)}
                            {s.poseChanged ? "" : " ・順位のみ"}
                          </span>
                        </td>
                        <td className="py-1 pr-3 text-muted-foreground">
                          {s.before.map((p) => POSE_LABEL[p]).join(" → ")}
                        </td>
                        <td className="py-1">
                          {s.after.map((p) => POSE_LABEL[p]).join(" → ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 方針 draft の影響。
 * 🔴 tie-break・欠損・fallback は仕様上**文章**なので、文章から結果は計算できない。
 *    ここで出すのは「その規則が実際に効く分析が何件あるか」= 影響の母数であって、
 *    推奨がどう変わるかの予測ではない。率にもしない。
 */
export function PolicyImpactDialog({
  target,
  activeSet,
  activeBaseline,
}: {
  target: RecommendationPolicySet
  activeSet?: RecommendationPolicySet
  activeBaseline?: RecommendationBaselineSet
}) {
  const { analysisSessions } = useSession()
  const [open, setOpen] = useState(false)

  if (!activeSet || activeSet.version === target.version || !activeBaseline) {
    return (
      <Button variant="outline" size="sm" disabled title="比較する有効な版がありません">
        影響 preview
      </Button>
    )
  }

  const period = buildPeriod(IMPACT_PERIOD_KEY)
  const impact = open
    ? previewPolicyImpact(recommendationRuns, analysisSessions, activeBaseline, period)
    : undefined
  const rows = diffPolicySets(activeSet, target)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          影響 preview
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-base">{target.version}</span> の影響 preview
          </DialogTitle>
          <DialogDescription>
            方針は文章で定義されているため、変更後の推奨をここで計算することはできません。
            出しているのは「その規則が効く分析が何件あるか」です。
          </DialogDescription>
        </DialogHeader>

        <PeriodBanner period={period} scopeLabel="規則が効く分析" />

        {impact ? (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <PolicyDiff rows={rows} fromVersion={activeSet.version} />

            <dl className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "対象の分析", value: impact.total, hint: "期間内の推奨" },
                {
                  label: "tie-break が効く",
                  value: impact.tieAffected,
                  hint: "2 位と 3 位が同値",
                },
                {
                  label: "欠損がある",
                  value: impact.missingAffected,
                  hint: "測れなかった動作がある",
                },
                {
                  label: "fallback が効く",
                  value: impact.fallbackAffected,
                  hint: "候補が 2 件未満",
                },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{c.label}</dt>
                  <dd className="mt-0.5 text-lg font-medium tabular-nums">
                    {c.value} 件
                  </dd>
                  <p className="text-xs text-muted-foreground">{c.hint}</p>
                </div>
              ))}
            </dl>

            <p className="text-xs text-muted-foreground">
              母数は現行の基準値{" "}
              <span className="font-mono">{activeBaseline.version}</span>{" "}
              で数えています。件数が 0 の規則は、この期間の実データでは結果に影響しません。
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * 承認・有効化・予約・rollback
 * ------------------------------------------------------------------ */

/**
 * 状態を進める操作のボタン + 確認ダイアログ。
 * 可否は decideSetAction() が決め、できない理由はボタンの title に出す
 * (押せない理由が分からないボタンを置かない)。
 */
export function SetActionButton({
  kind,
  set,
  action,
  onRun,
  variant = "outline",
}: {
  kind: "基準値" | "方針"
  set: SetActionTarget
  action: SetAction
  onRun: (reason: string, scheduledAt?: string) => void
  variant?: "outline" | "ghost"
}) {
  const { scope, account } = useSession()
  const decision = decideSetAction(scope, set, action, account.displayName)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")

  if (decision.kind === "denied") {
    return (
      <Button
        variant={variant}
        size="sm"
        disabled
        title={SET_ACTION_DENIAL_LABEL[decision.reason]}
      >
        {SET_ACTION_LABEL[action]}
      </Button>
    )
  }

  const needsSchedule = action === "schedule"
  const ready = reason.trim() && (!needsSchedule || scheduledAt)

  function submit() {
    onRun(
      reason.trim(),
      needsSchedule ? new Date(scheduledAt).toISOString() : undefined
    )
    setOpen(false)
    setReason("")
    setScheduledAt("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          {SET_ACTION_LABEL[action]}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {kind} set <span className="font-mono text-base">{set.version}</span> を
            {SET_ACTION_LABEL[action]}
          </DialogTitle>
          <DialogDescription>{ACTION_DESCRIPTION[action](kind)}</DialogDescription>
        </DialogHeader>

        {decision.warnings.length > 0 ? (
          <ul className="space-y-1.5">
            {decision.warnings.map((w) => (
              <li
                key={w}
                className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-amber-800"
              >
                {SET_ACTION_WARNING_LABEL[w]}
              </li>
            ))}
          </ul>
        ) : null}

        {needsSchedule ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">有効化する日時</p>
            <Input
              type="datetime-local"
              className="h-9"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        ) : null}

        <Input
          className="h-9"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="理由(監査に残ります)"
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            やめる
          </Button>
          <Button
            disabled={!ready}
            title={!ready ? "理由を入力してください" : undefined}
            onClick={submit}
          >
            {SET_ACTION_LABEL[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const ACTION_DESCRIPTION: Record<SetAction, (kind: string) => string> = {
  approve: () => "承認しても推奨はまだ変わりません。有効化は別の操作です。",
  activate: (kind) =>
    `次回以降の推奨がこの版で計算されます。今まで有効だった${kind} set は退役します。過去の推奨は再計算しません。`,
  schedule: () =>
    "指定した日時に有効化されます。実行までは今の版が有効なままです。",
  rollback: () =>
    "この版の値を持つ draft を新しく作ります。退役した版を直接戻すことはしません。作った draft は承認と有効化が必要です。",
}
