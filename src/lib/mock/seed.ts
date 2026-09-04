/**
 * モックデータ生成 (仕様書 v1.0 準拠)
 *
 * 🔴 旧 orinnme-admin の mock-data(疲労度・主観 vs AI・admin/oem/b2b 3視点)は
 *    v1.0 と非互換のため流用しない。
 *
 * 実 API へ差し替える際は src/lib/api/ を作り、この module と同じ形を返させる。
 * 対応する管理 API は仕様書 §12 / API設計書 v1.3 を参照。
 */

import { CARE_VIDEO_SLOTS, careSlotFor } from "../domain/care-catalog"
import { METRIC_CATALOG } from "../domain/metrics"
import type {
  AdminAccount,
  AnalysisSession,
  AuditEvent,
  CareAssignment,
  CarePlayback,
  CareVideoAsset,
  Company,
  ConsentEvent,
  Customer,
  DataSubjectId,
  HandoffToken,
  PlanChangeEvent,
  PlanCode,
  MetricValue,
  RawImageAsset,
  RecommendationBaselineSet,
  RecommendationPolicySet,
  RecommendationRun,
  Store,
  StoreDataLink,
  StoreVisit,
} from "../domain/types"

/**
 * 画面の見た目を安定させるため「現在時刻」を固定する。
 * 実 API 接続時は削除し、サーバ時刻を使うこと。
 */
export const NOW = new Date("2026-08-30T12:00:00+09:00")

/** 決定的な擬似乱数 (mulberry32)。seed 固定で毎回同じデータを得る。 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = rng(20260818)

function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)]
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

function daysAhead(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString()
}

function pad(n: number, width = 3): string {
  return String(n).padStart(width, "0")
}

/* ------------------------------------------------------------------ *
 * 会社・店舗
 * ------------------------------------------------------------------ */

export const companies: Company[] = [
  {
    id: "co_hq",
    name: "FitWayWorld株式会社",
    kind: "internal",
    contractStatus: "active",
    contractedAt: "2025-04-01T00:00:00+09:00",
  },
  {
    id: "co_lumiere",
    name: "株式会社ルミエール",
    kind: "partner",
    contractStatus: "active",
    contractedAt: "2026-02-10T00:00:00+09:00",
  },
  {
    id: "co_aoyama",
    name: "青山ビューティーグループ",
    kind: "partner",
    contractStatus: "active",
    contractedAt: "2026-04-05T00:00:00+09:00",
  },
  {
    id: "co_kansai",
    name: "関西ヘルスケア株式会社",
    kind: "partner",
    contractStatus: "suspended",
    contractedAt: "2026-05-20T00:00:00+09:00",
  },
]

export const stores: Store[] = [
  { id: "st_lumiere_ginza", companyId: "co_lumiere", name: "ルミエール 銀座店", status: "active", openedAt: "2026-02-15T00:00:00+09:00" },
  { id: "st_lumiere_shibuya", companyId: "co_lumiere", name: "ルミエール 渋谷店", status: "active", openedAt: "2026-03-01T00:00:00+09:00" },
  { id: "st_lumiere_yokohama", companyId: "co_lumiere", name: "ルミエール 横浜店", status: "active", openedAt: "2026-05-10T00:00:00+09:00" },
  { id: "st_aoyama_main", companyId: "co_aoyama", name: "青山ビューティー 本店", status: "active", openedAt: "2026-04-10T00:00:00+09:00" },
  { id: "st_aoyama_omote", companyId: "co_aoyama", name: "青山ビューティー 表参道店", status: "active", openedAt: "2026-06-01T00:00:00+09:00" },
  { id: "st_kansai_umeda", companyId: "co_kansai", name: "関西ヘルスケア 梅田店", status: "closed", openedAt: "2026-05-25T00:00:00+09:00" },
]

/* ------------------------------------------------------------------ *
 * 管理画面アカウント (role は membership で保持する)
 * ------------------------------------------------------------------ */

export const adminAccounts: AdminAccount[] = [
  {
    id: "acc_operator",
    displayName: "宮村 健一",
    email: "operator@fitwayworld.example.jp",
    twoFactorEnabled: true,
    organizationMemberships: [
      { accountId: "acc_operator", companyId: "co_hq", role: "operator" },
    ],
    storeMemberships: [],
  },
  {
    id: "acc_company_admin",
    displayName: "高橋 由紀",
    email: "admin@lumiere.example.jp",
    twoFactorEnabled: true,
    organizationMemberships: [
      { accountId: "acc_company_admin", companyId: "co_lumiere", role: "company_admin" },
    ],
    storeMemberships: [],
  },
  {
    id: "acc_store_admin",
    displayName: "佐々木 亮",
    email: "ginza@lumiere.example.jp",
    twoFactorEnabled: true,
    organizationMemberships: [],
    // 複数店舗担当でも企業全体へは拡張しない (§4.3)
    storeMemberships: [
      { accountId: "acc_store_admin", storeId: "st_lumiere_ginza", role: "store_admin" },
      { accountId: "acc_store_admin", storeId: "st_lumiere_shibuya", role: "store_admin" },
    ],
  },
  {
    id: "acc_store_staff",
    displayName: "中島 美咲",
    email: "staff.ginza@lumiere.example.jp",
    twoFactorEnabled: false, // 任意・初期 OFF (§2)
    organizationMemberships: [],
    storeMemberships: [
      { accountId: "acc_store_staff", storeId: "st_lumiere_ginza", role: "store_staff" },
    ],
  },
]

/* ------------------------------------------------------------------ *
 * 顧客
 * ------------------------------------------------------------------ */

const FAMILY = ["田中", "佐藤", "鈴木", "高橋", "伊藤", "渡辺", "山本", "中村", "小林", "加藤"]
const GIVEN = ["美咲", "陽子", "彩", "翔太", "健一", "葵", "沙織", "直樹", "萌", "拓海"]
const AGE_BANDS = ["20代", "30代", "40代", "50代", "60代"]

const CUSTOMER_COUNT = 64

export const customers: Customer[] = Array.from({ length: CUSTOMER_COUNT }, (_, i) => {
  const n = i + 1
  // 先頭 6 名は未登録 (未連携分析のみ)。B2B に Guest プランは存在しない。
  const unregistered = i < 6
  const plan = unregistered
    ? ("guest" as const)
    : pick(["guest", "member", "member", "premium", "premium"] as const)
  return {
    dataSubjectId: `ds_${pad(n)}`,
    displayCode: `C-${pad(n, 4)}`,
    displayName: `${pick(FAMILY)} ${pick(GIVEN)}`,
    plan,
    unregistered,
    registeredAt: unregistered ? undefined : daysAgo(Math.floor(rand() * 200) + 20),
    ageBand: pick(AGE_BANDS),
  }
})

/* ------------------------------------------------------------------ *
 * 店舗連携 / 来店履歴
 *
 * 🔴 閲覧権限は store_data_links(active) + membership の両方。
 *    store_visits は来店の記録であって閲覧権限ではない (§3)。
 * 🔴 V1 は 1 顧客につき active 最大 1 件。
 * ------------------------------------------------------------------ */

const activeStores = stores.filter((s) => s.status === "active")

export const storeDataLinks: StoreDataLink[] = []
export const storeVisits: StoreVisit[] = []

customers.forEach((c, i) => {
  // 約 6 割を店舗連携あり(B2B)、残りは B2C とする。
  if (i % 5 === 4) return
  const store = activeStores[i % activeStores.length]
  // 一部は連携解除済みにして「解除後は閲覧不可・履歴は保持」を再現する。
  const revoked = i % 11 === 3
  storeDataLinks.push({
    id: `sdl_${pad(i + 1)}`,
    dataSubjectId: c.dataSubjectId,
    storeId: store.id,
    status: revoked ? "revoked" : "active",
    linkedAt: daysAgo(Math.floor(rand() * 150) + 10),
    revokedAt: revoked ? daysAgo(Math.floor(rand() * 20) + 1) : undefined,
  })
  const visitCount = 1 + Math.floor(rand() * 3)
  for (let v = 0; v < visitCount; v++) {
    storeVisits.push({
      id: `sv_${pad(i + 1)}_${v}`,
      dataSubjectId: c.dataSubjectId,
      storeId: store.id,
      visitedAt: daysAgo(Math.floor(rand() * 150) + 1),
    })
  }
})

/* ------------------------------------------------------------------ *
 * 分析セッション
 * ------------------------------------------------------------------ */

const FACE_METRICS = METRIC_CATALOG.filter((m) => m.analysisType === "face")
const POSTURE_METRICS = METRIC_CATALOG.filter((m) => m.analysisType === "posture")

/**
 * 回を重ねたときの推移を作る。
 * 全員が改善すると改善率が常に 100% になり画面の検証にならないため、
 * 人ごとに 改善 / 横ばい / 悪化 の傾向を持たせる。
 */
function personTrend(personSeed: number): number {
  const m = personSeed % 10
  if (m <= 4) return 1 // 改善 (約50%)
  if (m <= 6) return 0 // 横ばい (約20%)
  return -1 // 悪化 (約30%)
}

function metricValues(
  which: typeof FACE_METRICS,
  sessionIndex: number,
  personSeed: number
): MetricValue[] {
  const trend = personTrend(personSeed)
  return which.map((def, k) => {
    const base = 8 + ((personSeed + k) % 7)
    const drift =
      sessionIndex * (0.35 + ((personSeed + k) % 3) * 0.1) * trend
    let value: number
    switch (def.direction) {
      case "higher":
        value = base + drift + rand() * 0.8
        break
      case "lower":
        value = Math.max(0.2, base - drift + rand() * 0.6)
        break
      case "toZero":
        // 悪化傾向(drift<0)では 0 から遠ざかる
        value = Math.max(0.1, base / 2 - drift * 0.5 + rand() * 0.5)
        break
    }
    return { metricCode: def.code, value: Number(value.toFixed(2)) }
  })
}

export const analysisSessions: AnalysisSession[] = []

type RawImageStub = {
  id: string
  dataSubjectId?: DataSubjectId
  anonymousId?: string
  analysisSessionId: string
  capturedAt: string
  plan: PlanCode
  unregistered: boolean
}
const rawImageStubs: RawImageStub[] = []

const MODEL_VERSION = "face-v1.6.0"
const THRESHOLD_VERSION = "th-v1.6.0"
const AVERAGE_VERSION = "avg-2026Q2"
const ACTIVE_BASELINE_VERSION = "rb-2026.08.1"
const ACTIVE_POLICY_VERSION = "rp-2026.08.1"
const CARE_CATALOG_VERSION = "cc-2026.08.1"

customers.forEach((c, i) => {
  const link = storeDataLinks.find((l) => l.dataSubjectId === c.dataSubjectId)
  const sessionCount = c.unregistered ? 1 : 1 + Math.floor(rand() * 5)

  // 約 3 割を「離脱した顧客」にし、残りは直近まで継続しているものとする。
  // 全員の履歴が古いと今月の KPI が 0 になり、逆に全員が直近だと
  // 保持期限の deletion_queued / deleted が再現できないため、両方を混ぜる。
  const churned = i % 10 >= 7
  const recencyOffset = churned
    ? 130 + Math.floor(rand() * 90)
    : Math.floor(rand() * 40)

  for (let s = 0; s < sessionCount; s++) {
    // s = 0 が最も古い。最終回が recencyOffset 日前になる。
    const daysBack = recencyOffset + (sessionCount - 1 - s) * 30

    // 一部を failed / 再解析にして状態表示を確認できるようにする。
    const failed = !c.unregistered && i % 17 === 5 && s === sessionCount - 1
    const reanalysis = !c.unregistered && i % 13 === 7 && s === 1

    const id = `as_${pad(i + 1)}_${s}`
    const completedAt = daysAgo(daysBack)
    // 撮影から解析完了まで数分かかる想定。failed でも開始時刻は残る。
    const startedAt = new Date(
      new Date(completedAt).getTime() - (90_000 + Math.floor(rand() * 240_000))
    ).toISOString()
    const session: AnalysisSession = {
      id,
      dataSubjectId: c.dataSubjectId,
      analysisType: "face",
      status: failed ? "failed" : "completed",
      startedAt,
      completedAt: failed ? undefined : completedAt,
      storeId: link?.storeId,
      // 再解析は新規撮影を伴わない → 適格分析ではない (§5「初回」定義)
      newCapture: !reanalysis,
      quality: rand() < 0.08 ? "warn" : "ok",
      metrics: failed ? [] : metricValues(FACE_METRICS, s, i),
      versions: {
        modelVersion: MODEL_VERSION,
        thresholdVersion: THRESHOLD_VERSION,
        averageVersion: AVERAGE_VERSION,
        recommendationBaselineVersion: ACTIVE_BASELINE_VERSION,
        recommendationPolicyVersion: ACTIVE_POLICY_VERSION,
        careCatalogVersion: CARE_CATALOG_VERSION,
      },
      rawImageAssetIds: failed ? [] : [`ria_${pad(i + 1)}_${s}`],
      failureReason: failed ? "撮影画像の品質不足 (顔検出失敗)" : undefined,
      retryable: failed ? true : undefined,
    }
    analysisSessions.push(session)

    // 姿勢分析は B2B(店舗連携あり)のみ (§5)
    if (link && !failed && s % 2 === 0) {
      analysisSessions.push({
        ...session,
        id: `${id}_p`,
        analysisType: "posture",
        metrics: metricValues(POSTURE_METRICS, s, i + 3),
        rawImageAssetIds: [`ria_${pad(i + 1)}_${s}_p`],
      })
    }

    if (!failed) {
      // 期限は「最終適格分析完了日」に依存するため、全セッションを作り終えた
      // あとでまとめて計算する (§10)。ここでは素の情報だけ残す。
      rawImageStubs.push({
        id: `ria_${pad(i + 1)}_${s}`,
        dataSubjectId: c.unregistered ? undefined : c.dataSubjectId,
        anonymousId: c.unregistered ? `anon_${pad(i + 1)}` : undefined,
        analysisSessionId: id,
        capturedAt: completedAt,
        plan: c.plan,
        unregistered: c.unregistered,
      })
    }
  }
})

/**
 * 保持状態を一通り画面で確認できるようにするための追加分析。
 *
 * 通常生成では撮影日の分布に偏りがあり、期限まで残り 0〜30 日(通知予定)と
 * 期限超過直後(削除キュー)の帯にデータが入らなかったため、
 * その帯に落ちる撮影日で Guest の分析を足している。
 * state は他と同じ計算式から導出しており、直接上書きはしていない。
 */
const RETENTION_FIXTURES = [
  { daysBack: 158, suffix: "notice" }, // 180 - 158 = 残り 22 日 → 通知予定
  { daysBack: 195, suffix: "queued" }, // 180 - 195 = 15 日超過 → 削除キュー
]

customers
  .filter((c) => !c.unregistered && c.plan === "guest")
  .slice(0, RETENTION_FIXTURES.length)
  .forEach((c, k) => {
    const { daysBack, suffix } = RETENTION_FIXTURES[k]
    const id = `as_${c.dataSubjectId}_${suffix}`
    const completedAt = daysAgo(daysBack)
    analysisSessions.push({
      id,
      dataSubjectId: c.dataSubjectId,
      analysisType: "face",
      status: "completed",
      startedAt: new Date(new Date(completedAt).getTime() - 120_000).toISOString(),
      completedAt,
      storeId: undefined,
      newCapture: true,
      quality: "ok",
      metrics: metricValues(FACE_METRICS, 0, 5),
      versions: {
        modelVersion: MODEL_VERSION,
        thresholdVersion: THRESHOLD_VERSION,
        averageVersion: AVERAGE_VERSION,
        recommendationBaselineVersion: ACTIVE_BASELINE_VERSION,
        recommendationPolicyVersion: ACTIVE_POLICY_VERSION,
        careCatalogVersion: CARE_CATALOG_VERSION,
      },
      rawImageAssetIds: [`ria_${c.dataSubjectId}_${suffix}`],
    })
    rawImageStubs.push({
      id: `ria_${c.dataSubjectId}_${suffix}`,
      dataSubjectId: c.dataSubjectId,
      analysisSessionId: id,
      capturedAt: completedAt,
      plan: c.plan,
      unregistered: false,
    })
  })

/* ------------------------------------------------------------------ *
 * 生画像の保持期限 (§10)
 *
 * 🔴 登録ユーザーは「最終適格分析完了日から 2 年」で、新規撮影を伴う分析が
 *    completed するたびに過去の全画像が同じ期限へ更新される。
 *    画像ごとに撮影日から数えるのは誤り。
 * 🔴 Guest / 未連携分析はその分析の完了から 180 日で、rolling しない。
 *    通常登録＋引き継ぎで登録規則へ移行する。
 * ------------------------------------------------------------------ */

const REGISTERED_RETENTION_DAYS = 730
const SHORT_RETENTION_DAYS = 180
/** 満了何日前に通知するか。 */
const RETENTION_NOTICE_DAYS = 30

/** 本人の最終適格分析完了日 (顔・姿勢を通じた最新)。 */
const lastEligibleCompletedAt = new Map<DataSubjectId, string>()
for (const session of analysisSessions) {
  if (session.status !== "completed" || !session.newCapture || !session.completedAt) {
    continue
  }
  const prev = lastEligibleCompletedAt.get(session.dataSubjectId)
  if (!prev || session.completedAt > prev) {
    lastEligibleCompletedAt.set(session.dataSubjectId, session.completedAt)
  }
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString()
}

export const rawImageAssets: RawImageAsset[] = rawImageStubs.map((stub) => {
  const policy: RawImageAsset["policy"] = stub.unregistered
    ? "unlinked_180d"
    : stub.plan === "guest"
      ? "guest_180d"
      : "registered_2y"

  // 登録ユーザーは本人の最終適格分析が起算日。過去画像も同じ期限に揃う。
  const basis =
    policy === "registered_2y" && stub.dataSubjectId
      ? (lastEligibleCompletedAt.get(stub.dataSubjectId) ?? stub.capturedAt)
      : stub.capturedAt
  const expiresAt = addDays(
    basis,
    policy === "registered_2y" ? REGISTERED_RETENTION_DAYS : SHORT_RETENTION_DAYS
  )

  const daysLeft = (new Date(expiresAt).getTime() - NOW.getTime()) / 86_400_000
  const state: RawImageAsset["state"] =
    daysLeft < -RETENTION_NOTICE_DAYS
      ? "deleted"
      : daysLeft < 0
        ? "deletion_queued"
        : daysLeft <= RETENTION_NOTICE_DAYS
          ? "notice_scheduled"
          : "active"

  return {
    id: stub.id,
    dataSubjectId: stub.dataSubjectId,
    anonymousId: stub.anonymousId,
    analysisSessionId: stub.analysisSessionId,
    capturedAt: stub.capturedAt,
    policy,
    expiresAt,
    state,
    noticeSentAt:
      state === "notice_scheduled" ? daysAgo(1 + Math.floor(rand() * 5)) : undefined,
  }
})

// 削除失敗を 1 件混ぜ、再試行 UI を確認できるようにする。
if (rawImageAssets.length > 12) {
  rawImageAssets[11] = {
    ...rawImageAssets[11],
    state: "failed",
    failureReason: "GCS generation 削除の一部が未確認 (再試行待ち)",
  }
}

/* ------------------------------------------------------------------ *
 * 推奨 (正式推奨は Backend のみが生成する)
 * ------------------------------------------------------------------ */

const POSES = ["smile", "pucker", "jaw_open", "eye_open", "brow_furrow"] as const

export const recommendationRuns: RecommendationRun[] = analysisSessions
  .filter((s) => s.analysisType === "face" && s.status === "completed")
  .map((s, i) => {
    // 動作は同じで尺だけプランで切り替える (AI推奨 v1.2)。
    // Guest は再生できないが推奨自体は lock 表示されるため 1分枠を割り当てる。
    const plan = customers.find((c) => c.dataSubjectId === s.dataSubjectId)?.plan
    const duration = plan === "premium" ? ("3m" as const) : ("1m" as const)
    // 可動域の乖離度が大きい下位 2 動作を推奨する (AI推奨 v1.2)。左右差は使わない。
    const ranked = POSES.map((pose) => {
      const value = s.metrics.find((m) => m.metricCode === `${pose}_range`)?.value ?? 0
      const baseline = 12
      return { pose, value, baseline, deviation: Number((baseline - value).toFixed(2)) }
    })
      .sort((a, b) => b.deviation - a.deviation)
      .slice(0, 2)

    return {
      id: `rr_${pad(i + 1, 4)}`,
      analysisSessionId: s.id,
      baselineVersion: ACTIVE_BASELINE_VERSION,
      policyVersion: ACTIVE_POLICY_VERSION,
      runAt: s.completedAt ?? daysAgo(1),
      items: ranked.map((r, rank) => ({
        rank: rank + 1,
        poseCode: r.pose,
        score: r.value,
        baseline: r.baseline,
        deviation: r.deviation,
        videoCode: careSlotFor(r.pose, duration)!.videoCode,
      })),
    }
  })

export const baselineSets: RecommendationBaselineSet[] = [
  {
    version: ACTIVE_BASELINE_VERSION,
    status: "active",
    values: POSES.map((pose) => ({ poseCode: pose, baseline: 12 })),
    createdBy: "宮村 健一",
    approvedBy: "本部 品質責任者",
    createdAt: daysAgo(40),
    activatedAt: daysAgo(35),
    note: "公開前の暫定値。§16 P0: 実測 + 事業承認まで確定ではない。",
  },
  {
    version: "rb-2026.09.1",
    status: "draft",
    values: POSES.map((pose, i) => ({ poseCode: pose, baseline: 12 + (i % 2 ? 0.5 : -0.5) })),
    createdBy: "宮村 健一",
    createdAt: daysAgo(4),
    note: "8月実測の分布を反映した調整案。影響 preview 確認待ち。",
  },
  {
    version: "rb-2026.07.1",
    status: "retired",
    values: POSES.map((pose) => ({ poseCode: pose, baseline: 11.5 })),
    createdBy: "宮村 健一",
    approvedBy: "本部 品質責任者",
    createdAt: daysAgo(80),
    activatedAt: daysAgo(75),
  },
]

export const policySets: RecommendationPolicySet[] = [
  {
    version: ACTIVE_POLICY_VERSION,
    status: "active",
    tieBreak: "乖離度が同値の場合は pose_code の定義順 (smile → pucker → jaw_open → eye_open → brow_furrow)",
    missingValueHandling: "欠測の動作は推奨候補から除外し、母数に含めない",
    fallback: "候補が 2 件に満たない場合は可動域の低い順で補完する",
    createdBy: "宮村 健一",
    approvedBy: "本部 品質責任者",
    createdAt: daysAgo(40),
    activatedAt: daysAgo(35),
  },
  {
    version: "rp-2026.09.1",
    status: "approved",
    tieBreak: "乖離度が同値の場合は直近未実施の動作を優先する",
    missingValueHandling: "欠測の動作は推奨候補から除外し、母数に含めない",
    fallback: "候補が 2 件に満たない場合は可動域の低い順で補完する",
    createdBy: "宮村 健一",
    approvedBy: "本部 品質責任者",
    createdAt: daysAgo(6),
    scheduledActivateAt: daysAhead(5),
    note: "有効化予約済み。activate 前に影響 preview を再確認すること。",
  },
]

/* ------------------------------------------------------------------ *
 * care 動画 asset / assignment / playback
 * ------------------------------------------------------------------ */

export const careAssets: CareVideoAsset[] = CARE_VIDEO_SLOTS.flatMap((slot, i) => {
  const base: CareVideoAsset = {
    id: `ca_default_${slot.videoCode}`,
    videoCode: slot.videoCode,
    title:
      slot.category === "orientation"
        ? "顔トレのご案内 (本部標準)"
        : `${slot.targetLabel} ${slot.category === "3m" ? "3分" : "1分"}ケア (本部標準)`,
    provider: "FitWayWorld",
    durationSeconds: slot.category === "3m" ? 180 : slot.category === "1m" ? 60 : 90,
    rightsCleared: true,
    createdAt: daysAgo(120),
  }
  // 動作 10 枠には差し替え候補を用意する(asset 別の比較ができるように)。
  if (slot.category !== "1m" && slot.category !== "3m") return [base]
  return [
    base,
    {
      id: `ca_lumiere_${slot.videoCode}`,
      videoCode: slot.videoCode,
      title: `${slot.targetLabel} ${slot.category === "3m" ? "3分" : "1分"}ケア (ルミエール監修)`,
      provider: "株式会社ルミエール",
      durationSeconds: base.durationSeconds,
      // §16 P0: 既存動画の権利確認は本部棚卸し待ち。一部は未確認のまま。
      rightsCleared: i % 3 !== 1,
      createdAt: daysAgo(20),
    },
  ]
})

/**
 * 実際に差し替えが行われた枠と時期。
 * asset 別の実施率を比べられるよう、この日を境に playback の asset を切り替える。
 */
const SWITCHED_SLOT = "care_1m_pucker"
const SWITCHED_COMPANY = "co_lumiere"
const SWITCHED_DAYS_AGO = 210
const switchedAt = daysAgo(SWITCHED_DAYS_AGO)

const lumiereStoreIds = new Set(
  stores.filter((st) => st.companyId === SWITCHED_COMPANY).map((st) => st.id)
)

export const careAssignments: CareAssignment[] = [
  ...CARE_VIDEO_SLOTS.map((slot) => ({
    id: `asg_default_${slot.videoCode}`,
    videoCode: slot.videoCode,
    careAssetId: `ca_default_${slot.videoCode}`,
    scope: {},
    status: "active" as const,
    requestedBy: "宮村 健一",
    approvedBy: "宮村 健一",
    reason: "本部デフォルト",
    startAt: daysAgo(120),
    catalogVersion: CARE_CATALOG_VERSION,
    createdAt: daysAgo(120),
  })),
  {
    // 100 日前に実際に切り替わった差し替え(asset 別比較の対象)
    id: "asg_switched_pucker",
    videoCode: SWITCHED_SLOT,
    careAssetId: `ca_lumiere_${SWITCHED_SLOT}`,
    scope: { companyId: SWITCHED_COMPANY },
    status: "active",
    requestedBy: "高橋 由紀",
    approvedBy: "宮村 健一",
    reason: "自社セラピスト監修版へ差し替え",
    previousCareAssetId: `ca_default_${SWITCHED_SLOT}`,
    startAt: switchedAt,
    catalogVersion: CARE_CATALOG_VERSION,
    createdAt: daysAgo(SWITCHED_DAYS_AGO + 7),
  },
  {
    id: "asg_req_001",
    videoCode: "care_1m_pucker",
    careAssetId: "ca_lumiere_care_1m_pucker",
    scope: { companyId: "co_lumiere" },
    status: "pending_approval",
    requestedBy: "高橋 由紀",
    reason: "自社セラピスト監修版へ差し替えたい",
    previousCareAssetId: "ca_default_care_1m_pucker",
    catalogVersion: CARE_CATALOG_VERSION,
    createdAt: daysAgo(3),
  },
  {
    id: "asg_req_002",
    videoCode: "care_3m_eye_open",
    careAssetId: "ca_lumiere_care_3m_eye_open",
    scope: { storeId: "st_lumiere_ginza" },
    status: "scheduled",
    requestedBy: "佐々木 亮",
    approvedBy: "宮村 健一",
    reason: "銀座店限定キャンペーン",
    previousCareAssetId: "ca_default_care_3m_eye_open",
    startAt: daysAhead(2),
    endAt: daysAhead(32),
    catalogVersion: CARE_CATALOG_VERSION,
    createdAt: daysAgo(8),
  },
  {
    id: "asg_req_003",
    videoCode: "care_1m_smile",
    careAssetId: "ca_lumiere_care_1m_smile",
    scope: { companyId: "co_aoyama" },
    status: "rejected",
    requestedBy: "青山ビューティーグループ",
    approvedBy: "宮村 健一",
    reason: "権利確認が未完了のため却下",
    catalogVersion: CARE_CATALOG_VERSION,
    createdAt: daysAgo(15),
  },
]

/**
 * その時点・その店舗で公開されていた asset を返す。
 * 実装では assignment の scope と有効期間から解決する処理に置き換える。
 */
function resolveCareAssetId(
  videoCode: string,
  storeId: string | undefined,
  at: string
): string {
  const switched =
    videoCode === SWITCHED_SLOT &&
    storeId !== undefined &&
    lumiereStoreIds.has(storeId) &&
    at >= switchedAt
  return switched ? `ca_lumiere_${videoCode}` : `ca_default_${videoCode}`
}

export const carePlaybacks: CarePlayback[] = []

recommendationRuns.forEach((run, i) => {
  const session = analysisSessions.find((s) => s.id === run.analysisSessionId)
  if (!session) return
  const customer = customers.find((c) => c.dataSubjectId === session.dataSubjectId)
  // Guest は再生不可 (推奨は lock 表示 + 登録 CTA)
  if (!customer || customer.plan === "guest") return

  run.items.forEach((item, k) => {
    if (rand() < 0.35) return
    const startedAt = session.completedAt ?? daysAgo(10)
    const completed = rand() < 0.72
    carePlaybacks.push({
      id: `pb_${pad(i + 1, 4)}_${k}`,
      dataSubjectId: session.dataSubjectId,
      videoCode: item.videoCode,
      careAssetId: resolveCareAssetId(item.videoCode, session.storeId, startedAt),
      startedAt,
      completedAt: completed
        ? new Date(new Date(startedAt).getTime() + 120_000).toISOString()
        : undefined,
      storeId: session.storeId,
    })
  })
})

/* ------------------------------------------------------------------ *
 * handoff (B2B 未連携分析)
 * ------------------------------------------------------------------ */

export const handoffTokens: HandoffToken[] = customers
  .filter((c) => c.unregistered)
  .map((c, i) => {
    const issuedDaysAgo = i
    const status: HandoffToken["status"] =
      i === 0 ? "linked" : issuedDaysAgo >= 1 ? "expired" : "unlinked"
    return {
      id: `ho_${pad(i + 1)}`,
      token: `H${pad(i + 1, 2)}-${Math.floor(rand() * 900000 + 100000)}`,
      anonymousId: `anon_${pad(i + 1)}`,
      analysisSessionId: `as_${pad(i + 1)}_0`,
      storeId: activeStores[i % activeStores.length].id,
      issuedBy: "中島 美咲",
      issuedAt: daysAgo(issuedDaysAgo),
      // 発行から 1 日で失効。失効しても画像は削除しない (§9)
      expiresAt: daysAgo(issuedDaysAgo - 1),
      status,
      claimedAt: status === "linked" ? daysAgo(issuedDaysAgo) : undefined,
      claimedByDataSubjectId: status === "linked" ? c.dataSubjectId : undefined,
    }
  })

/* ------------------------------------------------------------------ *
 * 同意
 * ------------------------------------------------------------------ */

export const consentEvents: ConsentEvent[] = customers.map((c, i) => ({
  id: `cons_${pad(i + 1)}`,
  kind: "raw_image_capture",
  dataSubjectId: c.unregistered ? undefined : c.dataSubjectId,
  anonymousId: c.unregistered ? `anon_${pad(i + 1)}` : undefined,
  granted: true,
  occurredAt: daysAgo(200 - i),
}))

/* ------------------------------------------------------------------ *
 * プラン変更履歴 (営収シグナル用)
 *
 * 課金プランは Premium のみ。Guest / Member は無料のため、
 * G→M や M→G は営収に影響しない。
 * ------------------------------------------------------------------ */

export const planChangeEvents: PlanChangeEvent[] = []

/**
 * 過去 1 年ぶんの履歴を作る。期間 filter で「過去12ヶ月」を選んでも
 * 空にならないようにするため。直近ほど密になるよう分布を寄せている。
 *
 * 会員数は「現在の Premium 数」から履歴を遡って復元するので、
 * イベントは現在のプランと矛盾しないように作る:
 *   - いま Premium の人 → 期間内に「Premium になった」イベント
 *   - いま Premium でない人 → 期間内に「Premium をやめた」イベント
 */
const HISTORY_DAYS = 365

function skewedDaysBack(): number {
  // r^1.7 で直近側に寄せる(サービス成長を模す)
  return Math.floor(HISTORY_DAYS * Math.pow(rand(), 1.7))
}

customers.forEach((c, i) => {
  if (c.unregistered) return

  if (c.plan === "premium") {
    // 8 割は期間内に Premium 化。残りは期間より前から Premium だった扱い。
    if (rand() < 0.8) {
      planChangeEvents.push({
        dataSubjectId: c.dataSubjectId,
        changedAt: daysAgo(skewedDaysBack()),
        fromPlan: i % 3 === 0 ? "guest" : "member",
        toPlan: "premium",
      })
    }
  } else if (rand() < 0.4) {
    // かつて Premium だった人が期間内に離脱した
    planChangeEvents.push({
      dataSubjectId: c.dataSubjectId,
      changedAt: daysAgo(skewedDaysBack()),
      fromPlan: "premium",
      toPlan: c.plan,
    })
  }
})

planChangeEvents.sort((a, b) => a.changedAt.localeCompare(b.changedAt))

/* ------------------------------------------------------------------ *
 * 監査
 * ------------------------------------------------------------------ */

export const auditEvents: AuditEvent[] = [
  { category: "image_access", actorName: "宮村 健一", actorAccountId: "acc_operator", targetLabel: "ria_003_1", reason: "顧客からの問い合わせ対応 (品質確認)", daysBack: 0.2 },
  { category: "care_replacement", actorName: "高橋 由紀", actorAccountId: "acc_company_admin", targetLabel: "care_1m_pucker 差し替え申請", reason: "自社監修版へ差し替え", daysBack: 3 },
  { category: "baseline_change", actorName: "宮村 健一", actorAccountId: "acc_operator", targetLabel: "rb-2026.09.1 draft 作成", reason: "8月実測反映", daysBack: 4 },
  { category: "policy_change", actorName: "宮村 健一", actorAccountId: "acc_operator", targetLabel: "rp-2026.09.1 承認", reason: "tie-break 方針変更", daysBack: 6 },
  { category: "role_change", actorName: "宮村 健一", actorAccountId: "acc_operator", targetLabel: "acc_store_admin に st_lumiere_shibuya の store_admin を付与", reason: "担当店舗追加", daysBack: 9 },
  { category: "export", actorName: "高橋 由紀", actorAccountId: "acc_company_admin", targetLabel: "顧客一覧 CSV (co_lumiere)", reason: "月次レポート作成", daysBack: 11 },
  { category: "deletion", actorName: "system", actorAccountId: "acc_operator", targetLabel: "期限到達 raw image 4 件を削除キューへ", daysBack: 13 },
  { category: "rollback", actorName: "宮村 健一", actorAccountId: "acc_operator", targetLabel: "rb-2026.07.1 → rb-2026.08.1 (新 version として実行)", reason: "基準値の想定外の影響", daysBack: 35 },
  { category: "image_access", actorName: "宮村 健一", actorAccountId: "acc_operator", targetLabel: "ria_017_0", reason: "AI 誤判定調査", daysBack: 41 },
  { category: "care_replacement", actorName: "青山ビューティーグループ", actorAccountId: "acc_company_admin", targetLabel: "care_1m_smile 差し替え申請 (却下)", reason: "権利確認未完了", daysBack: 15 },
].map((e, i) => ({
  id: `au_${pad(i + 1)}`,
  category: e.category as AuditEvent["category"],
  actorAccountId: e.actorAccountId,
  actorName: e.actorName,
  targetLabel: e.targetLabel,
  reason: e.reason,
  occurredAt: daysAgo(e.daysBack),
  requestId: `req_${pad(1000 + i, 6)}`,
}))
