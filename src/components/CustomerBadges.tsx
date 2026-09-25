/**
 * 顧客の状態バッジ (仕様書 v1.0 §3 / 吉田さん確定 2026-09-07)
 *
 * 🔴 プランと店舗連携は**別契約**。既に Premium を契約している人が店舗連携しても
 *    本人の Premium 契約と課金は継続するため、「連携済み」でプラン名を置き換えず
 *    **両方**表示する。
 * 🔴 未登録(未連携分析のみ)は §3「B2B に Guest プランは存在しない」ため
 *    プラン名を出さず「未登録(仮データ)」だけを出す。
 * 🔴 **Guest 会員が店舗連携済み**という状態はあり得る(吉田さん確定 2026-09-25)。
 *    未登録の仮データと見分けが付くように、Guest のときも
 *    「Guest」+「連携済み」を並べ、未登録側は色も語も変える。
 *    Guest = 登録済み・無料プラン / 未登録 = まだ登録していない人の仮データ。
 *
 * プランは Guest < Member < Premium の順序を持つので、段階バッジの語彙
 * (tier-badge.ts) をそのまま使う。契約状態のバッジと同じ見た目になる。
 * 有料の Premium だけが塗りを持つので、塗りの有無が Member との境界になる。
 */

import { PLAN_STEP, TIER_BADGE } from "@/components/tier-badge"
import { Badge } from "@/components/ui/badge"
import type { Customer } from "@/lib/domain/types"
import { PLAN_LABEL } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

export function CustomerBadges({
  customer,
  linked,
  className,
}: {
  customer: Customer
  /** active な店舗連携があり、本人の同意も取れているか。 */
  linked: boolean
  className?: string
}) {
  const size = cn("px-1 py-0 text-xs", className)

  if (customer.unregistered) {
    return (
      <Badge
        variant="outline"
        className={cn(size, "border-amber-300 text-amber-700")}
        title="まだ登録していない人の仮データです（店舗で撮影した未連携分析）。アカウントも店舗連携もありません。"
      >
        未登録（仮データ）
      </Badge>
    )
  }

  return (
    <>
      <Badge
        variant="outline"
        className={cn(size, TIER_BADGE[PLAN_STEP[customer.plan]])}
        title={
          customer.plan === "guest"
            ? "登録済み・無料プランです。店舗連携は別契約なので「連携済み」と併記されます。"
            : undefined
        }
      >
        {PLAN_LABEL[customer.plan]}
      </Badge>
      {linked ? <Badge className={size}>連携済み</Badge> : null}
    </>
  )
}
