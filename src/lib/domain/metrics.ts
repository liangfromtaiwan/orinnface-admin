/**
 * 指標カタログ
 *
 * 🔴 metric_code / 閾値 / 平均値の正本は「AI分析 v1.6」。
 *    ここは管理画面が表示するためのラベルと評価方向のみを保持する。
 *    管理画面専用に同名の別スコアを作らない (仕様書 v1.0 §5 同一指標原則)。
 *
 * 🔴 metric_direction の初期一覧は §16 P1 の未決事項 (指標責任者承認待ち)。
 *    未承認のものは provisional: true とし、改善率画面で「暫定」と明示する。
 */

import type { AnalysisType, PoseCode } from "./types"

/**
 * 改善の評価方向。
 * - higher : 値が大きいほど良い (可動域など)
 * - toZero : 絶対値が 0 に近いほど良い (左右差・偏位など)
 * - lower  : 値が小さいほど良い (代償・過緊張など)
 */
export type MetricDirection = "higher" | "toZero" | "lower"

export const METRIC_DIRECTION_LABEL: Record<MetricDirection, string> = {
  higher: "高いほど良い",
  toZero: "0 に近いほど良い",
  lower: "低いほど良い",
}

export type MetricGroup =
  | "neutral" // 無表情 6 指標
  | "range" // 5動作の可動域
  | "asymmetry" // 左右差・偏位
  | "compensation" // 代償・過緊張
  | "posture_front" // 姿勢 正面 4
  | "posture_side" // 姿勢 側面 4

export const METRIC_GROUP_LABEL: Record<MetricGroup, string> = {
  neutral: "無表情(neutral)",
  range: "可動域",
  asymmetry: "左右差・偏位",
  compensation: "代償・過緊張",
  posture_front: "姿勢(正面)",
  posture_side: "姿勢(側面)",
}

export type MetricDef = {
  code: string
  label: string
  group: MetricGroup
  analysisType: AnalysisType
  /** 5動作に紐づく指標のみ。neutral / 姿勢は undefined。 */
  poseCode?: Exclude<PoseCode, "neutral">
  unit: string
  direction: MetricDirection
  /** §16 P1 未決: metric_direction が指標責任者承認前のもの。 */
  provisional: boolean
}

/**
 * 無表情 6 指標 (§5)。
 * 🔴 neutral の値を 5動作の可動域と混ぜて表示しない。
 */
const NEUTRAL_METRICS: MetricDef[] = [
  { code: "neutral_brow_height", label: "眉の高さ", unit: "mm" },
  { code: "neutral_eye_open", label: "開瞼幅", unit: "mm" },
  { code: "neutral_mouth_corner", label: "口角位置", unit: "mm" },
  { code: "neutral_cheek_volume", label: "頬のボリューム", unit: "mm" },
  { code: "neutral_jaw_line", label: "フェイスライン", unit: "mm" },
  { code: "neutral_face_symmetry", label: "左右対称性", unit: "mm" },
].map((m) => ({
  ...m,
  group: "neutral" as const,
  analysisType: "face" as const,
  // 無表情は「基準の姿」であり単純な高低で良し悪しを決めない項目が多い。
  direction: "toZero" as const,
  provisional: true,
}))

const POSES: { pose: Exclude<PoseCode, "neutral">; label: string }[] = [
  { pose: "smile", label: "いー(smile)" },
  { pose: "pucker", label: "うー(pucker)" },
  { pose: "jaw_open", label: "あー(jaw_open)" },
  { pose: "eye_open", label: "目(eye_open)" },
  { pose: "brow_furrow", label: "眉間(brow_furrow)" },
]

/** 5動作 × (可動域 / 左右差 / 代償・過緊張) */
const POSE_METRICS: MetricDef[] = POSES.flatMap(({ pose, label }) => [
  {
    code: `${pose}_range`,
    label: `${label} 可動域`,
    group: "range" as const,
    analysisType: "face" as const,
    poseCode: pose,
    unit: "mm",
    direction: "higher" as const,
    provisional: true,
  },
  {
    code: `${pose}_asymmetry`,
    label: `${label} 左右差`,
    group: "asymmetry" as const,
    analysisType: "face" as const,
    poseCode: pose,
    unit: "mm",
    direction: "toZero" as const,
    provisional: true,
  },
  {
    code: `${pose}_compensation`,
    label: `${label} 代償・過緊張`,
    group: "compensation" as const,
    analysisType: "face" as const,
    poseCode: pose,
    unit: "index",
    direction: "lower" as const,
    provisional: true,
  },
])

/**
 * 姿勢は B2B のみ。正面 4 / 側面 4 (§5)。
 * 左右の側面結果は別表示。V1 のユーザー画面は左側面。
 */
const POSTURE_METRICS: MetricDef[] = [
  { code: "posture_front_shoulder_tilt", label: "肩の高さ差", group: "posture_front" as const, unit: "mm" },
  { code: "posture_front_pelvis_tilt", label: "骨盤の傾き", group: "posture_front" as const, unit: "mm" },
  { code: "posture_front_head_shift", label: "頭部の左右偏位", group: "posture_front" as const, unit: "mm" },
  { code: "posture_front_trunk_shift", label: "体幹の左右偏位", group: "posture_front" as const, unit: "mm" },
  { code: "posture_side_head_forward", label: "頭部前方偏位", group: "posture_side" as const, unit: "mm" },
  { code: "posture_side_shoulder_forward", label: "肩の前方偏位", group: "posture_side" as const, unit: "mm" },
  { code: "posture_side_thoracic_angle", label: "胸椎角度", group: "posture_side" as const, unit: "deg" },
  { code: "posture_side_pelvis_angle", label: "骨盤角度", group: "posture_side" as const, unit: "deg" },
].map((m) => ({
  ...m,
  analysisType: "posture" as const,
  direction: "toZero" as const,
  provisional: true,
}))

export const METRIC_CATALOG: MetricDef[] = [
  ...NEUTRAL_METRICS,
  ...POSE_METRICS,
  ...POSTURE_METRICS,
]

const BY_CODE = new Map(METRIC_CATALOG.map((m) => [m.code, m]))

export function getMetric(code: string): MetricDef | undefined {
  return BY_CODE.get(code)
}

export function metricsByGroup(group: MetricGroup): MetricDef[] {
  return METRIC_CATALOG.filter((m) => m.group === group)
}

export function metricsByAnalysisType(type: AnalysisType): MetricDef[] {
  return METRIC_CATALOG.filter((m) => m.analysisType === type)
}

/**
 * 基準時点の値と比較して「改善したか」を metric_direction に沿って判定する。
 * 判定不能 (どちらか欠測) は null を返し、母数から除外する。
 */
export function isImproved(
  code: string,
  baselineValue: number | undefined,
  latestValue: number | undefined
): boolean | null {
  const def = BY_CODE.get(code)
  if (!def || baselineValue === undefined || latestValue === undefined) {
    return null
  }
  switch (def.direction) {
    case "higher":
      return latestValue > baselineValue
    case "lower":
      return latestValue < baselineValue
    case "toZero":
      return Math.abs(latestValue) < Math.abs(baselineValue)
  }
}
