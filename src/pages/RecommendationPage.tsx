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
import { MetricCatalogTable } from "@/components/MetricCatalogTable"
import { MUSCLE_TAG_DESCRIPTION } from "@/lib/domain/muscles"
import { MuscleTagEditor } from "@/components/MuscleTagEditor"
import { METRIC_GROUP_LABEL } from "@/lib/domain/metrics"
import {
  ACTIVE_THRESHOLD_SET,
  JUDGE_LABEL,
  POSTURE_THRESHOLD_STATUS,
  THRESHOLD_KIND_LABEL,
} from "@/lib/domain/thresholds"
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
  ANALYSIS_TYPE_LABEL,
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
  set: {
    status: VersionedSetStatus
    scheduledActivateAt?: string
    provisional?: boolean
  }
}) {
  const scheduled =
    set.status === "approved" && set.scheduledActivateAt
      ? set.scheduledActivateAt
      : undefined

  return (
    <>
      <Badge variant={set.status === "active" ? "default" : "outline"}>
        {scheduled
          ? `${formatDateTime(scheduled)} 有効化予定`
          : VERSIONED_SET_STATUS_LABEL[set.status]}
      </Badge>
      {/*
        🔴 有効でも正式値とは限らない (§16 P0「実測 + 事業承認」待ち)。
           「未承認」と書いてあるのに有効な版が並んでいる、という食い違いを
           残さないため、その版自体に暫定と出す(吉田さん指摘 2026-09-24)。
      */}
      {set.provisional ? (
        <Badge
          variant="outline"
          className="border-amber-300 text-amber-700"
          title="正式な初期値ではありません。実測と事業承認のあと差し替えます (§16 P0)"
        >
          暫定値
        </Badge>
      ) : null}
    </>
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
            <TabsTrigger value="threshold">判定閾値</TabsTrigger>
            <TabsTrigger value="metrics">指標一覧</TabsTrigger>
            <TabsTrigger value="muscles">筋肉タグ</TabsTrigger>
          </TabsList>
          {/*
            作成ボタンは見ているタブのものだけ出す(取り違えて作らないように)。
            🔴 TabsContent は既定で flex-1。そのままだとタブの直後から右端まで
               引き伸ばされ、ボタンがタブにくっついて見える。中身を右端へ寄せる。
          */}
          <TabsContent value="baseline" className="m-0 flex justify-end">
            <BaselineDraftDialog sets={baselineSets} />
          </TabsContent>
          <TabsContent value="policy" className="m-0 flex justify-end">
            <PolicyDraftDialog sets={policySets} />
          </TabsContent>
        </div>

        <TabsContent value="baseline" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            5 動作の標準値 (recommendation_baseline_version)。実測との差が大きい
            2 動作を推奨します。
            <span className="font-medium text-foreground">
              {" "}
              推奨に使うのは可動域だけです。
            </span>
            左右差・代償は結果画面に出しますが、推奨の順位には使いません
            (AI推奨 v1.2)。正常 / 要注意 / 要ケア の判定もこの値ではなく
            判定閾値タブの線で決まります。
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

        {/* 判定閾値には作成ボタンが無い(ここでは変えられない) */}
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

        <TabsContent value="threshold" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            ユーザーの結果画面で 正常 / 要注意 / 要ケア のどれを出すかを決める線
            (threshold_version)。
            <span className="font-medium text-foreground">
              {" "}
              推奨する 2 動作を決める基準値セットとは別物です。
            </span>
          </p>

          <Card className="border-2 border-amber-300">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span className="font-mono text-sm">
                  {ACTIVE_THRESHOLD_SET.version}
                </span>
                {/* 🔴 どの分析種別の閾値かを見出しに出す。顔と姿勢は別物 */}
                <Badge variant="secondary">
                  {ANALYSIS_TYPE_LABEL[ACTIVE_THRESHOLD_SET.analysisType]}
                </Badge>
                <Badge variant="outline">表示のみ</Badge>
                {ACTIVE_THRESHOLD_SET.provisional ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-700"
                  >
                    暫定
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription className="text-xs">
                対象モデル {ACTIVE_THRESHOLD_SET.modelVersion} ／ この表は
                {ANALYSIS_TYPE_LABEL[ACTIVE_THRESHOLD_SET.analysisType]}
                の指標だけです
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="py-1 pr-3 text-left font-normal">指標</th>
                      <th className="py-1 pr-3 text-left font-normal">見方</th>
                      <th className="py-1 pr-3 text-right font-normal">
                        {JUDGE_LABEL.normal.label}
                      </th>
                      <th className="py-1 pr-3 text-right font-normal">
                        {JUDGE_LABEL.caution.label}
                      </th>
                      <th className="py-1 text-right font-normal">
                        {JUDGE_LABEL.danger.label}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACTIVE_THRESHOLD_SET.rules.map((rule) => (
                      <tr key={rule.group} className="border-t align-top">
                        <td className="py-1.5 pr-3">
                          {METRIC_GROUP_LABEL[rule.group]}
                          {rule.note ? (
                            <span className="block text-xs text-muted-foreground">
                              {rule.note}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                          {THRESHOLD_KIND_LABEL[rule.kind]}
                        </td>
                        {rule.kind === "binary" ? (
                          <>
                            <td className={`py-1.5 pr-3 text-right ${JUDGE_LABEL.normal.className}`}>
                              なし
                            </td>
                            <td className="py-1.5 pr-3 text-right text-muted-foreground">
                              —
                            </td>
                            <td className={`py-1.5 text-right ${JUDGE_LABEL.danger.className}`}>
                              あり
                            </td>
                          </>
                        ) : rule.kind === "higher_better" ? (
                          <>
                            <td className={`py-1.5 pr-3 text-right tabular-nums ${JUDGE_LABEL.normal.className}`}>
                              {rule.caution}
                              {rule.unit} 以上
                            </td>
                            <td className={`py-1.5 pr-3 text-right tabular-nums ${JUDGE_LABEL.caution.className}`}>
                              {rule.danger}〜{rule.caution}
                              {rule.unit}
                            </td>
                            <td className={`py-1.5 text-right tabular-nums ${JUDGE_LABEL.danger.className}`}>
                              {rule.danger}
                              {rule.unit} 未満
                            </td>
                          </>
                        ) : (
                          <>
                            <td className={`py-1.5 pr-3 text-right tabular-nums ${JUDGE_LABEL.normal.className}`}>
                              ±{rule.caution}
                              {rule.unit} 以内
                            </td>
                            <td className={`py-1.5 pr-3 text-right tabular-nums ${JUDGE_LABEL.caution.className}`}>
                              ±{rule.caution}〜{rule.danger}
                              {rule.unit}
                            </td>
                            <td className={`py-1.5 text-right tabular-nums ${JUDGE_LABEL.danger.className}`}>
                              ±{rule.danger}
                              {rule.unit} 超
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-amber-800">
                🔴 ここに出している数値は<strong>暫定</strong>です。ユーザー向け結果画面の
                表示から逆算した推定で、AI分析 v1.6 の正本ではありません。閾値の正本は
                AI分析 v1.6 側にあり、この画面からは変更できません。運用で調整したい場合は
                AI 側の版を上げる必要があります。
              </p>
            </CardContent>
          </Card>

          {/*
            🔴 姿勢の閾値は受け取っていない。顔の表だけ出して黙っていると
               「姿勢もこの線で判定している」と読まれる (吉田さん指摘 2026-09-25)。
          */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span className="font-mono text-sm">
                  {POSTURE_THRESHOLD_STATUS.version}
                </span>
                <Badge variant="secondary">
                  {ANALYSIS_TYPE_LABEL[POSTURE_THRESHOLD_STATUS.analysisType]}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-amber-300 text-amber-700"
                >
                  未入手
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                対象モデル {POSTURE_THRESHOLD_STATUS.modelVersion}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              姿勢の判定閾値はまだ受け取っていません。単位(mm / deg)も指標も顔とは
              別なので、顔の閾値で代用していません。分析結果には
              threshold_version として {POSTURE_THRESHOLD_STATUS.version} が
              記録されています。正本は AI分析 v1.6 です。
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            システムが認識している指標の一覧。ユーザー向け結果画面と同じ順に並べて
            あります。
            <span className="font-medium text-foreground">
              {" "}
              追加・削除はこの画面からはできません。
            </span>
          </p>

          <Card className="border-2 border-amber-300">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                指標カタログ
                <Badge variant="outline">表示のみ</Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                正本は AI分析 v1.6。metric_code は AI が返すものがそのまま入ります。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetricCatalogTable />
              <p className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-amber-800">
                ここで指標を増やしても、AI が計算しないものは「欠測」の行が増えるだけ
                です。§5 は管理画面とユーザー画面で同じ metric_code・同じ値を使うことを
                求めているため、指標の増減は AI 側の版で行います。「暫定」は
                metric_direction が指標責任者の承認前であることを示します(§16 P1)。
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="muscles" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {MUSCLE_TAG_DESCRIPTION}。結果画面で各動作のカードの下に出ます。
            <span className="font-medium text-foreground">
              {" "}
              表示用のみで、AI 分析・判定・推奨の順位には影響しません
            </span>
            （吉田さん確定 2026-09-24）。
          </p>

          <Card>
            <CardContent className="pt-6">
              <MuscleTagEditor />
            </CardContent>
          </Card>

          <SpecNote>
            仕様書 v1.0 にも AI推奨 v1.2 にも、このタグについての記述は見つかって
            いません。初期値はユーザー向け結果画面(2026-09-21)に出ていた並びです。
            正本の所在は確認中です。
          </SpecNote>
        </TabsContent>

      </Tabs>

      <SpecNote>
        同年代平均の版(average_version)、AI の閾値の版(threshold_version)、推奨基準の版は
        それぞれ別のものです。同じ値として扱わないでください。
        {/* 🔴 「未承認」と書きながら有効な版を出す、という食い違いを残さない */}
        いま有効になっている初期の基準値・方針は「暫定値」バッジを付けた版で、
        仕様書 §16 の P0(実測 + 事業承認)が済んでいません。画面の動きを確認するために
        有効にしてあるだけなので、確定した値が出たら新しい版に差し替えてください。
        画面上の変更はサーバー未接続のため保存されません。
      </SpecNote>
    </div>
  )
}
