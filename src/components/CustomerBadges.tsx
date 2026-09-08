/**
 * 顧客の状態バッジ (仕様書 v1.0 §3 / 吉田さん確定 2026-09-07)
 *
 * 🔴 プランと店舗連携は**別契約**。既に Premium を契約している人が店舗連携しても
 *    本人の Premium 契約と課金は継続するため、「連携済み」でプラン名を置き換えず
 *    **両方**表示する。
 * 🔴 未登録(未連携分析のみ)は §3「B2B に Guest プランは存在しない」ため
 *    プラン名を出さず「未連携分析」だけを出す。
 *
 * プランは Guest < Member < Premium の順序を持つので、
 * 「灰の線のみ → 青の線のみ → 青の塗り」の 3 段で表す。
 * 有料の Premium だけが塗りを持つので、塗りの有無が Member との境界になる。
 * 淡い青同士の塗り分けより差が出るうえ、名前より目立たない。
 * 文字の太さも normal → medium → semibold と変えて、色以外の手がかりも残す。
 */

import { BADGE_HINT } from "@/components/badge-hints"
import { HintBadge } from "@/components/HintBadge"
import { Badge } from "@/components/ui/badge"
import type { Customer } from "@/lib/domain/types"
import { PLAN_LABEL } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/** 塗りの有無 + 文字の太さで段階を出す。行の主役は名前なので控えめにする。 */
const PLAN_BADGE: Record<Customer["plan"], string> = {
  guest: "border-border bg-transparent font-normal text-muted-foreground",
  member:
    "border-blue-300 bg-transparent font-medium text-blue-700 dark:border-blue-800 dark:text-blue-300",
  // 有料プランだけが塗りを持つ
  premium:
    "border-blue-300 bg-blue-100 font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-200",
}

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
        className={cn(size, PLAN_BADGE[customer.plan])}
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
