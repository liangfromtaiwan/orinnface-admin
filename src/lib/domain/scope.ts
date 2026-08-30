/**
 * ロール・スコープ判定 (仕様書 v1.0 §2, §3)
 *
 * 🔴 Frontend の表示非表示だけを権限制御にしない。
 *    ここで組み立てた scope は API query にも必ず渡し、
 *    Backend 側で membership / store_data_link / 対象 scope を再検証する。
 *    この module は「画面に何を出すか」を決めるためのものであって、
 *    これ単体をアクセス制御の根拠にはしない。
 */

import type {
  AdminAccount,
  CompanyId,
  DataSubjectId,
  RoleCode,
  Store,
  StoreDataLink,
  StoreId,
} from "./types"

/** 管理画面での実効スコープ。 */
export type Scope = {
  role: RoleCode
  /** operator は true。全会社・全店舗を横断できる。 */
  crossCompany: boolean
  /** company_admin が担当する企業。operator は undefined。 */
  companyId?: CompanyId
  /** 閲覧できる店舗 ID。crossCompany の場合は空配列 (全件許可を意味する)。 */
  storeIds: StoreId[]
}

/**
 * account が持つ membership から実効スコープを決める。
 * 上位ロールを優先し、role を単一列として扱わない。
 */
export function resolveScope(
  account: AdminAccount,
  stores: Store[],
  /** 複数の membership を持つ場合に、どれで見るかを明示的に選ぶ。 */
  preferred?: { role: RoleCode; companyId?: CompanyId; storeId?: StoreId }
): Scope {
  const orgs = account.organizationMemberships
  const storeMemberships = account.storeMemberships

  const operator = orgs.find((m) => m.role === "operator")
  if (operator && (!preferred || preferred.role === "operator")) {
    return { role: "operator", crossCompany: true, storeIds: [] }
  }

  const companyAdmin = orgs.find(
    (m) =>
      m.role === "company_admin" &&
      (!preferred?.companyId || m.companyId === preferred.companyId)
  )
  if (companyAdmin && (!preferred || preferred.role === "company_admin")) {
    return {
      role: "company_admin",
      crossCompany: false,
      companyId: companyAdmin.companyId,
      // 所属企業とその配下の全店舗を横断する (§4.2)
      storeIds: stores
        .filter((s) => s.companyId === companyAdmin.companyId)
        .map((s) => s.id),
    }
  }

  const storeAdminIds = storeMemberships
    .filter((m) => m.role === "store_admin")
    .map((m) => m.storeId)
  if (storeAdminIds.length > 0 && (!preferred || preferred.role === "store_admin")) {
    // 複数店舗担当でも所属企業全体へ権限を自動拡張しない (§4.3)
    return { role: "store_admin", crossCompany: false, storeIds: storeAdminIds }
  }

  const staffIds = storeMemberships
    .filter((m) => m.role === "store_staff")
    .map((m) => m.storeId)
  if (staffIds.length > 0) {
    return { role: "store_staff", crossCompany: false, storeIds: staffIds }
  }

  // どの membership も持たない場合は何も見えない。
  return { role: "customer", crossCompany: false, storeIds: [] }
}

export function canSeeStore(scope: Scope, storeId: StoreId): boolean {
  return scope.crossCompany || scope.storeIds.includes(storeId)
}

/**
 * 顧客を閲覧できるか。
 *
 * 🔴 store_staff / store_admin は「active な store_data_link」と
 *    「その店舗の membership」の両方が必要 (§3)。
 *    来店履歴 (store_visits) は閲覧権限の判定に使わない。
 * 🔴 連携解除後は店舗から即時閲覧不可。本人の履歴自体は保持される。
 */
export function canViewCustomer(
  scope: Scope,
  dataSubjectId: DataSubjectId,
  links: StoreDataLink[]
): boolean {
  if (scope.crossCompany) return true
  const activeLinks = links.filter(
    (l) => l.dataSubjectId === dataSubjectId && l.status === "active"
  )
  return activeLinks.some((l) => scope.storeIds.includes(l.storeId))
}

export function visibleCustomerIds(
  scope: Scope,
  allIds: DataSubjectId[],
  links: StoreDataLink[]
): DataSubjectId[] {
  if (scope.crossCompany) return allIds
  return allIds.filter((id) => canViewCustomer(scope, id, links))
}

/* ------------------------------------------------------------------ *
 * 操作権限 (§4, §8, §11)
 * ------------------------------------------------------------------ */

export type Capability =
  /** 生画像の理由付き一時閲覧 token を発行できる */
  | "raw_image.view_token"
  /** care 差し替えを申請できる */
  | "care.request_replacement"
  /** care 差し替えを承認・公開できる */
  | "care.approve"
  /** 推奨基準値・方針の draft を作れる */
  | "recommendation.draft"
  /** 推奨基準値・方針を承認・有効化・rollback できる */
  | "recommendation.approve"
  /** 監査ログを横断検索できる */
  | "audit.search"
  /** 会社・店舗と membership を管理できる */
  | "org.manage"
  /** B2B 撮影・分析実行・handoff 発行 */
  | "session.capture"
  /** 保持・削除の運用操作 */
  | "retention.operate"

const CAPABILITIES: Record<RoleCode, Capability[]> = {
  operator: [
    "raw_image.view_token",
    "care.request_replacement",
    "care.approve",
    "recommendation.draft",
    "recommendation.approve",
    "audit.search",
    "org.manage",
    "retention.operate",
  ],
  // 差し替え申請はできるが、承認・公開と slot 新設はできない (§4.2)
  company_admin: ["care.request_replacement", "org.manage"],
  store_admin: ["care.request_replacement", "org.manage"],
  // B2B 撮影・分析実行・結果表示・staff note・handoff (§4.4)
  store_staff: ["session.capture"],
  customer: [],
}

export function can(scope: Scope, capability: Capability): boolean {
  return CAPABILITIES[scope.role].includes(capability)
}

/**
 * 生画像を一覧に出してよいか。
 * 🔴 operator を含め、常に false。閲覧は理由入力 + 監査付きの
 *    署名 URL 300 秒を別操作で発行する (§2, §11)。
 */
export const RAW_IMAGE_INLINE_DISPLAY = false

/* ------------------------------------------------------------------ *
 * 画面メニュー (§4)
 * ------------------------------------------------------------------ */

export type ScreenKey =
  | "dashboard"
  | "organizations"
  | "customers"
  | "analysis"
  | "care"
  | "recommendation"
  | "retention"
  | "audit"

export const SCREEN_LABEL: Record<ScreenKey, string> = {
  dashboard: "ダッシュボード",
  organizations: "会社・店舗",
  customers: "顧客",
  analysis: "分析",
  care: "care動画",
  recommendation: "推奨設定",
  retention: "画像・保持",
  audit: "監査",
}

const SCREENS_BY_ROLE: Record<RoleCode, ScreenKey[]> = {
  operator: [
    "dashboard",
    "organizations",
    "customers",
    "analysis",
    "care",
    "recommendation",
    "retention",
    "audit",
  ],
  company_admin: ["dashboard", "organizations", "customers", "analysis", "care"],
  store_admin: ["dashboard", "organizations", "customers", "analysis", "care"],
  // スタッフは所属店舗の active 連携顧客の撮影・結果表示が主 (§4.4)
  store_staff: ["customers", "analysis"],
  customer: [],
}

export function visibleScreens(scope: Scope): ScreenKey[] {
  return SCREENS_BY_ROLE[scope.role]
}

export function canAccessScreen(scope: Scope, screen: ScreenKey): boolean {
  return SCREENS_BY_ROLE[scope.role].includes(screen)
}
