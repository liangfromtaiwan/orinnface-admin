/**
 * 顧客の状態バッジ (仕様書 v1.0 §3 / 吉田さん確定 2026-09-07)
 *
 * 🔴 プランと店舗連携は**別契約**。既に Premium を契約している人が店舗連携しても
 *    本人の Premium 契約と課金は継続するため、「連携済み」でプラン名を置き換えず
 *    **両方**表示する。
 * 🔴 未登録(未連携分析のみ)は §3「B2B に Guest プランは存在しない」ため
 *    プラン名を出さず「未連携分析」だけを出す。
 *
 * プランは Guest < Member < Premium の順序を持つので、段階バッジの語彙
 * (tier-badge.ts) をそのまま使う。契約状態のバッジと同じ見た目になる。
 * 有料の Premium だけが塗りを持つので、塗りの有無が Member との境界になる。
 */

import { BADGE_HINT } from "@/components/badge-hints"
import { HintBadge } from "@/components/HintBadge"
import { PLAN_STEP, TIER_BADGE } from "@/components/tier-badge"
import { Badge } from "@/components/ui/badge"
import type { Customer } from "@/lib/domain/types"
import { PLAN_LABEL } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

export function CustomerBadges({
  customer,
  linked,
  awaitingReconsent = false,
  className,
}: {
  customer: Customer
  /** active な店舗連携があり、本人の同意も取れているか。 */
  linked: boolean
  /** 連携は active だが本人の再同意を待っている状態。 */
  awaitingReconsent?: boolean
  className?: string
}) {
  const size = cn("px-1 py-0 text-[10px]", className)

  if (customer.unregistered) {
    return (
      <Badge variant="secondary" className={size}>
        未連携分析
      </Badge>
    )
  }

  return (
    <>
      <Badge
        variant="outline"
        className={cn(size, TIER_BADGE[PLAN_STEP[customer.plan]])}
      >
        {PLAN_LABEL[customer.plan]}
      </Badge>
      {linked ? <Badge className={size}>連携済み</Badge> : null}
      {awaitingReconsent ? (
        <HintBadge hint={BADGE_HINT.awaiting_reconsent} className={size}>
          再同意待ち
        </HintBadge>
      ) : null}
    </>
  )
}
