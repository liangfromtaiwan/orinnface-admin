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
  | "neutral" // 無表情(§5 は 6 指標だが結果画面は 3。QUESTIONS #23)
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
 * 無表情の指標。
 * 🔴 neutral の値を 5動作の可動域と混ぜて表示しない。
 * 🔴 ユーザー向け結果画面に出ている 3 つに合わせた(使用者確定 2026-09-22)。
 *
 * ⚠️ §5 は「neutral 無表情 **6** 指標」と書いている。画面は 3 つしか出していない
 *    ので、画面を正とした。外した 3 つは、こちらで仮に置いていた名前で、画面にも
 *    仕様書の指標名一覧にも裏付けが無かったもの:
 *      頬のボリューム / フェイスライン / 左右対称性
 *    6 指標の正しい内訳は QUESTIONS_FOR_YOSHIDA.md #23 で確認中。戻すときは
 *    この履歴(git)から拾える。
 */
const NEUTRAL_METRICS: MetricDef[] = [
  { code: "neutral_eye_height_diff", label: "左右差：目の高さ" },
  { code: "neutral_mouth_corner_diff", label: "左右差：口角" },
  { code: "neutral_mouth_corner_droop", label: "口角の下がり" },
].map((m) => ({
  ...m,
  unit: "pt",
  group: "neutral" as const,
  analysisType: "face" as const,
  // 無表情は「基準の姿」であり単純な高低で良し悪しを決めない項目が多い。
  direction: "toZero" as const,
  provisional: true,
}))

/*
  🔴 顔の指標の単位は **pt**(使用者確定 2026-09-21)。ユーザー向け結果画面が
     「可動域 34pt」「左右差 +9pt」と出しているので、管理画面も同じ単位・同じ値に
     揃える (§5 同一指標原則)。姿勢は画面で確認できていないので mm / deg のまま。
  ⚠️ mm 換算は V1 スコープに入っている(V1/V2 スコープ確定)。pt と mm の関係は
     AI分析 v1.6 側の正本を要確認。
*/
/*
  🔴 名前はユーザー向け結果画面に合わせる (2026-09-21 確認)。
     画面の見出しは撮影時の指示語(い ー / う ー / あ ー / 目)で、その下に動作名が付く。
  🔴 左右差は動作ごとに測っている部位が違う。「左右差」とだけ書くと何の左右差か
     分からないので、画面と同じ名前を持たせる。
  🔴 代償は画面に出ていた 2 動作(開眼・眉間収縮)だけ。他の 3 動作には無い。
*/
const POSES: {
  pose: Exclude<PoseCode, "neutral">
  /** 動作名。 */
  label: string
  /** 撮影時の指示語。画面では見出しに出る。 */
  cue: string
  /** その動作で測る左右差の名前。 */
  asymmetryLabel: string
  /** 代償・過緊張の名前。無い動作は undefined。 */
  compensationLabel?: string
}[] = [
  { pose: "smile", label: "口角挙上", cue: "い ー", asymmetryLabel: "いー笑顔" },
  { pose: "pucker", label: "口すぼめ", cue: "う ー", asymmetryLabel: "口中心" },
  { pose: "jaw_open", label: "開口", cue: "あ ー", asymmetryLabel: "顎" },
  {
    pose: "eye_open",
    label: "開眼",
    cue: "目",
    asymmetryLabel: "目",
    compensationLabel: "目の代償",
  },
  {
    pose: "brow_furrow",
    label: "眉間収縮",
    cue: "眉間",
    asymmetryLabel: "眉の高さ",
    compensationLabel: "眉の過緊張",
  },
]

export const POSE_DISPLAY = POSES

/** 5動作 × (可動域 / 左右差 / 代償・過緊張。代償は 2 動作のみ) */
const POSE_METRICS: MetricDef[] = POSES.flatMap(
  ({ pose, label, asymmetryLabel, compensationLabel }) => [
  {
    code: `${pose}_range`,
    label: `${label} 可動域`,
    group: "range" as const,
    analysisType: "face" as const,
    poseCode: pose,
    unit: "pt",
    direction: "higher" as const,
    provisional: true,
  },
  {
    code: `${pose}_asymmetry`,
    label: `${label} 左右差：${asymmetryLabel}`,
    group: "asymmetry" as const,
    analysisType: "face" as const,
    poseCode: pose,
    unit: "pt",
    direction: "toZero" as const,
    provisional: true,
  },
  /* 代償は画面に出ていた 2 動作だけ。無い動作に空欄を作らない */
  ...(compensationLabel
    ? [
        {
          code: `${pose}_compensation`,
          label: compensationLabel,
          group: "compensation" as const,
          analysisType: "face" as const,
          poseCode: pose,
          unit: "index",
          direction: "lower" as const,
          provisional: true,
        },
      ]
    : []),
  ]
)

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

/* ------------------------------------------------------------------ *
 * 同年代平均との比較 (仕様書 v1.0 §5.2)
 *
 * §5.2 の neutral 欄は「無表情6指標、**同年代比較**、average_version」。
 *
 * 🔴 平均値そのものは AI分析 v1.6 が正本。ここは管理画面が表示するための
 *    参照インターフェースで、値はモックである。
 * 🔴 §8 のとおり average_version（同年代平均）は AI の threshold_version や
 *    推奨基準 version とは別物。同じ値として扱わない。
 * 🔴 neutral のみに出す。5動作の可動域と混ぜない (§5.2)。
 * ------------------------------------------------------------------ */

export type AgeBandAverages = {
  /** 同年代平均の版。分析結果に記録された averageVersion と一致するはず。 */
  version: string
  /** ageBand → metricCode → 平均値 */
  values: Record<string, Record<string, number>>
}

export type AgeBandComparison = {
  metric: MetricDef
  value?: number
  average?: number
  /** value - average。符号は指標の意味で解釈すること。 */
  diff?: number
  /** metric_direction に沿って平均より良いか。判定不能なら null。 */
  betterThanAverage: boolean | null
}

/**
 * neutral 6 指標について、本人の値と同年代平均を並べる。
 * 平均が無い/値が無い指標は average / diff が undefined になる（欠測として出す）。
 */
export function compareWithAgeBand(
  metrics: { metricCode: string; value: number }[],
  ageBand: string | undefined,
  averages: AgeBandAverages
): AgeBandComparison[] {
  const table = ageBand ? averages.values[ageBand] : undefined
  return metricsByGroup("neutral").map((metric) => {
    const value = metrics.find((m) => m.metricCode === metric.code)?.value
    const average = table?.[metric.code]
    const diff =
      value !== undefined && average !== undefined
        ? Number((value - average).toFixed(2))
        : undefined
    return {
      metric,
      value,
      average,
      diff,
      betterThanAverage: isImproved(metric.code, average, value),
    }
  })
}
