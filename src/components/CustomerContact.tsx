/**
 * 顧客の連絡先 (§5 / 店舗スタッフ画面の設計 2026-09-25)
 *
 * 🔴 email は identity 側に置き、`dataSubjectId` で join して出す。
 *    Customer(analytics)には持たせない。
 * 🔴 **出どころを一緒に出す**。同じメールアドレスでも、本人が登録したものと、
 *    撮影前に店舗スタッフが簡易登録で入力したものでは意味が違う。後者は本人の
 *    アカウントがまだ無い(未連携)ので、そのつもりで連絡してはいけない。
 * 🔴 Guest(未ログイン)は連絡先を持たない。誰も入力していないため。
 */

import type { CustomerIdentity } from "@/lib/domain/types"

export function CustomerContact({
  identity,
}: {
  identity?: CustomerIdentity
}) {
  if (!identity) {
    return (
      <span className="text-xs">メールアドレスなし（Guest・未ログイン）</span>
    )
  }

  if (identity.source === "store_intake") {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {identity.email}
        <span
          className="rounded-sm border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground"
          title="撮影前に店舗スタッフが簡易登録で入力した連絡先です。本人のアカウントとはまだ紐付いていません（未連携）。"
        >
          店舗の簡易登録
        </span>
      </span>
    )
  }

  return <>{identity.email}</>
}
