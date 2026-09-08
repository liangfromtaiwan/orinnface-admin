/**
 * 契約状態のバッジ (仕様書 v1.0 §4)
 *
 * 解約 < 停止中 < 契約中 の順序を持つので、プランバッジと同じ段階語彙
 * (tier-badge.ts) で描く。契約中だけが塗りを持つ。
 *
 * 🔴 会社・店舗一覧と視点切替の両方に出るので、見た目はここに 1 箇所だけ置く。
 */

import { CONTRACT_STEP, TIER_BADGE } from "@/components/tier-badge"
import { Badge } from "@/components/ui/badge"
import { CONTRACT_STATUS_LABEL, type Company } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

export function ContractBadge({
  status,
  className,
}: {
  status: Company["contractStatus"]
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("px-1.5 py-0 text-[10px]", TIER_BADGE[CONTRACT_STEP[status]], className)}
    >
      {CONTRACT_STATUS_LABEL[status]}
    </Badge>
  )
}
