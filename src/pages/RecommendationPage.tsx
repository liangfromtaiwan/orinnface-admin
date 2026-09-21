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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
import { cn } from "@/lib/utils"
import {
  VERSIONED_SET_STATUS_LABEL,
  type RecommendationBaselineSet,
  type RecommendationPolicySet,
  type VersionedSetStatus,
} from "@/lib/domain/types"

/**
 * 状態のバッジ。
 * 🔴 予約が入っている版は「有効化待ち」ではなく**いつ有効になるか**を出す。
 *    待っていることより、いつ切り替わるかのほうが読み手の知りたいこと。
 */
function StatusBadge({
  set,
}: {
  set: { status: VersionedSetStatus; scheduledActivateAt?: string }
}) {
  const scheduled =
    set.status === "approved" && set.scheduledActivateAt
      ? set.scheduledActivateAt
      : undefined

  return (
    <Badge variant={set.status === "active" ? "default" : "outline"}>
      {scheduled
        ? `${formatDateTime(scheduled)} 有効化予定`
        : VERSIONED_SET_STATUS_LABEL[set.status]}
    </Badge>
  )
}

/** 作成・決定・有効化の履歴。どの版も同じ並びで出す。 */
function SetMeta({
  set,
}: {
  set: {
    createdBy: string
    createdAt: string
    editedAt?: string
    approvedBy?: string
    activatedAt?: string
  }
}) {
  return (
    <CardDescription className="text-xs">
      作成 {set.createdBy} / {formatDate(set.createdAt)}
      {set.editedAt ? ` ・編集 ${formatDate(set.editedAt)}` : ""}
      {/* 🔴 「承認」とは書かない。承認という操作は画面に無い(§8 からの逸脱) */}
      {set.approvedBy ? ` ・決定 ${set.approvedBy}` : ""}
      {set.activatedAt ? ` ・有効化 ${formatDate(set.activatedAt)}` : ""}
      {/* 予約日時はバッジに出しているので、ここでは繰り返さない */}
    </CardDescription>
  )
}

/**
 * 状態ごとの見た目。版が増えるので、一覧の中で「今どれが効いているか」と
 * 「もう終わったもの」が目で分かるようにする。
 * 🔴 有効は枠線だけ濃い緑にする。背景に色を敷くと、中の表の罫線や淡いグレーの
 *    文字とのコントラストが落ちて読みにくくなる。
 * 🔴 退役は少し落とす。消さずに残す(過去の推奨の根拠)が、今読むものではない。
 */
function cardTone(status: VersionedSetStatus): string | undefined {
  if (status === "active") return "border-2 border-emerald-600"
  if (status === "retired") return "opacity-80"
  return undefined
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
    <Card className={cn(cardTone(set.status))}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-mono text-sm">{set.version}</span>
          <StatusBadge set={set} />
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
          {/* 有効化していない版は中身を直せる (§8 が禁じているのは active の更新) */}
          <BaselineDraftDialog sets={sets} target={set} />
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
    <Card className={cn(cardTone(set.status))}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-mono text-sm">{set.version}</span>
          <StatusBadge set={set} />
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
          <PolicyDraftDialog sets={sets} target={set} />
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
        description="基準値セットと方針セットは別の版として管理します。値を変えるときは下書きを作り、有効化するか、日時を決めて予約します。"
      />

      {/*
        2 つは別の版軸なので、並べて縦に積むと「今どちらを見ているか」が曖昧になる。
        版が増えるほど下の方針セットが遠くなるため、タブで切り替える。
      */}
      <Tabs defaultValue="baseline" className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="baseline">
              基準値セット ({baselineSets.length})
            </TabsTrigger>
            <TabsTrigger value="policy">
              方針セット ({policySets.length})
            </TabsTrigger>
          </TabsList>
          {/* 作成ボタンは見ているタブのものだけ出す(取り違えて作らないように) */}
          <TabsContent value="baseline" className="m-0">
            <BaselineDraftDialog sets={baselineSets} />
          </TabsContent>
          <TabsContent value="policy" className="m-0">
            <PolicyDraftDialog sets={policySets} />
          </TabsContent>
        </div>

        <TabsContent value="baseline" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            5 動作の標準値 (recommendation_baseline_version)。
            実測との差が大きい 2 動作を推奨します。
          </p>
          {sortSets(baselineSets).map((set) => (
            <BaselineCard
              key={set.version}
              set={set}
              sets={baselineSets}
              activeSet={activeBaseline}
            />
          ))}
        </TabsContent>

        <TabsContent value="policy" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            順位の付け方 (recommendation_policy_version)。
            同値・欠損・候補不足のときの扱いを決めます。
          </p>
          {sortSets(policySets).map((set) => (
            <PolicyCard
              key={set.version}
              set={set}
              sets={policySets}
              activeSet={activePolicy}
              activeBaseline={activeBaseline}
            />
          ))}
        </TabsContent>
      </Tabs>

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
