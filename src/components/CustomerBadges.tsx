/**
 * 顧客の状態バッジ (仕様書 v1.0 §3 / 吉田さん確定 2026-09-07)
 *
 * 🔴 プランと店舗連携は**別契約**。既に Premium を契約している人が店舗連携しても
 *    本人の Premium 契約と課金は継続するため、「連携済み」でプラン名を置き換えず
 *    **両方**表示する。
 * 🔴 未登録(未連携分析のみ)は §3「B2B に Guest プランは存在しない」ため
 *    プラン名を出さず「未連携分析」だけを出す。
 *
 * プランは Guest < Member < Premium の順序を持つので、青の淡い階調で段階を表す。
 * 名前より目立つと一覧の見出しが読みにくくなるため、ベタ塗りは使わず
 * 「線のみ → 淡い青 → 少し濃い青」に留め、Premium だけ文字を太くして
 * 色に頼らない手がかりも残す。
 */

import { Badge } from "@/components/ui/badge"
import type { Customer } from "@/lib/domain/types"
import { PLAN_LABEL } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/** 青の淡い階調 + 文字の太さで段階を出す。行の主役は名前なので控えめにする。 */
const PLAN_BADGE: Record<Customer["plan"], string> = {
  guest: "border-border bg-transparent font-normal text-muted-foreground",
  member:
    "border-blue-200 bg-blue-50 font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
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
        <Badge
          variant="outline"
          className={cn(size, "border-amber-300 text-amber-700")}
        >
          再同意待ち
        </Badge>
      ) : null}
    </>
  )
}
