/**
 * 状態バッジの説明文 (HintBadge から使う)
 *
 * 🔴 同じバッジが複数画面に出るので、文章はここに 1 箇所だけ置く。
 *    画面ごとに書くと定義がずれる。
 * 🔴 日数などの数値は定数から組み立てる。文章に直接書くと実装と乖離する。
 * 🔴 未確定の仕様は「未確定」と書く。断定した説明を書いて既定事実にしない。
 */

import { CHURN_RISK_DAYS } from "@/lib/domain/kpi"

export const BADGE_HINT = {
  quality_warn: (
    <>
      <p className="font-medium">品質注意</p>
      <p className="mt-1">
        この回の撮影品質に注意がある分析です。AI 分析が返した判定をそのまま表示しています。
      </p>
      <p className="mt-1">
        どの条件で注意になるか(閾値)と、このバッジが付いた分析を適格分析から
        除外するかは未確定です。現在は除外していません。
      </p>
    </>
  ),
  quality_insufficient: (
    <>
      <p className="font-medium">品質不足</p>
      <p className="mt-1">
        撮影品質が不足している分析です。AI 分析が返した判定をそのまま表示しています。
      </p>
      <p className="mt-1">
        閾値の定義と、適格分析から除外するかは未確定です。現在は除外していません。
      </p>
    </>
  ),
  churn_risk: (
    <>
      <p className="font-medium">離脱リスク</p>
      <p className="mt-1">
        最終の適格分析から {CHURN_RISK_DAYS} 日以上経過し、店舗連携が有効な顧客に付きます。
      </p>
      <p className="mt-1">
        店舗連携のない顧客には付きません。適格分析は新規撮影のみで、再解析は数えません。
        日数は運用設定です。
      </p>
    </>
  ),
  awaiting_reconsent: (
    <>
      <p className="font-medium">再同意待ち</p>
      <p className="mt-1">
        店舗連携は有効ですが、本人の同意がまだ取れていない状態です。
        再連携した直後がこれに当たります。
      </p>
      <p className="mt-1">
        再連携しただけでは足りず本人の再同意が必要なため、同意が取れるまで
        店舗側からこの顧客の分析結果・顔画像は開けません。
      </p>
    </>
  ),
} as const
