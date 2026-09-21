/**
 * 理由入力の判定 (仕様書 v1.0 §13「重い操作は確認画面と理由入力」)
 *
 * 🔴 「1」「a」のような入力を監査に残しても、後から見て何も分からない。
 *    ただし弾くなら**弾く条件を画面に書く**こと。書かずに送信ボタンだけ
 *    無効にすると、何が足りないのか分からないまま止まる (ReasonField が出す)。
 * (component と同じファイルに置くと fast-refresh が効かないので分けている)
 */

export const REASON_MIN_LENGTH = 4

export function isReasonEnough(value: string): boolean {
  return value.trim().length >= REASON_MIN_LENGTH
}
