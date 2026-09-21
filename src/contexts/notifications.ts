/**
 * 生画像 一時閲覧の発行 (ヘッダーのベル)
 *
 * 🔴 人による承認ステップは**無い**(使用者確定 2026-09-21)。
 *    見られる人がその場で発行し、署名 URL が 300 秒だけ有効になる。
 *      - 本部: 全社横断で見られるが、理由の入力が必要 (§2)
 *      - 店舗・企業: **自店で撮影した画像だけ**。理由の入力は不要
 *        (吉田さん 2026-09-07「通常の店舗閲覧では理由入力を求めない」)
 *      - 自宅撮影分・他店撮影分は、申請すれば見られるのではなく**見られない**
 *    可否は `decideRawImageView()` が決める。
 *
 * ⚠️ 以前あった「申請 → 本部が審査 → 承認/却下」は削除した。
 *    §11 は「権限・所有・active link・目的・理由を検証し署名 URL 300 秒」
 *    としか書いておらず、人による承認は仕様に無い。上の 2026-09-07 の決定で
 *    通常の経路からも外れ、申請を出す導線がどこにも無いまま残っていた。
 *    例外的な横断閲覧(他店の画像を見たい等)の要望が出たら、そのとき設計し直す。
 *
 * ベルに出るのは**自分が発行したもの**だけ。誰がいつ何を見たかを横断で追うのは
 * 監査画面 (§11 の image_access_logs) の役目で、ベルの役目ではない。
 */

import { createContext, useContext } from "react"

/** 発行済みの一時閲覧 1 件。 */
export type ViewGrant = {
  id: string
  rawImageAssetId: string
  /** 閲覧の目的。監査に記録される。店舗の通常閲覧では定型文が入る。 */
  purpose: string
  issuerAccountId: string
  issuerName: string
  issuerRole: string
  issuedAt: string
  /** 署名 URL の失効時刻。 */
  expiresAt: string
  /** 監査ログの request ID */
  requestId: string
  /** ベルの未読バッジ用。開いたら既読。 */
  read: boolean
}

export type NotificationsValue = {
  /** 自分が発行した一時閲覧(新しい順)。既読でも一覧からは消さない。 */
  grants: ViewGrant[]
  unreadCount: number
  /**
   * 一時閲覧を発行する。
   * 🔴 呼ぶ前に `decideRawImageView()` で可否を判定すること。
   *    本部の横断閲覧では理由を入れる。店舗の自店閲覧では定型文を渡す。
   */
  issue: (input: { rawImageAssetId: string; purpose: string }) => void
  markRead: (grantId: string) => void
}

export const NotificationsContext = createContext<NotificationsValue | null>(null)

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider")
  }
  return ctx
}

/** 署名 URL の有効秒数 (§11)。 */
export const VIEW_TOKEN_TTL_SECONDS = 300
