import type { Video, VideoCategory, VideoViewRecord } from "./types"
import { users } from "./users"

const END_DATE_MS = new Date("2026-05-13T00:00:00Z").getTime()
const VIEW_WINDOW_DAYS = 30

function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 15 動画 = 5 カテゴリ × 3 尺(30s / 60s / 120s)
export const videos: Video[] = [
  // ストレッチ
  { id: 1, title: "首肩クイックストレッチ", durationSeconds: 30, category: "stretch" },
  { id: 2, title: "肩こり解消ストレッチ", durationSeconds: 60, category: "stretch", recommendedFor: ["ややお疲れ", "蓄積しています"] },
  { id: 3, title: "全身リフレッシュストレッチ", durationSeconds: 120, category: "stretch", recommendedFor: ["蓄積しています", "踏ん張りどき"] },
  // 瞑想
  { id: 4, title: "30秒マインドリセット", durationSeconds: 30, category: "meditation" },
  { id: 5, title: "1分集中呼吸瞑想", durationSeconds: 60, category: "meditation", recommendedFor: ["蓄積しています"] },
  { id: 6, title: "深い疲労からの回復瞑想", durationSeconds: 120, category: "meditation", recommendedFor: ["蓄積しています", "踏ん張りどき"] },
  // ヨガ
  { id: 7, title: "デスクサイドヨガ30秒", durationSeconds: 30, category: "yoga" },
  { id: 8, title: "リラックスヨガフロー", durationSeconds: 60, category: "yoga", recommendedFor: ["ややお疲れ"] },
  { id: 9, title: "ナイトリセットヨガ", durationSeconds: 120, category: "yoga", recommendedFor: ["蓄積しています", "踏ん張りどき"] },
  // 呼吸
  { id: 10, title: "深呼吸30秒", durationSeconds: 30, category: "breathing" },
  { id: 11, title: "腹式呼吸エクササイズ", durationSeconds: 60, category: "breathing", recommendedFor: ["ややお疲れ"] },
  { id: 12, title: "ストレス緩和呼吸法", durationSeconds: 120, category: "breathing", recommendedFor: ["蓄積しています"] },
  // アイケア
  { id: 13, title: "目の疲れ瞬間ケア", durationSeconds: 30, category: "eye-care", recommendedFor: ["ややお疲れ"] },
  { id: 14, title: "PC疲労 目元ストレッチ", durationSeconds: 60, category: "eye-care", recommendedFor: ["ややお疲れ", "蓄積しています"] },
  { id: 15, title: "視覚リフレッシュ集中ケア", durationSeconds: 120, category: "eye-care", recommendedFor: ["蓄積しています"] },
]

export function getVideoById(id: number): Video | undefined {
  return videos.find((v) => v.id === id)
}

// 視聴 mock 生成。各 user は 5-20 件の視聴記録を持つ。
// 完遂率は尺に応じて低下:30s→90%, 60s→75%, 120s→55%
// 完遂した視聴のうち約 35% が 24h 内に再分析を行う(care → re-analysis の連動)
function generateViewRecordsForUser(userId: number): VideoViewRecord[] {
  const rng = mulberry32(userId * 1009 + 17)
  const count = 5 + Math.floor(rng() * 16) // 5-20 件

  const records: VideoViewRecord[] = []
  for (let i = 0; i < count; i++) {
    const daysBack = Math.floor(rng() * VIEW_WINDOW_DAYS)
    const hourOffset = 7 + Math.floor(rng() * 15) // 7-21 時
    const minute = Math.floor(rng() * 60)
    const ms =
      END_DATE_MS -
      daysBack * 86400000 +
      hourOffset * 3600000 +
      minute * 60000
    const watchedAt = new Date(ms).toISOString().slice(0, 19)

    const video = videos[Math.floor(rng() * videos.length)]
    const baseCompletion =
      video.durationSeconds <= 30
        ? 0.9
        : video.durationSeconds <= 60
          ? 0.75
          : 0.55
    const completed = rng() < baseCompletion
    const reanalyzedWithin24h = completed && rng() < 0.35

    records.push({
      userId,
      videoId: video.id,
      watchedAt,
      completed,
      reanalyzedWithin24h,
    })
  }

  return records.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt))
}

export const allViewRecords: VideoViewRecord[] = users.flatMap((u) =>
  generateViewRecordsForUser(u.id)
)

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function getViewsForScope(
  scopeUserIds: number[] | "all"
): VideoViewRecord[] {
  if (scopeUserIds === "all") return allViewRecords
  const set = new Set(scopeUserIds)
  return allViewRecords.filter((r) => set.has(r.userId))
}

export function getViewsByCompany(companyId: number): VideoViewRecord[] {
  const userIds = users.filter((u) => u.companyId === companyId).map((u) => u.id)
  return getViewsForScope(userIds)
}

export type VideoStats = {
  videoId: number
  viewCount: number
  completionRate: number // 0-1
  reanalysisRate: number // 完遂者中 24h 内再分析率
}

export function getVideoStats(
  videoId: number,
  records: VideoViewRecord[]
): VideoStats {
  const filtered = records.filter((r) => r.videoId === videoId)
  if (filtered.length === 0) {
    return { videoId, viewCount: 0, completionRate: 0, reanalysisRate: 0 }
  }
  const completedCount = filtered.filter((r) => r.completed).length
  const reanalyzed = filtered.filter((r) => r.reanalyzedWithin24h).length
  return {
    videoId,
    viewCount: filtered.length,
    completionRate: completedCount / filtered.length,
    reanalysisRate: completedCount === 0 ? 0 : reanalyzed / completedCount,
  }
}

export function getAllVideoStats(records: VideoViewRecord[]): VideoStats[] {
  return videos.map((v) => getVideoStats(v.id, records))
}

import {
  DURATION_BUCKETS,
  getDurationBucket,
  type DurationBucket,
} from "./types"

export type DurationBucketStats = {
  bucket: DurationBucket
  videoCount: number
  viewCount: number
  completionRate: number
  reanalysisRate: number
}

export function groupVideosByDurationBucket(
  records: VideoViewRecord[]
): DurationBucketStats[] {
  return DURATION_BUCKETS.map((bucket) => {
    const videosInBucket = videos.filter(
      (v) => getDurationBucket(v.durationSeconds).key === bucket.key
    )
    const videoIds = new Set(videosInBucket.map((v) => v.id))
    const bucketRecords = records.filter((r) => videoIds.has(r.videoId))

    if (bucketRecords.length === 0) {
      return {
        bucket,
        videoCount: videosInBucket.length,
        viewCount: 0,
        completionRate: 0,
        reanalysisRate: 0,
      }
    }

    const completed = bucketRecords.filter((r) => r.completed).length
    const reanalyzed = bucketRecords.filter((r) => r.reanalyzedWithin24h).length
    return {
      bucket,
      videoCount: videosInBucket.length,
      viewCount: bucketRecords.length,
      completionRate: completed / bucketRecords.length,
      reanalysisRate: completed === 0 ? 0 : reanalyzed / completed,
    }
  })
}

// カテゴリ別集計(分布 chart 用)
export function getCategoryStats(
  records: VideoViewRecord[]
): Record<VideoCategory, { viewCount: number; completionRate: number }> {
  const cats: VideoCategory[] = [
    "stretch",
    "meditation",
    "yoga",
    "breathing",
    "eye-care",
  ]
  const result = {} as Record<
    VideoCategory,
    { viewCount: number; completionRate: number }
  >
  for (const cat of cats) {
    const catVideoIds = new Set(
      videos.filter((v) => v.category === cat).map((v) => v.id)
    )
    const catRecords = records.filter((r) => catVideoIds.has(r.videoId))
    const completed = catRecords.filter((r) => r.completed).length
    result[cat] = {
      viewCount: catRecords.length,
      completionRate:
        catRecords.length === 0 ? 0 : completed / catRecords.length,
    }
  }
  return result
}
