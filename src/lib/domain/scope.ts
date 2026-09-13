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
  AccountId,
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

/**
 * その企業の責任者(契約企業管理者)。
 *
 * 契約はあるのに管理者アカウントが無い状態は運用上の問題なので、
 * 呼び出し側は空配列を「未設定」として出す(黙って隠さない)。
 * ダッシュボードと会社・店舗画面で同じ結果になるよう、判定はここに 1 つだけ置く。
 */
export function companyAdminsOf(
  accounts: AdminAccount[],
  companyId: CompanyId
): AdminAccount[] {
  return accounts.filter((a) =>
    a.organizationMemberships.some(
      (m) => m.companyId === companyId && m.role === "company_admin"
    )
  )
}

/* ------------------------------------------------------------------ *
 * membership の付与・剥奪 (§2, §4.1, §4.2, §4.3)
 *
 * 🔴 誰が誰に何を付与できるかは role ごとに違う。仕様書の動詞が根拠:
 *    - §4.1 本部の「会社・店舗」の内容に **membership** が挙がっている
 *      → 契約企業管理者を指名できるのは本部だけ。
 *    - §4.2 契約企業管理者は「店舗管理者・店舗スタッフの membership を
 *      権限範囲内で**管理する**」→ 配下店舗の 2 ロールだけ付与・剥奪できる。
 *    - §4.3 店舗管理者は担当店舗の「スタッフ...を**確認する**」
 *      → 確認であって管理ではないので、付与・剥奪はできない。
 *      ⚠️ §4.2 が「管理する」、§4.3 が「確認する」と書き分けられている点を
 *         根拠にした読み。QUESTIONS_FOR_YOSHIDA.md #12 で確認中。
 * 🔴 role を単一列として書き換えるのではなく、membership 行の追加・削除として扱う。
 *    account・顧客・分析履歴・同意・保存期限は作り直さない (§2)。
 * ------------------------------------------------------------------ */

export type MembershipTarget =
  | { kind: "company"; companyId: CompanyId; role: "company_admin" }
  | { kind: "store"; storeId: StoreId; role: "store_admin" | "store_staff" }

export type MembershipEditDecision =
  | { kind: "allowed" }
  | {
      kind: "denied"
      reason:
        /** 契約企業管理者の指名は本部だけ (§4.1) */
        | "operator_only"
        /** 自分のスコープ外の店舗 */
        | "out_of_scope"
        /** §4.3 は「確認する」。店舗管理者・スタッフは付与・剥奪できない */
        | "read_only_role"
    }

export function decideMembershipEdit(
  scope: Scope,
  target: MembershipTarget
): MembershipEditDecision {
  if (scope.crossCompany) return { kind: "allowed" }

  if (scope.role !== "company_admin") {
    return { kind: "denied", reason: "read_only_role" }
  }
  // 契約企業管理者は自分と同格を増やせない。指名は本部の操作 (§4.1)
  if (target.kind === "company") {
    return { kind: "denied", reason: "operator_only" }
  }
  if (!scope.storeIds.includes(target.storeId)) {
    return { kind: "denied", reason: "out_of_scope" }
  }
  return { kind: "allowed" }
}

export function canManageMembership(
  scope: Scope,
  target: MembershipTarget
): boolean {
  return decideMembershipEdit(scope, target).kind === "allowed"
}

export const MEMBERSHIP_DENIED_LABEL: Record<
  Extract<MembershipEditDecision, { kind: "denied" }>["reason"],
  string
> = {
  operator_only: "契約企業管理者を指名できるのは本部だけです",
  out_of_scope: "権限範囲外の店舗です",
  read_only_role: "このロールは担当者を確認できますが変更はできません",
}

/** その account が target の membership を既に持っているか。 */
export function hasMembership(
  account: AdminAccount,
  target: MembershipTarget
): boolean {
  if (target.kind === "company") {
    return account.organizationMemberships.some(
      (m) => m.companyId === target.companyId && m.role === target.role
    )
  }
  return account.storeMemberships.some(
    (m) => m.storeId === target.storeId && m.role === target.role
  )
}

/**
 * 監査に残す対象表記 (§11 変更監査)。
 * seed の既存 role_change イベントと同じ書式に揃える。
 */
export function membershipAuditLabel(
  accountId: AccountId,
  target: MembershipTarget,
  action: "grant" | "revoke"
): string {
  const scopeLabel =
    target.kind === "company" ? target.companyId : target.storeId
  const verb = action === "grant" ? "付与" : "剥奪"
  return `${accountId} に ${scopeLabel} の ${target.role} を${verb}`
}

/**
 * membership 行を足す・消す。account 本体は作り直さない (§2)。
 *
 * 🔴 role を単一列として上書きしないので、同じ account が
 *    別の会社・別の店舗の membership を同時に持てる。
 * 🔴 既に持っている membership を grant しても重複行を作らない。
 */
export function applyMembershipChange(
  accounts: AdminAccount[],
  accountId: AccountId,
  target: MembershipTarget,
  action: "grant" | "revoke"
): AdminAccount[] {
  return accounts.map((a) => {
    if (a.id !== accountId) return a

    if (target.kind === "company") {
      const rest = a.organizationMemberships.filter(
        (m) => !(m.companyId === target.companyId && m.role === target.role)
      )
      return {
        ...a,
        organizationMemberships:
          action === "revoke"
            ? rest
            : [
                ...rest,
                { accountId, companyId: target.companyId, role: target.role },
              ],
      }
    }

    const rest = a.storeMemberships.filter(
      (m) => !(m.storeId === target.storeId && m.role === target.role)
    )
    return {
      ...a,
      storeMemberships:
        action === "revoke"
          ? rest
          : [...rest, { accountId, storeId: target.storeId, role: target.role }],
    }
  })
}

/**
 * 視点(どの企業を見ているか)で絞った表示用スコープ。
 *
 * 🔴 これは**表示の絞り込み**であって権限ではない。role はそのまま持ち越すので、
 *    本部が 1 社に絞っても operator の capability は失われない。
 * 🔴 絞れるのは全社横断できる本部だけ。それ以外は自分のスコープがそのまま視点になる。
 */
export function viewScopeFor(
  scope: Scope,
  viewCompanyId: CompanyId | undefined,
  stores: Store[]
): Scope {
  if (!scope.crossCompany || !viewCompanyId) return scope
  return {
    role: scope.role,
    crossCompany: false,
    companyId: viewCompanyId,
    storeIds: stores.filter((s) => s.companyId === viewCompanyId).map((s) => s.id),
  }
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
  return links.some(
    (l) =>
      l.dataSubjectId === dataSubjectId &&
      l.status === "active" &&
      scope.storeIds.includes(l.storeId)
  )
}

/**
 * その顧客を B2B 表示形式で描くか (仕様書 v1.0 §3, §5.2)。
 *
 * 🔴 姿勢分析は B2B のみ。B2C には出さない。
 * 🔴 判定は company ではなく「active な店舗連携があるか」。
 *    連携を解除したら表示は B2C 形式に戻る(データ自体は保持される)。
 */
export function usesB2bDisplay(
  dataSubjectId: DataSubjectId,
  links: StoreDataLink[]
): boolean {
  return links.some(
    (l) =>
      l.dataSubjectId === dataSubjectId && l.status === "active"
  )
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
 * 生画像の閲覧可否 (吉田さん確定 2026-09-07)
 *
 * 🔴 店舗が閲覧できるのは「**当該店舗で撮影した**顔画像のみ」。
 *    本人が自宅で撮影した画像も、他店舗で撮影した画像も表示しない。
 * 🔴 要件は「有効な店舗連携 + スタッフ権限 + 本人同意」の 3 つ。
 * 🔴 通常の店舗閲覧では**理由入力を求めない**。ただしアクセス履歴は自動保存する。
 *    (§2 の「理由入力と監査付き token」は本部の横断閲覧に対する規定)
 * ------------------------------------------------------------------ */

export type RawImageViewDecision =
  /** 押せば即発行。理由入力なし。アクセス履歴は自動保存 */
  | { kind: "direct" }
  /** 理由の入力が必要(本部の横断閲覧) */
  | { kind: "needs_reason" }
  /** 表示しない。理由つき */
  | { kind: "denied"; reason: "self_captured" | "other_store" | "no_consent" | "no_permission" }

export function decideRawImageView(
  scope: Scope,
  input: {
    /** その画像を撮影した店舗。本人が自宅で撮った場合は undefined */
    captureStoreId?: StoreId
    /** 本人が撮影・保存に同意しているか */
    hasConsent: boolean
  }
): RawImageViewDecision {
  if (!input.hasConsent) return { kind: "denied", reason: "no_consent" }

  // 本部は横断して見られるが、§2 のとおり理由入力と監査が必要
  if (scope.crossCompany) return { kind: "needs_reason" }

  if (!can(scope, "raw_image.view")) {
    return { kind: "denied", reason: "no_permission" }
  }
  if (input.captureStoreId === undefined) {
    return { kind: "denied", reason: "self_captured" }
  }
  if (!scope.storeIds.includes(input.captureStoreId)) {
    return { kind: "denied", reason: "other_store" }
  }
  // 自店で撮影した画像 → 理由入力なしで閲覧できる
  return { kind: "direct" }
}

export const RAW_IMAGE_DENIED_LABEL: Record<
  Extract<RawImageViewDecision, { kind: "denied" }>["reason"],
  string
> = {
  self_captured: "ご本人撮影・画像非表示",
  other_store: "他店舗で撮影・画像非表示",
  no_consent: "本人同意なし・画像非表示",
  no_permission: "閲覧権限なし",
}

/* ------------------------------------------------------------------ *
 * 操作権限 (§4, §8, §11)
 * ------------------------------------------------------------------ */

export type Capability =
  /** 生画像を横断して一時閲覧できる(本部。理由入力と監査が必要) */
  | "raw_image.view_token"
  /** 自店で撮影した生画像を閲覧できる(理由入力なし・履歴は自動保存) */
  | "raw_image.view"
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
  /**
   * 契約企業のブランド設定(表示名・ロゴ・メインカラー)を編集・反映できる。
   * 🔴 V1 は operator のみ。V2 で company_admin に自社分を開放する
   *    (吉田さん確定 2026-09-08)。
   */
  | "branding.manage"

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
    "branding.manage",
  ],
  // 差し替え申請はできるが、承認・公開と slot 新設はできない (§4.2)
  company_admin: ["care.request_replacement", "org.manage", "raw_image.view"],
  store_admin: ["care.request_replacement", "org.manage", "raw_image.view"],
  // B2B 撮影・分析実行・結果表示・staff note・handoff (§4.4)
  store_staff: ["session.capture", "raw_image.view"],
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
  | "branding"

export const SCREEN_LABEL: Record<ScreenKey, string> = {
  dashboard: "ダッシュボード",
  organizations: "会社・店舗",
  customers: "顧客",
  analysis: "分析",
  care: "care動画",
  recommendation: "推奨設定",
  retention: "画像・保持",
  audit: "監査",
  branding: "ブランド設定",
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
    "branding",
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
