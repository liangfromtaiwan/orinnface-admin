/**
 * 顧客の呼び名 (店舗スタッフ画面の設計 / 使用者指摘 2026-09-25)
 *
 * 名前の出どころは 2 つある。
 * - **未登録顧客**: 店舗スタッフが撮影前に「簡易登録」でお名前・メール・年齢を
 *   入れる。アカウントはまだ無い(未連携)が、名前はある。
 * - **Member / Premium**: 本人が登録している。
 *
 * 🔴 **Guest(B2C・未ログイン)だけは名前を持たない**。店舗を通っていないので誰も
 *    入力しておらず、本人もログインもしていない。匿名識別子(§9)で呼ぶ。
 *    名前を捏造して出すと、公開 URL で実在の人の情報が入っているように見える。
 * ⚠️ 本人が登録するときにどの名前が入るか(本人の入力 / Google の表示名 / 取得しない)は
 *    アカウント認証 v1.0 が未入手のため未確定 → QUESTIONS #26。
 */

import type { Customer } from "./types"

/** 名前を持たない B2C・未ログインの利用者に使う呼び名。 */
export const GUEST_CUSTOMER_LABEL = "Guest（未ログイン）"

/**
 * 一覧・見出しに出す呼び名。
 * 🔴 名前が無いのは Guest(未ログイン)だけ。無い人に氏名を作らない。
 */
export function customerLabel(customer: Customer): string {
  return customer.displayName ?? GUEST_CUSTOMER_LABEL
}

/**
 * 呼び名の下に出す識別子。
 * 未連携分析・Guest は匿名識別子、本人が登録済みなら顧客番号。
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
