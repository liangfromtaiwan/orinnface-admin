/**
 * 登録済み動画の再生元 (モック専用)
 *
 * 🔴 実装では **backend が署名 URL を発行する**。`CareVideoAsset` に URL を持たせない
 *    (asset は素性だけを持つ。配信・変換・期限付き URL は backend の担当)。
 *    実 API 接続時はこの module を差し替えるだけで済むよう、参照箇所を 1 本に絞っている。
 * 🔴 ここが返すのは `public/mock/care/` に置いたテストパターン動画で、**中身は care の
 *    内容ではない**。承認前に「中身を見る」導線を画面で検証するためだけのもの。
 *    画面には必ずモックである旨を出すこと (`CareVideoPreview`)。
 *
 * 本部標準と提供元(店舗・会社)で別のパターンを返す。差し替え承認は「今の動画」と
 * 「切り替え先」を見比べる操作なので、両方が同じ絵だと見比べたことにならない。
 */

import type { CareVideoAsset } from "@/lib/domain/types"

/** 本部が提供者のときの表示名。seed と揃える。 */
const HQ_PROVIDER = "FitWayWorld"

/** 用意してあるモックの尺。近い尺のものを使う。 */
const MOCK_DURATIONS = [60, 90, 180] as const

function nearestDuration(seconds: number): (typeof MOCK_DURATIONS)[number] {
  return MOCK_DURATIONS.reduce((best, d) =>
    Math.abs(d - seconds) < Math.abs(best - seconds) ? d : best
  )
}

/**
 * その asset を再生するための URL。
 * 実 API では `GET /admin/v1/care-video-assets/{id}` 相当が返す署名 URL に置き換える。
 */
export function mockPlaybackUrl(asset: CareVideoAsset): string {
  const kind = asset.provider === HQ_PROVIDER ? "standard" : "provider"
  return `/mock/care/${kind}-${nearestDuration(asset.durationSeconds)}s.mp4`
}
