/**
 * 分析の品質バッジ (仕様書 v1.0 §4 分析 / §5.1 顧客一覧)
 *
 * 🔴 品質は「分析」「顧客一覧」「分析履歴」の 3 画面に出る。
 *    以前は画面ごとに別々に描いていて、顧客一覧だけ tooltip があり、
 *    分析画面は素の文字で説明が無く、ラベルも「品質注意」と「注意」で割れていた。
 *    出す場所が増えても割れないよう、描画をこの 1 箇所に集約する。
 * 🔴 ラベルは列見出しの有無に関わらず「品質注意」「品質不足」で揃える。
 *    品質列の中では少し重複するが、バッジ単体で意味が分かる方を優先する
 *    (顧客一覧のように見出しが無い場所にも同じものが出るため)。
 * 🔴 等級・閾値は AI分析 v1.6 の領域で、管理画面では決められない。
 *    ここは AI が返した判定をそのまま出すだけ。
 *    定義は未確定なので tooltip に必ず「未確定」と書く (QUESTIONS #1)。
 */

import { BADGE_HINT } from "@/components/badge-hints"
import { HintBadge } from "@/components/HintBadge"
import type { AnalysisSession } from "@/lib/domain/types"

export function QualityBadge({
  quality,
  className,
}: {
  quality: AnalysisSession["quality"]
  className?: string
}) {
  if (quality === "ok") {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <HintBadge
      hint={
        quality === "warn"
          ? BADGE_HINT.quality_warn
          : BADGE_HINT.quality_insufficient
      }
      className={className}
    >
      {quality === "warn" ? "品質注意" : "品質不足"}
    </HintBadge>
  )
}
