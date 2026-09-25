/**
 * 顧客の状態バッジ (仕様書 v1.0 §3 / 吉田さん確定 2026-09-07)
 *
 * 🔴 プランと店舗連携は**別契約**。既に Premium を契約している人が店舗連携しても
 *    本人の Premium 契約と課金は継続するため、「連携済み」でプラン名を置き換えず
 *    **両方**表示する。
 * 🔴 未登録(未連携分析のみ)は §3「B2B に Guest プランは存在しない」ため
 *    プラン名を出さず「未登録(仮データ)」だけを出す。名前は店舗スタッフが
 *    撮影前の**簡易登録**で入れているので持っている。
 * 🔴 **Guest はログインしていない利用者**(使用者確定 2026-09-25)。名前も連絡先も
 *    持たず、1 日 1 回の分析だけができる。店舗連携の前に必ずログインが要り、
 *    ログインした時点で Member になるので、**Guest のまま連携済みにはならない**。
 * 🔴 名前を持たない状態が 2 種類あるので、語を変えて見分けられるようにする。
 *    Guest = B2C で自分で撮った人 / 未登録(仮データ) = 店舗で撮ったが登録していない人。
 * ⚠️ 吉田さんからは「Guest 会員が店舗連携済みの状態はあり得る」というご指摘を
 *    いただいており、上の理解と食い違う。確認中 (QUESTIONS #26)。
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
        title="店舗で撮影した未連携分析です。お名前は店舗スタッフが撮影前の簡易登録で入力したもので、本人のアカウントはまだありません（未連携）。"
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
            ? "ログインしていない利用者です。1 日 1 回の分析のみで、名前・連絡先は持ちません。"
            : undefined
        }
      >
        {PLAN_LABEL[customer.plan]}
      </Badge>
      {linked ? <Badge className={size}>連携済み</Badge> : null}
    </>
  )
}
