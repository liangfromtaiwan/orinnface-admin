/**
 * 顧客の状態バッジ (仕様書 v1.0 §3)
 *
 * 表示ルール:
 *   1. 未登録(未連携分析のみ) → 「未連携分析」
 *      🔴 §3「B2B に Guest プランは存在しない」ため、プラン名は出さない
 *   2. active な店舗連携あり  → 「連携済み」
 *      店舗経由の利用中は本人課金が発生しないため、プラン名を出す意味がない
 *      (⚠️ 課金の扱いは docs/QUESTIONS_FOR_YOSHIDA.md の項目 8 で確認中)
 *   3. それ以外(純 B2C / 連携解除済み) → プラン名
 *
 * 🔴 連携済みの顧客は機能面では Premium 相当として扱う(effectivePlan())。
 *    契約プランのデータ自体は保持しており、課金の集計はそちらで行う。
 * ⚠️ この扱いは全確定事項 v1(2026年4月)からの読み取り。
 *    docs/QUESTIONS_FOR_YOSHIDA.md の項目 8 で確認中。
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
  if (customer.unregistered) {
    return (
      <Badge variant="secondary" className={cn("px-1 py-0 text-[10px]", className)}>
        未連携分析
      </Badge>
    )
  }
  if (linked) {
    return (
      <Badge className={cn("px-1 py-0 text-[10px]", className)}>連携済み</Badge>
    )
  }
  return (
    <Badge variant="outline" className={cn("px-1 py-0 text-[10px]", className)}>
      {PLAN_LABEL[customer.plan]}
    </Badge>
  )
}
