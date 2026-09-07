/**
 * 顧客の状態バッジ (仕様書 v1.0 §3 / 吉田さん確定 2026-09-07)
 *
 * 🔴 プランと店舗連携は**別契約**。既に Premium を契約している人が店舗連携しても
 *    本人の Premium 契約と課金は継続するため、「連携済み」でプラン名を置き換えず
 *    **両方**表示する。
 * 🔴 未登録(未連携分析のみ)は §3「B2B に Guest プランは存在しない」ため
 *    プラン名を出さず「未連携分析」だけを出す。
 */

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
  /** active な店舗連携があるか。 */
  linked: boolean
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
      <Badge variant="outline" className={size}>
        {PLAN_LABEL[customer.plan]}
      </Badge>
      {linked ? <Badge className={size}>連携済み</Badge> : null}
    </>
  )
}
