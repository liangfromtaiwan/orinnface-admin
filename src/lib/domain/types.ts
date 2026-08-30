/**
 * OrinnFACE 管理画面 ドメイン型定義
 *
 * 正本: orinnFACE 管理画面仕様書 v1.0 (2026-08-18)
 *       docs/spec/orinnFACE_管理画面仕様書_v1.0.pdf
 *
 * 🔴 DB 物理構造の正本は DB設計書 v1.9。ここで列名を独自に増やさない。
 * 🔴 管理画面専用のスコアを作らない (§5 同一指標原則)。
 */

/* ------------------------------------------------------------------ *
 * 1. ロール・スコープ (§2)
 * ------------------------------------------------------------------ */

/**
 * role は accounts の単一列に直書きしない。
 * organization_memberships / store_memberships で scope 付きに保持する。
 */
export type RoleCode =
  | "operator" // 本部。全会社・店舗を横断
  | "company_admin" // 契約企業管理者。所属企業とその配下の全店舗
  | "store_admin" // 店舗管理者。membership を持つ店舗のみ
  | "store_staff" // 店舗スタッフ。所属店舗の active 連携顧客のみ
  | "customer" // 顧客。管理画面の利用者ではない

export const ROLE_LABEL: Record<RoleCode, string> = {
  operator: "本部",
  company_admin: "契約企業管理者",
  store_admin: "店舗管理者",
  store_staff: "店舗スタッフ",
  customer: "顧客",
}

/** 2FA 要件 (§2)。store_staff / customer は任意・初期 OFF。 */
export const ROLE_REQUIRES_2FA: Record<RoleCode, boolean> = {
  operator: true,
  company_admin: true,
  store_admin: true,
  store_staff: false,
  customer: false,
}

export type CompanyId = string
export type StoreId = string
export type AccountId = string
/** 分析・care 側の主体 ID。identity 側の account_id とは分離する。 */
export type DataSubjectId = string

export type OrganizationMembership = {
  accountId: AccountId
  companyId: CompanyId
  role: Extract<RoleCode, "operator" | "company_admin">
}

export type StoreMembership = {
  accountId: AccountId
  storeId: StoreId
  role: Extract<RoleCode, "store_admin" | "store_staff">
}

/** 管理画面にログインしている利用者。 */
export type AdminAccount = {
  id: AccountId
  displayName: string
  email: string
  twoFactorEnabled: boolean
  organizationMemberships: OrganizationMembership[]
  storeMemberships: StoreMembership[]
}

/* ------------------------------------------------------------------ *
 * 2. 会社・店舗 (§1, §3)
 * ------------------------------------------------------------------ */

/**
 * 単店舗契約でも内部的に company と store を作る。
 * 画面表示は「店舗」に統一し、内部コードの partner をユーザー向けに出さない。
 */
export type Company = {
  id: CompanyId
  name: string
  /** internal = 本部(FitWayWorld)。partner = 契約企業。 */
  kind: "internal" | "partner"
  contractStatus: "active" | "suspended" | "terminated"
  contractedAt: string
}

export type Store = {
  id: StoreId
  companyId: CompanyId
  name: string
  status: "active" | "closed"
  openedAt: string
}

/**
 * 顧客と店舗の「閲覧可能な連携」。来店履歴 (store_visits) とは別物。
 * V1 は 1 顧客につき active 最大 1 件 (§3)。
 */
export type StoreDataLink = {
  id: string
  dataSubjectId: DataSubjectId
  storeId: StoreId
  status: "active" | "revoked"
  linkedAt: string
  revokedAt?: string
}

/** 来店履歴。閲覧権限の判定には使わない (§3)。 */
export type StoreVisit = {
  id: string
  dataSubjectId: DataSubjectId
  storeId: StoreId
  visitedAt: string
}

/* ------------------------------------------------------------------ *
 * 3. 顧客・プラン (§5)
 * ------------------------------------------------------------------ */

/** B2B に Guest プランは存在しない (§3)。 */
export type PlanCode = "guest" | "member" | "premium"

export const PLAN_LABEL: Record<PlanCode, string> = {
  guest: "Guest",
  member: "Member",
  premium: "Premium",
}

export type Customer = {
  dataSubjectId: DataSubjectId
  /** 表示名／顧客番号等の必要最小限。analytics へ PII を混入しない (§5)。 */
  displayCode: string
  displayName: string
  plan: PlanCode
  registeredAt?: string
  /** 未登録 (未連携分析のみ) の場合 true。 */
  unregistered: boolean
  ageBand?: string
}

/**
 * プラン変更の履歴。
 *
 * ℹ️ 仕様書 v1.0 §6 の KPI 一覧には含まれない。運営(本部)が B2C を含む
 *    会員構成と課金シグナルを把握するための補助指標として追加したもの。
 *    課金プランは Premium のみ (¥980/月)。Guest / Member は無料。
 */
export type PlanChangeEvent = {
  dataSubjectId: DataSubjectId
  changedAt: string
  fromPlan: PlanCode
  toPlan: PlanCode
}

/* ------------------------------------------------------------------ *
 * 4. 分析・指標 (§5)
 * ------------------------------------------------------------------ */

export type AnalysisType = "face" | "posture"

export const ANALYSIS_TYPE_LABEL: Record<AnalysisType, string> = {
  face: "表情分析",
  posture: "姿勢分析",
}

/** 5動作の pose_code。neutral(無表情) は別 pose として扱う。 */
export type PoseCode =
  | "neutral"
  | "smile"
  | "pucker"
  | "jaw_open"
  | "eye_open"
  | "brow_furrow"

export type AnalysisStatus =
  | "draft"
  | "capturing"
  | "analyzing"
  | "completed"
  | "failed"

export const ANALYSIS_STATUS_LABEL: Record<AnalysisStatus, string> = {
  draft: "下書き",
  capturing: "撮影中",
  analyzing: "解析中",
  completed: "完了",
  failed: "失敗",
}

/**
 * 1 件の測定値。metric_code はユーザー側画面と同一のものを使う。
 * 管理画面専用に同名の別スコアを作らない (§5 同一指標原則)。
 */
export type MetricValue = {
  metricCode: string
  value: number
  /** 左右差・偏位など符号に意味がある指標のみ */
  side?: "left" | "right"
}

export type AnalysisSession = {
  id: string
  dataSubjectId: DataSubjectId
  analysisType: AnalysisType
  status: AnalysisStatus
  completedAt?: string
  /** 撮影を実施した店舗。B2C は undefined。 */
  storeId?: StoreId
  /** 新規撮影を伴うか。再解析・再スコアリングは false (§5「初回」定義)。 */
  newCapture: boolean
  /** 品質判定。欠測 capture の有無。 */
  quality: "ok" | "warn" | "insufficient"
  metrics: MetricValue[]
  /** 技術情報 drawer 用 (§5)。 */
  versions: {
    modelVersion: string
    thresholdVersion: string
    averageVersion: string
    recommendationBaselineVersion?: string
    recommendationPolicyVersion?: string
    careCatalogVersion?: string
  }
  /** 生画像 asset。閲覧は理由付き一時 token 経由のみ (§11)。 */
  rawImageAssetIds: string[]
  failureReason?: string
  retryable?: boolean
}

/* ------------------------------------------------------------------ *
 * 5. 推奨 (§5, §8)
 * ------------------------------------------------------------------ */

/** 正式推奨は Backend だけが生成する。AI /v1/recommend の値は本番で使わない (§8)。 */
export type RecommendationItem = {
  rank: number
  poseCode: Exclude<PoseCode, "neutral">
  score: number
  baseline: number
  deviation: number
  videoCode: string
}

export type RecommendationRun = {
  id: string
  analysisSessionId: string
  items: RecommendationItem[]
  baselineVersion: string
  policyVersion: string
  runAt: string
}

/** draft → approved → active → retired。active の直接編集は不可 (§8, §13)。 */
export type VersionedSetStatus =
  | "draft"
  | "approved"
  | "active"
  | "retired"

export const VERSIONED_SET_STATUS_LABEL: Record<VersionedSetStatus, string> = {
  draft: "draft",
  approved: "承認済",
  active: "有効",
  retired: "退役",
}

/** 5動作の基準値 set。policy とは分離する (§8)。 */
export type RecommendationBaselineSet = {
  version: string
  status: VersionedSetStatus
  values: { poseCode: Exclude<PoseCode, "neutral">; baseline: number }[]
  createdBy: string
  approvedBy?: string
  createdAt: string
  activatedAt?: string
  scheduledActivateAt?: string
  note?: string
}

/** 順位・tie-break・欠損・fallback の方針 set (§8)。 */
export type RecommendationPolicySet = {
  version: string
  status: VersionedSetStatus
  tieBreak: string
  missingValueHandling: string
  fallback: string
  createdBy: string
  approvedBy?: string
  createdAt: string
  activatedAt?: string
  scheduledActivateAt?: string
  note?: string
}

/* ------------------------------------------------------------------ *
 * 6. care 動画 (§7)
 * ------------------------------------------------------------------ */

/** 固定 13 枠。V1 で slot を新設しない。 */
export type CareVideoSlot = {
  videoCode: string
  category: "orientation" | "1m" | "3m" | "specialist"
  /** 対象動作の表示名 (いー / うー / あー / 目 / 眉間 / リンパ / 神経) */
  targetLabel: string
  poseCode?: Exclude<PoseCode, "neutral">
  requiredPlans: PlanCode[]
}

export type CareVideoAsset = {
  id: string
  videoCode: string
  title: string
  provider: string
  durationSeconds: number
  /** 権利確認の状態。未確認の asset は公開できない。 */
  rightsCleared: boolean
  createdAt: string
}

export type CareAssignmentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "active"
  | "ended"
  | "rejected"

export const CARE_ASSIGNMENT_STATUS_LABEL: Record<
  CareAssignmentStatus,
  string
> = {
  draft: "下書き",
  pending_approval: "承認待ち",
  approved: "承認済",
  scheduled: "公開予約",
  active: "公開中",
  ended: "終了",
  rejected: "却下",
}

/**
 * 差し替えは care_asset_id だけを切り替える。
 * video_code / pose_code は変更しない (§7.1)。
 */
export type CareAssignment = {
  id: string
  videoCode: string
  careAssetId: string
  /** 適用範囲。undefined = 本部デフォルト。 */
  scope: { companyId?: CompanyId; storeId?: StoreId }
  status: CareAssignmentStatus
  requestedBy: string
  approvedBy?: string
  reason: string
  startAt?: string
  endAt?: string
  /** 差し替え前の asset。rollback と履歴表示に使う。 */
  previousCareAssetId?: string
  catalogVersion: string
  createdAt: string
}

export type CarePlayback = {
  id: string
  dataSubjectId: DataSubjectId
  videoCode: string
  careAssetId: string
  startedAt: string
  completedAt?: string
  storeId?: StoreId
}

/* ------------------------------------------------------------------ *
 * 7. B2B 未連携分析 / handoff (§9)
 * ------------------------------------------------------------------ */

export type HandoffStatus = "unlinked" | "linked" | "expired"

export const HANDOFF_STATUS_LABEL: Record<HandoffStatus, string> = {
  unlinked: "未連携",
  linked: "連携済",
  expired: "失効",
}

/**
 * QR / URL / 手入力は同一トークン。発行から 1 日で失効する。
 * 🔴 失効しても画像は削除しない (画像は分析完了から 180 日)。
 */
export type HandoffToken = {
  id: string
  token: string
  anonymousId: string
  analysisSessionId: string
  storeId: StoreId
  issuedBy: string
  issuedAt: string
  expiresAt: string
  status: HandoffStatus
  claimedAt?: string
  claimedByDataSubjectId?: DataSubjectId
}

/* ------------------------------------------------------------------ *
 * 8. 同意・画像保持 (§10)
 * ------------------------------------------------------------------ */

export type RetentionState =
  | "active"
  | "notice_scheduled"
  | "expired"
  | "deletion_queued"
  | "verifying"
  | "deleted"
  | "failed"

export const RETENTION_STATE_LABEL: Record<RetentionState, string> = {
  active: "保持中",
  notice_scheduled: "通知予定",
  expired: "期限到達",
  deletion_queued: "削除キュー",
  verifying: "不存在確認中",
  deleted: "削除済",
  failed: "失敗",
}

/**
 * registered = 最終適格分析完了日から 2 年 (rolling)
 * guest / unlinked = 分析完了から 180 日
 */
export type RetentionPolicyCode = "registered_2y" | "guest_180d" | "unlinked_180d"

export const RETENTION_POLICY_LABEL: Record<RetentionPolicyCode, string> = {
  registered_2y: "登録2年",
  guest_180d: "Guest 180日",
  unlinked_180d: "未連携 180日",
}

export type RawImageAsset = {
  id: string
  dataSubjectId?: DataSubjectId
  anonymousId?: string
  analysisSessionId: string
  capturedAt: string
  policy: RetentionPolicyCode
  expiresAt: string
  state: RetentionState
  /** 満了 30 日前の通知 (§10)。 */
  noticeSentAt?: string
  failureReason?: string
}

export type ConsentKind =
  | "raw_image_capture"
  | "long_term_retention"
  | "research_improvement"

export const CONSENT_KIND_LABEL: Record<ConsentKind, string> = {
  raw_image_capture: "撮影・保存",
  long_term_retention: "長期保存",
  research_improvement: "研究・AI品質改善",
}

export type ConsentEvent = {
  id: string
  kind: ConsentKind
  dataSubjectId?: DataSubjectId
  anonymousId?: string
  granted: boolean
  occurredAt: string
}

/* ------------------------------------------------------------------ *
 * 9. 監査 (§11)
 * ------------------------------------------------------------------ */

export type AuditCategory =
  | "role_change"
  | "image_access"
  | "export"
  | "care_replacement"
  | "baseline_change"
  | "policy_change"
  | "deletion"
  | "rollback"

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  role_change: "権限変更",
  image_access: "画像閲覧",
  export: "エクスポート",
  care_replacement: "care差し替え",
  baseline_change: "基準値変更",
  policy_change: "方針変更",
  deletion: "削除",
  rollback: "rollback",
}

export type AuditEvent = {
  id: string
  category: AuditCategory
  actorAccountId: AccountId
  actorName: string
  targetLabel: string
  /** 重い操作は理由入力必須 (§13)。 */
  reason?: string
  occurredAt: string
  requestId: string
}
