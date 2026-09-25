/**
 * 顧客の呼び名 (使用者指摘 2026-09-25)
 *
 * 🔴 **登録していない人に名前は無い**。未連携分析の仮データは、本人が登録して
 *    いないので誰も名前を名乗っていない。それなのに氏名が出ていると、実在の人の
 *    情報が入っているように見える。仮データは匿名識別子(§9)で呼ぶ。
 * 🔴 登録済みの方の表示名は**登録時に入ったもの**。Guest(無料プラン)でも登録は
 *    済んでいるので名前を持つ。
 * ⚠️ 登録時にどの名前が入るか(本人の入力 / Google の表示名 / そもそも取得しない)は
 *    アカウント認証 v1.0 が未入手のため未確定 → QUESTIONS #26。
 */

import type { Customer } from "./types"

/** 未登録の仮データ(店舗で撮っただけ)に使う呼び名。 */
export const UNREGISTERED_CUSTOMER_LABEL = "未登録の顧客"

/** Guest(ログインしていない利用者)に使う呼び名。 */
export const GUEST_CUSTOMER_LABEL = "Guest（未ログイン）"

/**
 * 一覧・見出しに出す呼び名。
 * 🔴 名前が分かるのはログインしている人だけ。Guest と未登録の仮データは
 *    名前を持たないので、それぞれの呼び名を出す(どちらか分かるように語を変える)。
 */
export function customerLabel(customer: Customer): string {
  if (customer.displayName) return customer.displayName
  return customer.unregistered
    ? UNREGISTERED_CUSTOMER_LABEL
    : GUEST_CUSTOMER_LABEL
}

/**
 * 呼び名の下に出す識別子。
 * 未登録は匿名識別子、登録済みは顧客番号。
 */
export function customerIdLabel(customer: Customer): string {
  return customer.anonymousId ?? customer.displayCode
}

/** 検索の対象にする文字列。名前が無い顧客は識別子だけで探せるようにする。 */
export function customerSearchText(customer: Customer): string {
  return [customer.displayName, customer.displayCode, customer.anonymousId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}
