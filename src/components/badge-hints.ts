/**
 * 状態バッジの説明文 (HintBadge から使う)
 *
 * 🔴 同じバッジが複数画面に出るので、文章はここに 1 箇所だけ置く。
 *    画面ごとに書くと定義がずれる。
 * 🔴 日数などの数値は定数から組み立てる。文章に直接書くと実装と乖離する。
 * 🔴 未確定の仕様は「未確定」と書く。断定した説明を書いて既定事実にしない。
 *
 * 文字列だけを持ち、見出しと本文の描き方は HintBadge に任せる
 * (JSX を持たせると画面ごとに体裁がずれる)。
 */

import { CHURN_RISK_DAYS } from "@/lib/domain/kpi"

export type BadgeHint = {
  title: string
  /** 1 行 1 段落。hover で読むものなので 2 行までに収める。 */
  lines: string[]
}

export const BADGE_HINT: Record<string, BadgeHint> = {
  /*
    🔴 「適格分析に入るか」は KPI の母数を変える。warn と insufficient で
       扱いが違うので、同じ文面にせず現在の実装をそのまま書く。
       判定は kpi.ts の isEligible() が正 — 文面を変えるときは必ず突き合わせる。
  */
  quality_warn: {
    title: "品質注意",
    lines: [
      "この回の撮影品質に注意があります。AI 分析が返した判定をそのまま表示しています。",
      "適格分析には含めています。閾値の定義と除外の要否は未確定です。",
    ],
  },
  quality_insufficient: {
    title: "品質不足",
    lines: [
      "この回の撮影品質が不足しています。AI 分析が返した判定をそのまま表示しています。",
      "適格分析から除外しているため、KPI の母数に入りません。閾値の定義と除外の要否は未確定です。",
    ],
  },
  churn_risk: {
    title: "離脱リスク",
    lines: [
      `最終の適格分析から ${CHURN_RISK_DAYS} 日以上経過した、店舗連携が有効な顧客に付きます。`,
      "適格分析は新規撮影のみで、再解析は数えません。日数は運用設定です。",
    ],
  },
}
