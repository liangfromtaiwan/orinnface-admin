/**
 * 判定閾値 (正常 / 要注意 / 要ケア)
 *
 * 🔴 **正本は AI分析 v1.6**。この管理画面からは変更できない(表示のみ)。
 *    推奨基準値(§8)とは別物で、version も別 (threshold_version)。
 *    推奨基準値 = どの 2 動作を勧めるかを決める値
 *    判定閾値   = ユーザーの結果画面で 正常/要注意/要ケア のどれを出すかを決める値
 * 🔴 それでも管理画面に出すのは、ユーザーから「なぜ要ケアなのか」と問われたときに
 *    本部がその線を確認できる場所がどこにも無かったため(使用者確定 2026-09-21)。
 *
 * ⚠️ ここに入っている数値は**暫定**。AI分析 v1.6 の閾値表を入手したら差し替える。
 *    画面には必ず「暫定」と出すこと。
 *
 * 判定の型 (結果画面の色分けロジックより):
 *   higher_better … 可動域。高いほどよい。下回るほど要ケア
 *   near_zero     … 左右差・無表情の偏り。0 から離れるほど要ケア(絶対値で見る)
 *   binary        … 代償・過緊張。あり / なし の 2 値
 */

import type { MetricGroup } from "./metrics"

export type ThresholdKind = "higher_better" | "near_zero" | "binary"

export const THRESHOLD_KIND_LABEL: Record<ThresholdKind, string> = {
  higher_better: "高いほどよい",
  near_zero: "0 に近いほどよい",
  binary: "あり / なし",
}

export type ThresholdRule = {
  /** 対象の指標グループ。 */
  group: MetricGroup
  kind: ThresholdKind
  unit: string
  /**
   * 正常 と 要注意 の境目。
   * higher_better: これ以上なら正常 / near_zero: 絶対値がこれ以下なら正常
   */
  caution: number
  /** 要注意 と 要ケア の境目。 */
  danger: number
  note?: string
}

export type ThresholdSet = {
  version: string
  /** AI分析 の版。この閾値がどのモデルに対するものか。 */
  modelVersion: string
  rules: ThresholdRule[]
  /** 実測 + 指標責任者の承認が済んでいない間は true。 */
  provisional: boolean
}

/**
 * 現行の判定閾値。
 * ⚠️ 暫定値。ユーザー向け結果画面の表示(可動域 34pt=要ケア / 52pt=正常、
 *    左右差 ±7〜9pt=正常 / ±10〜12pt=要注意 / ±21pt=要ケア)から逆算した推定で、
 *    AI分析 v1.6 の正本ではない。
 */
export const ACTIVE_THRESHOLD_SET: ThresholdSet = {
  version: "th-v1.6.0",
  modelVersion: "face-v1.6.0",
  provisional: true,
  rules: [
    {
      group: "range",
      kind: "higher_better",
      unit: "pt",
      caution: 45,
      danger: 35,
      note: "5動作の可動域。推奨する 2 動作を決めるのはこの閾値ではなく基準値セット。",
    },
    {
      group: "asymmetry",
      kind: "near_zero",
      unit: "pt",
      caution: 10,
      danger: 20,
      note: "左右どちらに寄っているかは符号で示す。判定は絶対値で行う。",
    },
    {
      group: "neutral",
      kind: "near_zero",
      unit: "pt",
      caution: 10,
      danger: 20,
      note: "無表情 6 指標。同年代平均との比較は average_version 側。",
    },
    {
      group: "compensation",
      kind: "binary",
      unit: "—",
      caution: 1,
      danger: 1,
      note: "代償・過緊張。結果画面では「なし」「あり」で出す。",
    },
  ],
}

/** その値がどの判定になるか。画面のプレビュー用。 */
export function judge(
  rule: ThresholdRule,
  value: number
): "normal" | "caution" | "danger" {
  if (rule.kind === "binary") return value > 0 ? "danger" : "normal"
  const v = rule.kind === "near_zero" ? Math.abs(value) : value
  if (rule.kind === "near_zero") {
    if (v <= rule.caution) return "normal"
    return v <= rule.danger ? "caution" : "danger"
  }
  if (v >= rule.caution) return "normal"
  return v >= rule.danger ? "caution" : "danger"
}

export const JUDGE_LABEL: Record<
  ReturnType<typeof judge>,
  { label: string; className: string }
> = {
  normal: { label: "正常", className: "text-emerald-700" },
  caution: { label: "要注意", className: "text-amber-700" },
  danger: { label: "要ケア", className: "text-destructive" },
}
