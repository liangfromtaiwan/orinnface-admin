/**
 * 推奨基準値・方針の版管理 (仕様書 v1.0 §8)
 *
 * 🔴 正式推奨は Backend だけが生成する。ここにあるのは「この draft を有効化したら
 *    推奨がどう変わるか」を**試算して見せる**ための計算で、保存しない・書き戻さない。
 * 🔴 baseline_version(5動作の基準値 set)と policy_version(順位・tie-break・欠損・
 *    fallback 方針)は分離する。同じ操作で両方を動かさない。
 * 🔴 active 値の直接更新は禁止。状態は draft → approved → active → retired の
 *    一方向で、値を編集できるのは draft を**新しく作る**ときだけ。
 * 🔴 rollback は retired を active に戻すのではなく、その値を持つ**新しい draft**を
 *    作る。過去の recommendation_run は再計算も上書きもしない。
 */

import { inPeriod, jstMonth, type Aggregate, type Period } from "./kpi"
import { can, type Scope } from "./scope"
import type {
  AnalysisSession,
  MetricValue,
  PoseCode,
  RecommendationBaselineSet,
  RecommendationPolicySet,
  RecommendationRun,
  VersionedSetStatus,
} from "./types"

/** 推奨の対象になる 5 動作。この並び順が active 方針の tie-break でもある。 */
export const RECOMMENDATION_POSES = [
  "smile",
  "pucker",
  "jaw_open",
  "eye_open",
  "brow_furrow",
] as const

export type RecommendationPose = (typeof RECOMMENDATION_POSES)[number]

/** 推奨する動作の件数 (AI推奨 v1.2)。 */
export const RECOMMENDATION_ITEM_COUNT = 2

export const POSE_LABEL: Record<RecommendationPose, string> = {
  smile: "スマイル",
  pucker: "口すぼめ",
  jaw_open: "開口",
  eye_open: "開眼",
  brow_furrow: "眉寄せ",
}

/* ------------------------------------------------------------------ *
 * 1. 推奨の試算
 *
 * 🔴 seed の recommendationRuns もこの関数で作る。管理画面が独自の計算を
 *    持つと「影響 preview では変わると出たのに実際は変わらない」が起きる。
 * ------------------------------------------------------------------ */

export type BaselineValues = Record<RecommendationPose, number>

export function baselineValuesOf(set: RecommendationBaselineSet): BaselineValues {
  const out = {} as BaselineValues
  for (const pose of RECOMMENDATION_POSES) {
    out[pose] = set.values.find((v) => v.poseCode === pose)?.baseline ?? 0
  }
  return out
}

export type PoseDeviation = {
  poseCode: RecommendationPose
  /** 可動域の実測値。欠測なら undefined。 */
  value?: number
  baseline: number
  /** 基準値からの乖離度。大きいほど推奨されやすい。欠測なら undefined。 */
  deviation?: number
}

/**
 * 5 動作の乖離度。定義順のまま返す(並べ替えない)。
 * 🔴 推奨に左右差は使わない (AI推奨 v1.2)。見るのは `${pose}_range` だけ。
 */
export function poseDeviations(
  metrics: MetricValue[],
  baselines: BaselineValues
): PoseDeviation[] {
  return RECOMMENDATION_POSES.map((pose) => {
    const value = metrics.find((m) => m.metricCode === `${pose}_range`)?.value
    const baseline = baselines[pose]
    return {
      poseCode: pose,
      value,
      baseline,
      deviation:
        value === undefined ? undefined : Number((baseline - value).toFixed(2)),
    }
  })
}

/**
 * 乖離度が大きい下位 2 動作を選ぶ。
 * 欠測の動作は候補から外す(active 方針「欠測の動作は推奨候補から除外し、母数に
 * 含めない」)。同値のときは定義順が先の動作を採る(active 方針の tie-break)。
 */
export function rankRecommendedPoses(
  metrics: MetricValue[],
  baselines: BaselineValues
): PoseDeviation[] {
  return poseDeviations(metrics, baselines)
    .filter((d): d is PoseDeviation & { deviation: number } => d.deviation !== undefined)
    // 定義順で安定ソートするため、同値のときは順序を入れ替えない
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, RECOMMENDATION_ITEM_COUNT)
}

/* ------------------------------------------------------------------ *
 * 2. 差分
 * ------------------------------------------------------------------ */

export type BaselineDiffRow = {
  poseCode: RecommendationPose
  from?: number
  to?: number
  /** to - from。片方が無いときは undefined。 */
  delta?: number
}

export function diffBaselineSets(
  from: RecommendationBaselineSet,
  to: RecommendationBaselineSet
): BaselineDiffRow[] {
  const a = baselineValuesOf(from)
  const b = baselineValuesOf(to)
  return RECOMMENDATION_POSES.map((pose) => ({
    poseCode: pose,
    from: a[pose],
    to: b[pose],
    delta: Number((b[pose] - a[pose]).toFixed(2)),
  }))
}

export type PolicyField = "tieBreak" | "missingValueHandling" | "fallback"

/*
  🔴 画面は日本語で統一する。DB・API 側の項目名(tie_break / fallback)は変えない。
     ここは表示名だけの対応表。
*/
export const POLICY_FIELD_LABEL: Record<PolicyField, string> = {
  tieBreak: "同値のときの扱い",
  missingValueHandling: "欠損の扱い",
  fallback: "候補が足りないときの扱い",
}

export type PolicyDiffRow = {
  field: PolicyField
  from: string
  to: string
  changed: boolean
}

export function diffPolicySets(
  from: RecommendationPolicySet,
  to: RecommendationPolicySet
): PolicyDiffRow[] {
  return (Object.keys(POLICY_FIELD_LABEL) as PolicyField[]).map((field) => ({
    field,
    from: from[field],
    to: to[field],
    changed: from[field] !== to[field],
  }))
}

/* ------------------------------------------------------------------ *
 * 3. 影響 preview
 *
 * 🔴 ここで作るのは試算であって recommendation_run ではない。画面にも
 *    「試算」と書き、保存もしない。
 * 🔴 母数・欠測・使用 version を必ず返す (§6)。率だけを返さない。
 * ------------------------------------------------------------------ */

export type BaselineImpactSample = {
  sessionId: string
  dataSubjectId: string
  runAt: string
  /** 実際に出ている推奨 (active baseline)。 */
  before: RecommendationPose[]
  /** draft を有効化した場合の推奨。 */
  after: RecommendationPose[]
  /** 動作そのものが入れ替わるか。false なら順位だけの変化。 */
  poseChanged: boolean
}

export type BaselineImpact = {
  /** 推奨動作が変わる run の割合。母数は比較できた run 数。 */
  aggregate: Aggregate
  /** 動作が入れ替わる run 数。 */
  changed: number
  /** 動作は同じで順位だけ入れ替わる run 数。 */
  reordered: number
  /** 比較できた run 数 (= aggregate.denominator)。 */
  comparable: number
  /** 影響を受ける一意の顧客数。 */
  changedSubjects: number
  /** 変わる run の一覧 (画面では先頭数件だけ出す)。 */
  samples: BaselineImpactSample[]
}

/**
 * draft の基準値で推奨を引き直し、現行 active の run と突き合わせる。
 *
 * 母数に入れるのは「active な基準値 version で走った run」だけ。別 version で
 * 走った過去 run を今の active と比べても差分の意味が変わるため、欠測として
 * 外し、件数は missing に出す。
 */
export function previewBaselineImpact(
  runs: RecommendationRun[],
  sessions: AnalysisSession[],
  activeSet: RecommendationBaselineSet,
  draftSet: RecommendationBaselineSet,
  period: Period
): BaselineImpact {
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const draftValues = baselineValuesOf(draftSet)

  const inRange = runs.filter((r) => inPeriod(r.runAt, period))
  const comparableRuns = inRange.filter(
    (r) => r.baselineVersion === activeSet.version && sessionById.has(r.analysisSessionId)
  )

  const samples: BaselineImpactSample[] = []
  let changed = 0
  let reordered = 0
  const changedSubjectIds = new Set<string>()

  for (const run of comparableRuns) {
    const session = sessionById.get(run.analysisSessionId)!
    const before = [...run.items]
      .sort((a, b) => a.rank - b.rank)
      .map((i) => i.poseCode as RecommendationPose)
    const after = rankRecommendedPoses(session.metrics, draftValues).map(
      (d) => d.poseCode
    )

    const sameOrder = before.length === after.length && before.every((p, i) => p === after[i])
    if (sameOrder) continue

    const poseChanged =
      before.length !== after.length ||
      before.some((p) => !after.includes(p)) ||
      after.some((p) => !before.includes(p))

    if (poseChanged) {
      changed++
      changedSubjectIds.add(session.dataSubjectId)
    } else {
      reordered++
    }

    samples.push({
      sessionId: session.id,
      dataSubjectId: session.dataSubjectId,
      runAt: run.runAt,
      before,
      after,
      poseChanged,
    })
  }

  const denominator = comparableRuns.length
  samples.sort((a, b) => b.runAt.localeCompare(a.runAt))

  return {
    aggregate: {
      value: denominator === 0 ? 0 : (changed / denominator) * 100,
      numerator: changed,
      denominator,
      missing: inRange.length - denominator,
      period,
      conditionLabel:
        "期間内に現行の基準値 version で走った推奨のうち、下書きを有効化すると" +
        "推奨動作そのものが入れ替わるものの割合。順位だけの入れ替わりは分子に" +
        "含めない。別 version で走った推奨は突き合わせの基準が違うため欠測に数える。",
      version: `${activeSet.version} → ${draftSet.version}`,
    },
    changed,
    reordered,
    comparable: denominator,
    changedSubjects: changedSubjectIds.size,
    samples,
  }
}

export type PolicyImpact = {
  /** 期間内の対象 run 数。 */
  total: number
  /** tie-break が効く(乖離度が同値で 2 位争いが起きる) run 数。 */
  tieAffected: number
  /** 欠測の動作がある run 数。 */
  missingAffected: number
  /** 候補が 2 件に満たず fallback が効く run 数。 */
  fallbackAffected: number
}

/**
 * 方針 set の影響。
 *
 * 🔴 tie-break・欠損・fallback は仕様上**文章**で、数式ではない。文章から
 *    結果を計算することはできないので、ここで出すのは「その規則が実際に
 *    効く run が何件あるか」= 影響の母数。率にしない。
 */
export function previewPolicyImpact(
  runs: RecommendationRun[],
  sessions: AnalysisSession[],
  activeSet: RecommendationBaselineSet,
  period: Period
): PolicyImpact {
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const values = baselineValuesOf(activeSet)
  const target = runs.filter(
    (r) => inPeriod(r.runAt, period) && sessionById.has(r.analysisSessionId)
  )

  let tieAffected = 0
  let missingAffected = 0
  let fallbackAffected = 0

  for (const run of target) {
    const deviations = poseDeviations(sessionById.get(run.analysisSessionId)!.metrics, values)
    const present = deviations.filter(
      (d): d is PoseDeviation & { deviation: number } => d.deviation !== undefined
    )
    if (present.length < deviations.length) missingAffected++
    if (present.length < RECOMMENDATION_ITEM_COUNT) fallbackAffected++

    // 2 位と 3 位が同値なら、どちらを採るかは tie-break が決める
    const sorted = [...present].sort((a, b) => b.deviation - a.deviation)
    const boundary = sorted[RECOMMENDATION_ITEM_COUNT - 1]
    const next = sorted[RECOMMENDATION_ITEM_COUNT]
    if (boundary && next && boundary.deviation === next.deviation) tieAffected++
  }

  return {
    total: target.length,
    tieAffected,
    missingAffected,
    fallbackAffected,
  }
}

/* ------------------------------------------------------------------ *
 * 4. 版の操作
 * ------------------------------------------------------------------ */

export type SetAction = "approve" | "activate" | "schedule" | "rollback"

export const SET_ACTION_LABEL: Record<SetAction, string> = {
  approve: "承認",
  activate: "有効化",
  schedule: "有効化を予約",
  /*
    仕様書は "rollback" と書いているが、画面は日本語で統一する。
    🔴 「元に戻す」だと退役した版がそのまま復活すると読めてしまう。実際に起きるのは
       **その値を持つ新しい draft を作る**ことなので、確認ダイアログでそう説明する。
  */
  rollback: "復元",
}

export type SetActionDenial =
  /** operator 以外。閲覧はできるが操作はできない (§8 の操作表)。 */
  | "not_operator"
  /** 状態が違う。draft を有効化する、active を承認し直す、など。 */
  | "wrong_status"

export const SET_ACTION_DENIAL_LABEL: Record<SetActionDenial, string> = {
  not_operator: "この操作は本部のみが行えます。",
  wrong_status: "今の状態ではこの操作はできません。",
}

export type SetActionWarning =
  /** 作成者と承認者が同じ。§8「作成者と承認者の分離を推奨」。禁止ではない。 */
  | "self_approval"
  /** §16 P0: 初期の基準値・policy は実測 + 事業承認まで確定していない。 */
  | "p0_undecided"
  /** すでに有効化を予約済み。上書きになる。 */
  | "reschedule"

export const SET_ACTION_WARNING_LABEL: Record<SetActionWarning, string> = {
  self_approval:
    "作成者と承認者が同じです。§8 は作成者と承認者を分けることを推奨しています。",
  p0_undecided:
    "初期の推奨基準値・policy version は §16 P0 の未決事項です(実測 + 事業承認待ち)。承認が取れるまで有効化しないでください。",
  reschedule: "すでに有効化を予約済みです。実行すると予約日時を上書きします。",
}

export type SetActionDecision =
  | { kind: "allowed"; warnings: SetActionWarning[] }
  | { kind: "denied"; reason: SetActionDenial }

/** 版に共通する項目。基準値 set と方針 set はここだけを共有する。 */
type VersionedSet = {
  version: string
  status: VersionedSetStatus
  createdBy: string
  approvedBy?: string
  createdAt: string
  activatedAt?: string
  scheduledActivateAt?: string
  note?: string
}

const REQUIRED_STATUS: Record<SetAction, VersionedSetStatus> = {
  approve: "draft",
  activate: "approved",
  schedule: "approved",
  rollback: "retired",
}

/**
 * その状態で出す操作。
 * 状態と無関係な操作まで並べると、押せないボタンが 4 つ並んで「今なにができるか」が
 * 読めなくなる。権限で押せない場合は decideSetAction() が理由を返す。
 */
export function availableActions(status: VersionedSetStatus): SetAction[] {
  return (Object.keys(REQUIRED_STATUS) as SetAction[]).filter(
    (action) => REQUIRED_STATUS[action] === status
  )
}

/**
 * 可否判定に要るのはここまで。版の全項目を要求すると、一覧だけ持っている
 * 画面から判定できなくなる。
 */
export type SetActionTarget = Pick<
  VersionedSet,
  "version" | "status" | "createdBy" | "scheduledActivateAt"
>

/** draft を作れるか (§8: draft 作成は operator のみ)。 */
export function decideDraftCreate(scope: Scope): SetActionDecision {
  if (!can(scope, "recommendation.draft")) {
    return { kind: "denied", reason: "not_operator" }
  }
  return { kind: "allowed", warnings: [] }
}

/**
 * 承認・有効化・予約・rollback の可否。
 * 🔴 画面側で role を直接見て分岐しない。判定はここ 1 箇所。
 */
export function decideSetAction(
  scope: Scope,
  set: SetActionTarget,
  action: SetAction,
  actorName: string
): SetActionDecision {
  if (!can(scope, "recommendation.approve")) {
    return { kind: "denied", reason: "not_operator" }
  }
  if (set.status !== REQUIRED_STATUS[action]) {
    return { kind: "denied", reason: "wrong_status" }
  }

  const warnings: SetActionWarning[] = []
  if (action === "approve" && set.createdBy === actorName) warnings.push("self_approval")
  if (action === "activate" || action === "schedule") warnings.push("p0_undecided")
  if (action === "schedule" && set.scheduledActivateAt) warnings.push("reschedule")
  return { kind: "allowed", warnings }
}

/** 次の version 番号。`rb-2026.09.2` の形式で、同じ月の中で連番にする。 */
export function nextVersion(
  prefix: "rb" | "rp",
  sets: { version: string }[],
  now: string
): string {
  const month = jstMonth(now).replace("-", ".")
  const head = `${prefix}-${month}.`
  const used = sets
    .filter((s) => s.version.startsWith(head))
    .map((s) => Number(s.version.slice(head.length)))
    .filter((n) => Number.isFinite(n))
  return `${head}${Math.max(0, ...used) + 1}`
}

type ApplyContext = {
  actorName: string
  now: string
  /** schedule のときだけ使う ISO 日時。 */
  scheduledAt?: string
}

/**
 * 状態遷移。
 * 🔴 有効化すると、それまで active だった版は retired に落ちる(active は常に 1 件)。
 * 🔴 rollback は retired を active に戻さず、同じ値の新しい draft を作る。
 *    元の retired 版はそのまま残す(過去 run の根拠なので消さない)。
 */
function applySetAction<T extends VersionedSet>(
  sets: T[],
  version: string,
  action: SetAction,
  prefix: "rb" | "rp",
  ctx: ApplyContext
): T[] {
  const target = sets.find((s) => s.version === version)
  if (!target || target.status !== REQUIRED_STATUS[action]) return sets

  switch (action) {
    case "approve":
      return sets.map((s) =>
        s.version === version
          ? { ...s, status: "approved" as const, approvedBy: ctx.actorName }
          : s
      )
    case "schedule":
      return sets.map((s) =>
        s.version === version ? { ...s, scheduledActivateAt: ctx.scheduledAt } : s
      )
    case "activate":
      return sets.map((s) => {
        if (s.version === version) {
          return {
            ...s,
            status: "active" as const,
            activatedAt: ctx.now,
            scheduledActivateAt: undefined,
          }
        }
        // active は 1 件だけ。今まで有効だった版は退役させる
        return s.status === "active" ? { ...s, status: "retired" as const } : s
      })
    case "rollback":
      return [
        {
          ...target,
          version: nextVersion(prefix, sets, ctx.now),
          status: "draft" as const,
          createdBy: ctx.actorName,
          createdAt: ctx.now,
          approvedBy: undefined,
          activatedAt: undefined,
          scheduledActivateAt: undefined,
          note: `${target.version} の値へ戻す rollback。過去の推奨は再計算しない。`,
        },
        ...sets,
      ]
  }
}

export function applyBaselineAction(
  sets: RecommendationBaselineSet[],
  version: string,
  action: SetAction,
  ctx: ApplyContext
): RecommendationBaselineSet[] {
  return applySetAction(sets, version, action, "rb", ctx)
}

export function applyPolicyAction(
  sets: RecommendationPolicySet[],
  version: string,
  action: SetAction,
  ctx: ApplyContext
): RecommendationPolicySet[] {
  return applySetAction(sets, version, action, "rp", ctx)
}

/**
 * 基準値の draft を作る。
 * 🔴 作れるのは draft だけ。active を直接編集する経路は作らない (§8)。
 */
export function createBaselineDraft(
  sets: RecommendationBaselineSet[],
  input: {
    values: { poseCode: Exclude<PoseCode, "neutral">; baseline: number }[]
    note?: string
    actorName: string
    now: string
  }
): RecommendationBaselineSet[] {
  return [
    {
      version: nextVersion("rb", sets, input.now),
      status: "draft",
      values: input.values,
      createdBy: input.actorName,
      createdAt: input.now,
      note: input.note,
    },
    ...sets,
  ]
}

export function createPolicyDraft(
  sets: RecommendationPolicySet[],
  input: {
    tieBreak: string
    missingValueHandling: string
    fallback: string
    note?: string
    actorName: string
    now: string
  }
): RecommendationPolicySet[] {
  return [
    {
      version: nextVersion("rp", sets, input.now),
      status: "draft",
      tieBreak: input.tieBreak,
      missingValueHandling: input.missingValueHandling,
      fallback: input.fallback,
      createdBy: input.actorName,
      createdAt: input.now,
      note: input.note,
    },
    ...sets,
  ]
}

/** 比較の基準にする版。active があればそれ、無ければ直近の retired。 */
export function comparisonBaseFor<T extends VersionedSet>(
  sets: T[],
  target: T
): T | undefined {
  if (target.status === "active") {
    // active 同士は比べられないので、直前の版(= 最後に退役した版)と比べる
    return [...sets]
      .filter((s) => s.status === "retired")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  }
  return sets.find((s) => s.status === "active" && s.version !== target.version)
}

/** 版の表示順。active → approved → draft → retired、同状態では新しい順。 */
const STATUS_ORDER: Record<VersionedSetStatus, number> = {
  active: 0,
  approved: 1,
  draft: 2,
  retired: 3,
}

export function sortSets<T extends VersionedSet>(sets: T[]): T[] {
  return [...sets].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      b.createdAt.localeCompare(a.createdAt)
  )
}
