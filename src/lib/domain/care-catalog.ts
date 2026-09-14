/**
 * care 動画 固定 13 枠 (仕様書 v1.0 §7)
 *
 * 🔴 V1 はこの 13 枠だけを実装する。slot の新設・14 番目の枠・
 *    「はじめて向け」枠を追加しない。
 * 🚫 training_videos / facial_training / is_starter / release を
 *    V1 の新規実装名に使わない。
 *
 * ユーザー向け機能名は「顔トレ」を維持し、内部総称は care video とする。
 */

import type {
  CareAssignment,
  CareVideoAsset,
  CareVideoSlot,
  CompanyId,
  PlanCode,
  PoseCode,
  StoreId,
} from "./types"
import { can, type Scope } from "./scope"

const MEMBER_UP: PlanCode[] = ["member", "premium"]
const PREMIUM_ONLY: PlanCode[] = ["premium"]

export const CARE_VIDEO_SLOTS: CareVideoSlot[] = [
  {
    videoCode: "care_orientation",
    category: "orientation",
    // 仕様書 §7 の表では 対象 は「—」(動作に紐づかない案内動画)
    targetLabel: "—",
    // §16 P1 未決: care_orientation の表示面・権限は動画仕様と Figma 待ち。
    requiredPlans: ["guest", "member", "premium"],
  },

  // 1分 (Member / Premium)
  { videoCode: "care_1m_smile", category: "1m", targetLabel: "いー", poseCode: "smile", requiredPlans: MEMBER_UP },
  { videoCode: "care_1m_pucker", category: "1m", targetLabel: "うー", poseCode: "pucker", requiredPlans: MEMBER_UP },
  { videoCode: "care_1m_jaw_open", category: "1m", targetLabel: "あー", poseCode: "jaw_open", requiredPlans: MEMBER_UP },
  { videoCode: "care_1m_eye_open", category: "1m", targetLabel: "目", poseCode: "eye_open", requiredPlans: MEMBER_UP },
  { videoCode: "care_1m_brow_furrow", category: "1m", targetLabel: "眉間", poseCode: "brow_furrow", requiredPlans: MEMBER_UP },

  // 3分 (Premium)
  { videoCode: "care_3m_smile", category: "3m", targetLabel: "いー", poseCode: "smile", requiredPlans: PREMIUM_ONLY },
  { videoCode: "care_3m_pucker", category: "3m", targetLabel: "うー", poseCode: "pucker", requiredPlans: PREMIUM_ONLY },
  { videoCode: "care_3m_jaw_open", category: "3m", targetLabel: "あー", poseCode: "jaw_open", requiredPlans: PREMIUM_ONLY },
  { videoCode: "care_3m_eye_open", category: "3m", targetLabel: "目", poseCode: "eye_open", requiredPlans: PREMIUM_ONLY },
  { videoCode: "care_3m_brow_furrow", category: "3m", targetLabel: "眉間", poseCode: "brow_furrow", requiredPlans: PREMIUM_ONLY },

  // 専門 (Premium)
  { videoCode: "lymph_care", category: "specialist", targetLabel: "リンパ", requiredPlans: PREMIUM_ONLY },
  { videoCode: "nerve_approach", category: "specialist", targetLabel: "神経", requiredPlans: PREMIUM_ONLY },
]

/**
 * 枠数が 13 から動いていないことを検証する (仕様書 v1.0 §7)。
 * `npm run smoke` から呼ばれる。slot を増減したくなったら、まず仕様書を確認すること。
 */
export function assertCareSlotInvariant(): void {
  if (CARE_VIDEO_SLOTS.length !== 13) {
    throw new Error(
      `care slot は固定 13 枠。現在 ${CARE_VIDEO_SLOTS.length} 枠 (仕様書 v1.0 §7 違反)`
    )
  }
}

export const CARE_CATEGORY_LABEL: Record<CareVideoSlot["category"], string> = {
  orientation: "案内",
  "1m": "1分",
  "3m": "3分",
  specialist: "専門",
}

/**
 * filter や見出しに出す 1 行ラベル。
 * 案内は対象動作を持たないため区分だけを返す(「案内 案内」にならないように)。
 */
export function careSlotLabel(slot: CareVideoSlot): string {
  return slot.category === "orientation"
    ? CARE_CATEGORY_LABEL[slot.category]
    : `${CARE_CATEGORY_LABEL[slot.category]} ${slot.targetLabel}`
}

const BY_CODE = new Map(CARE_VIDEO_SLOTS.map((s) => [s.videoCode, s]))

export function getCareSlot(videoCode: string): CareVideoSlot | undefined {
  return BY_CODE.get(videoCode)
}

/** 動作 → 尺 で枠を引く。プラン別は尺だけを切り替える (AI推奨 v1.2)。 */
export function careSlotFor(
  poseCode: Exclude<PoseCode, "neutral">,
  duration: "1m" | "3m"
): CareVideoSlot | undefined {
  return CARE_VIDEO_SLOTS.find(
    (s) => s.poseCode === poseCode && s.category === duration
  )
}

/* ------------------------------------------------------------------ *
 * 会員権限 (§7.2)
 * ------------------------------------------------------------------ */

export type CareEntitlement = {
  /** 再生できるか。Guest は不可。 */
  canPlay: boolean
  /** Guest は推奨 2 件を lock 表示 + 登録 CTA。非表示にはしない。 */
  showLockedWithCta: boolean
  /** JST 暦月あたりの上限。null = 商品上無制限。 */
  monthlyLimit: number | null
  durations: ("1m" | "3m")[]
  specialist: boolean
}

/* ------------------------------------------------------------------ *
 * 店舗提供動画と標準動画の権限は別軸 (吉田さん確定 2026-09-07)
 *
 * 🔴 連携ユーザーは本人の B2C プランに関係なく、その店舗が提供する
 *    承認済み care 動画を再生できる(月額2万円の「care込み」は店舗側の B2B 契約)。
 * 🔴 orinnFACE 標準動画は、従来どおり本人の Guest / Member / Premium 権限で判定する。
 *
 * つまり「連携済みだから全部 Premium 相当」ではない。
 * 判定は「その枠に店舗提供の asset が入っているか」で分岐する。
 * ------------------------------------------------------------------ */

/** その枠が誰の提供か。 */
export type SlotProvider = "standard" | "store"

/**
 * その顧客がその枠を再生できるか。
 *
 * @param provider その枠で公開されている asset の提供元
 * @param plan     本人の契約プラン(実効プランではない)
 * @param linked   active な店舗連携があるか
 */
export function canPlaySlot(
  slot: CareVideoSlot,
  provider: SlotProvider,
  plan: PlanCode,
  linked: boolean
): boolean {
  // 店舗提供動画は連携中ならプランを問わない
  if (provider === "store") return linked
  // 標準動画は従来どおり本人のプランで判定する
  return planCanUseSlot(plan, slot) && careEntitlement(plan).canPlay
}

export function careEntitlement(plan: PlanCode): CareEntitlement {
  switch (plan) {
    case "guest":
      return {
        canPlay: false,
        showLockedWithCta: true,
        monthlyLimit: 0,
        durations: [],
        specialist: false,
      }
    case "member":
      return {
        canPlay: true,
        showLockedWithCta: false,
        monthlyLimit: 10,
        durations: ["1m"],
        specialist: false,
      }
    case "premium":
      return {
        canPlay: true,
        showLockedWithCta: false,
        monthlyLimit: null,
        durations: ["1m", "3m"],
        specialist: true,
      }
  }
}

export function planCanUseSlot(plan: PlanCode, slot: CareVideoSlot): boolean {
  return slot.requiredPlans.includes(plan)
}

/* ------------------------------------------------------------------ *
 * 公開中の assignment の解決
 * ------------------------------------------------------------------ */

/**
 * その顧客・その枠で「いま公開されている」assignment を返す。
 *
 * 🔴 同じ枠に店舗動画と標準動画を重複表示しない(吉田さん確定 2026-09-07)。
 *    店舗 > 会社 > 本部デフォルト の順に、より狭い scope を優先して 1 件だけ選ぶ。
 * 🔴 本部承認前(pending_approval / draft / rejected)の asset は公開しない。
 */
export function resolveAssignment(
  assignments: CareAssignment[],
  videoCode: string,
  target: { storeId?: StoreId; companyId?: CompanyId },
  atIso: string
): CareAssignment | undefined {
  const usable = assignments.filter((a) => {
    if (a.videoCode !== videoCode) return false
    if (a.status !== "active") return false
    if (a.startAt && a.startAt > atIso) return false
    if (a.endAt && a.endAt < atIso) return false
    if (a.scope.storeId) return a.scope.storeId === target.storeId
    if (a.scope.companyId) return a.scope.companyId === target.companyId
    return true // 本部デフォルト
  })
  // 狭い scope を優先
  return (
    usable.find((a) => a.scope.storeId) ??
    usable.find((a) => a.scope.companyId) ??
    usable.find((a) => !a.scope.storeId && !a.scope.companyId)
  )
}

/** その assignment が店舗提供か(本部デフォルト以外か)。 */
export function providerOf(assignment: CareAssignment | undefined): SlotProvider {
  if (!assignment) return "standard"
  return assignment.scope.storeId || assignment.scope.companyId ? "store" : "standard"
}


/* ------------------------------------------------------------------ *
 * 差し替えの進め方 (§7.1)
 *
 * 🔴 申請するのは「契約企業・店舗」で、本部はそれを承認する側。
 *    本部に「差し替え申請」を出させると、自分で出して自分で承認する
 *    意味のない往復になる。本部は本部デフォルトを直接差し替える。
 * 🔴 本部が直接差し替えても履歴は同じように残す。元 asset・実行者・理由・
 *    開始終了・catalog version を保持する (§7.1)。
 * ------------------------------------------------------------------ */

export type CareReplacementDecision =
  /** 本部。承認者自身なので申請を挟まず直接切り替える */
  | { kind: "direct" }
  /** 契約企業・店舗。本部承認が要る */
  | { kind: "request" }
  | { kind: "denied" }

export function decideCareReplacement(scope: Scope): CareReplacementDecision {
  if (can(scope, "care.approve")) return { kind: "direct" }
  if (can(scope, "care.request_replacement")) return { kind: "request" }
  return { kind: "denied" }
}

/**
 * 本部デフォルトの asset を直接切り替える。
 *
 * 🔴 切り替えるのは care_asset_id だけ。video_code / pose_code は変えない (§7.1)。
 * 🔴 同じ枠に有効な本部デフォルトを 2 件作らない (§13「重複有効を publish 前に拒否」)。
 *    既存の active は ended にしてから新しい active を足す。
 * 🔴 過去の assignment は消さずに残す。rollback と履歴表示の根拠になる。
 */
export function applyDirectReplacement(
  assignments: CareAssignment[],
  input: {
    videoCode: string
    careAssetId: string
    actorName: string
    reason: string
    now: string
    catalogVersion: string
  }
): CareAssignment[] {
  assertKnownVideoCode(input.videoCode)

  const isDefaultFor = (a: CareAssignment) =>
    a.videoCode === input.videoCode && !a.scope.companyId && !a.scope.storeId

  const current = assignments.find((a) => isDefaultFor(a) && a.status === "active")

  const ended = assignments.map((a) =>
    a === current ? { ...a, status: "ended" as const, endAt: input.now } : a
  )

  return [
    ...ended,
    {
      id: `cas_direct_${input.videoCode}_${input.now}`,
      videoCode: input.videoCode,
      careAssetId: input.careAssetId,
      // 本部デフォルトなので scope は空
      scope: {},
      status: "active",
      requestedBy: input.actorName,
      // 本部が自分で切り替えるので、実行者がそのまま承認者
      approvedBy: input.actorName,
      reason: input.reason,
      startAt: input.now,
      previousCareAssetId: current?.careAssetId,
      catalogVersion: input.catalogVersion,
      createdAt: input.now,
    },
  ]
}

/**
 * 既存の枠に動画(asset)を追加する。
 *
 * 🔴 追加できるのは **asset だけ**。枠(slot)は増やせない。
 *    V1 に POST /admin/v1/care-video-slots は存在せず、14 番目の枠も
 *    「はじめて向け」枠も作らない (§7, §12)。
 *    未知の video_code が来たら、その場で落として気付けるようにする。
 * 🔴 権利確認は本部の棚卸し (§7.1, §16 P0)。本部以外が登録した asset は
 *    必ず未確認から始まり、未確認のままでは公開できない。
 */
export function addCareAsset(
  assets: CareVideoAsset[],
  input: {
    videoCode: string
    title: string
    provider: string
    durationSeconds: number
    rightsCleared: boolean
    /** アップロードされた動画ファイル名。保存は backend の担当。 */
    sourceFileName?: string
    now: string
  }
): CareVideoAsset[] {
  assertKnownVideoCode(input.videoCode)

  return [
    ...assets,
    {
      id: careAssetIdFor(input.videoCode, input.now),
      videoCode: input.videoCode,
      title: input.title,
      provider: input.provider,
      durationSeconds: input.durationSeconds,
      rightsCleared: input.rightsCleared,
      createdAt: input.now,
      sourceFileName: input.sourceFileName,
    },
  ]
}

/**
 * 追加する asset の id。
 * 追加してすぐ差し替えたいときに呼び出し側でも同じ id を組み立てられるよう、
 * 生成規則をここに 1 つだけ置く。
 */
export function careAssetIdFor(videoCode: string, now: string): string {
  return `ca_added_${videoCode}_${now}`
}

/** 🔴 固定 13 枠の外に asset や assignment を作らせない (§7)。 */
export function assertKnownVideoCode(videoCode: string): void {
  if (!CARE_VIDEO_SLOTS.some((s) => s.videoCode === videoCode)) {
    throw new Error(
      `未知の video_code: ${videoCode}。V1 は固定 13 枠のみで、slot は新設できない (仕様書 v1.0 §7, §12)`
    )
  }
}


/* ------------------------------------------------------------------ *
 * 登録済み動画の使われ方 (§7.1)
 *
 * 🔴 本部は提供者・内容・権利・承認状態・公開期間・対象 scope を確認する。
 *    確認するには一覧で見えないといけないので、1 本ごとの状態をここで決める。
 * ------------------------------------------------------------------ */

export type CareAssetUsage =
  /** どこかの枠で公開されている */
  | { kind: "published"; scope: SlotProvider | "company" }
  /** 承認済みで公開待ち */
  | { kind: "scheduled" }
  /** 差し替え申請の対象になっている */
  | { kind: "requested" }
  /** 登録だけされていて、今はどの枠にも出ていない */
  | { kind: "unused" }

export const CARE_ASSET_USAGE_LABEL: Record<CareAssetUsage["kind"], string> = {
  published: "公開中",
  scheduled: "公開予定",
  requested: "申請中",
  unused: "未使用",
}

export function careAssetUsage(
  assignments: CareAssignment[],
  careAssetId: string
): CareAssetUsage {
  const mine = assignments.filter((a) => a.careAssetId === careAssetId)

  const active = mine.find((a) => a.status === "active")
  if (active) {
    return {
      kind: "published",
      scope: active.scope.storeId
        ? "store"
        : active.scope.companyId
          ? "company"
          : "standard",
    }
  }
  if (mine.some((a) => a.status === "scheduled" || a.status === "approved")) {
    return { kind: "scheduled" }
  }
  if (mine.some((a) => a.status === "pending_approval")) {
    return { kind: "requested" }
  }
  // ended / rejected / draft しか無い、または一度も使われていない
  return { kind: "unused" }
}

/** 公開されている場合の適用範囲の表示。 */
export const CARE_ASSET_SCOPE_LABEL: Record<
  Extract<CareAssetUsage, { kind: "published" }>["scope"],
  string
> = {
  standard: "本部デフォルト",
  company: "会社全体",
  store: "店舗限定",
}
