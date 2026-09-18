/**
 * 推奨設定 (仕様書 v1.0 §8)
 *
 * 🔴 正式推奨は Backend だけが生成する。AI /v1/recommend は本番で使わない。
 * 🔴 baseline_version(5動作の基準値 set)と policy_version(順位・tie-break・
 *    欠損・fallback 方針)は分離する。
 * 🔴 active 値の直接更新は禁止。過去 recommendation_run を再計算・上書きしない。
 * 🔴 rollback は新 version として実行する。
 */

import {
  BaselineDraftDialog,
  BaselineImpactDialog,
  PolicyDraftDialog,
  PolicyImpactDialog,
  SetActionButton,
} from "@/components/RecommendationDialogs"
import { BaselineDiff, PolicyDiff } from "@/components/RecommendationDiff"
import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useSession } from "@/contexts/session-context"
import { formatDate, formatDateTime } from "@/lib/domain/kpi"
import {
  POSE_LABEL,
  availableActions,
  comparisonBaseFor,
  diffBaselineSets,
  diffPolicySets,
  sortSets,
  type RecommendationPose,
} from "@/lib/domain/recommendation"
import {
  VERSIONED_SET_STATUS_LABEL,
  type RecommendationBaselineSet,
  type RecommendationPolicySet,
  type VersionedSetStatus,
} from "@/lib/domain/types"

function StatusBadge({ status }: { status: VersionedSetStatus }) {
  return (
    <Badge variant={status === "active" ? "default" : "outline"}>
      {VERSIONED_SET_STATUS_LABEL[status]}
    </Badge>
  )
}

/** 作成・承認・有効化の履歴。どの版も同じ並びで出す。 */
function SetMeta({
  set,
}: {
  set: {
    createdBy: string
    createdAt: string
    approvedBy?: string
    activatedAt?: string
    scheduledActivateAt?: string
  }
}) {
  return (
    <CardDescription className="text-xs">
      作成 {set.createdBy} / {formatDate(set.createdAt)}
      {set.approvedBy ? ` ・承認 ${set.approvedBy}` : ""}
      {set.activatedAt ? ` ・有効化 ${formatDate(set.activatedAt)}` : ""}
      {set.scheduledActivateAt
        ? ` ・有効化予約 ${formatDateTime(set.scheduledActivateAt)}`
        : ""}
    </CardDescription>
  )
}

function BaselineCard({
  set,
  sets,
  activeSet,
}: {
  set: RecommendationBaselineSet
  sets: RecommendationBaselineSet[]
  activeSet?: RecommendationBaselineSet
}) {
  const { runBaselineAction } = useSession()
  const base = comparisonBaseFor(sets, set)
  const run =
    (action: Parameters<typeof runBaselineAction>[1]) =>
    (reason: string, scheduledAt?: string) =>
      runBaselineAction(set.version, action, reason, scheduledAt)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-mono text-sm">{set.version}</span>
          <StatusBadge status={set.status} />
        </CardTitle>
        <SetMeta set={set} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {set.values.map((v) => (
            <div key={v.poseCode} className="tabular-nums">
              <span className="text-muted-foreground">
                {POSE_LABEL[v.poseCode as RecommendationPose] ?? v.poseCode}
              </span>{" "}
              {v.baseline.toFixed(1)}
            </div>
          ))}
        </div>

        {/* 🔴 差分は必ず「何と比べた差分か」を添える */}
        {base ? (
          <BaselineDiff
            rows={diffBaselineSets(base, set)}
            fromVersion={base.version}
            toVersion={set.version}
          />
        ) : null}

        {set.note ? <p className="text-xs text-muted-foreground">{set.note}</p> : null}

        {/* 🔴 今の状態でできる操作だけを出す。可否は decideSetAction() が決める */}
        <div className="flex flex-wrap gap-2">
          <BaselineImpactDialog target={set} activeSet={activeSet} />
          {availableActions(set.status).map((action) => (
            <SetActionButton
              key={action}
              kind="基準値"
              set={set}
              action={action}
              variant={action === "activate" ? "default" : "outline"}
              onRun={run(action)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PolicyCard({
  set,
  sets,
  activeSet,
  activeBaseline,
}: {
  set: RecommendationPolicySet
  sets: RecommendationPolicySet[]
  activeSet?: RecommendationPolicySet
  activeBaseline?: RecommendationBaselineSet
}) {
  const { runPolicyAction } = useSession()
  const base = comparisonBaseFor(sets, set)
  const run =
    (action: Parameters<typeof runPolicyAction>[1]) =>
    (reason: string, scheduledAt?: string) =>
      runPolicyAction(set.version, action, reason, scheduledAt)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-mono text-sm">{set.version}</span>
          <StatusBadge status={set.status} />
        </CardTitle>
        <SetMeta set={set} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {base ? (
          <PolicyDiff rows={diffPolicySets(base, set)} fromVersion={base.version} />
        ) : (
          <dl className="space-y-1">
            <div>
              <dt className="text-xs text-muted-foreground">同値のときの扱い</dt>
              <dd>{set.tieBreak}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">欠損の扱い</dt>
              <dd>{set.missingValueHandling}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">候補が足りないときの扱い</dt>
              <dd>{set.fallback}</dd>
            </div>
          </dl>
        )}

        {set.note ? <p className="text-xs text-muted-foreground">{set.note}</p> : null}

        <div className="flex flex-wrap gap-2">
          <PolicyImpactDialog
            target={set}
            activeSet={activeSet}
            activeBaseline={activeBaseline}
          />
          {availableActions(set.status).map((action) => (
            <SetActionButton
              key={action}
              kind="方針"
              set={set}
              action={action}
              variant={action === "activate" ? "default" : "outline"}
              onRun={run(action)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function RecommendationPage() {
  const { baselineSets, policySets } = useSession()
  const activeBaseline = baselineSets.find((s) => s.status === "active")
  const activePolicy = policySets.find((s) => s.status === "active")

  return (
    <div className="space-y-4">
      <PageHeader
        title="推奨設定"
        description="基準値セットと方針セットは別の版として管理します。値を変えるときは下書きを作り、承認してから有効化します。"
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            基準値セット (recommendation_baseline_version)
          </h2>
          <BaselineDraftDialog sets={baselineSets} />
        </div>
        {sortSets(baselineSets).map((set) => (
          <BaselineCard
            key={set.version}
            set={set}
            sets={baselineSets}
            activeSet={activeBaseline}
          />
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            方針セット (recommendation_policy_version)
          </h2>
          <PolicyDraftDialog sets={policySets} />
        </div>
        {sortSets(policySets).map((set) => (
          <PolicyCard
            key={set.version}
            set={set}
            sets={policySets}
            activeSet={activePolicy}
            activeBaseline={activeBaseline}
          />
        ))}
      </section>

      <SpecNote>
        同年代平均の版(average_version)、AI の閾値の版(threshold_version)、推奨基準の版は
        それぞれ別のものです。同じ値として扱わないでください。初期の推奨基準値と方針の版は
        仕様書 §16 の P0 未決事項(実測 + 事業承認待ち)のため、下書きの作成・差分・
        影響の試算まではできますが、実測と事業承認が揃うまで有効化しないでください。
        画面上の変更はサーバー未接続のため保存されません。
      </SpecNote>
    </div>
  )
}
