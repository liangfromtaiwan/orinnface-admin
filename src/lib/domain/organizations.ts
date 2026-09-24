/**
 * 企業・店舗の作成と編集 (吉田さん確定 2026-09-24)
 *
 * > 企業・店舗は、V1では本部が管理画面から追加します。
 *
 * 🔴 作成・編集できるのは**本部だけ**。契約企業管理者・店舗管理者はできない。
 *    スタッフの招待は別（そちらは企業管理者・店舗管理者が権限範囲内で行う）。
 * 🔴 単店舗契約でも内部的に企業と店舗を作る (§2)。企業なしの店舗は作らせない。
 * 🔴 解約・一時停止は**消すのではなく状態を変える**。顧客・分析履歴・同意・保存期限を
 *    作り直さないため (§2)。
 */

import { can, type Scope } from "./scope"
import type { Company, CompanyId, Store, StoreId } from "./types"

export type OrgDenial =
  /** 本部以外。 */
  | "not_operator"
  /** その項目を直せる権限が無い。 */
  | "not_allowed"
  /** 名前が空。 */
  | "empty_name"
  /** 同じ名前がすでにある。 */
  | "duplicate_name"

export const ORG_DENIAL_LABEL: Record<OrgDenial, string> = {
  not_operator: "企業・店舗を追加できるのは本部だけです。",
  not_allowed: "この項目を変更できるのは本部だけです。",
  empty_name: "名前を入力してください。",
  duplicate_name: "同じ名前がすでに登録されています。",
}

export type OrgDecision = { kind: "allowed" } | { kind: "denied"; reason: OrgDenial }

/** 本部かどうかだけを見る。名前の検査は decideCreate... 側。 */
export function canEditOrganizations(scope: Scope): boolean {
  return can(scope, "org.manage") && scope.crossCompany
}

/* ------------------------------------------------------------------ *
 * 既存の企業・店舗を直せる範囲
 *
 * 🔴 **企業名・店舗名・契約状態・店舗の開閉は本部だけ**(使用者確定 2026-09-24)。
 *    店舗名は契約書上の名称なので、契約企業側から変えられるようにしない。
 *    課金と撮影可否にも直結する。
 * 🔴 契約企業管理者・店舗管理者にできるのは**担当者の追加・解除だけ**。
 *    可否はここでは判定しない。`decideMembershipEdit()` が正本
 *    (契約企業管理者の指名は本部のみ / 店舗管理者はスタッフのみ)。
 * ------------------------------------------------------------------ */

export type OrgEditRights = {
  /** 名前を直せるか。 */
  name: boolean
  /** 契約状態 / 営業状態を変えられるか。 */
  status: boolean
}

/** 本部だけが直せる項目にこの注記を添える。 */
export const ORG_READONLY_NOTE = "契約に関わるため、本部だけが変更できます。"

export function companyEditRights(scope: Scope): OrgEditRights {
  const hq = canEditOrganizations(scope)
  return { name: hq, status: hq }
}

export function storeEditRights(scope: Scope): OrgEditRights {
  const hq = canEditOrganizations(scope)
  return { name: hq, status: hq }
}

/** 既存企業の改称。追加とは別に判定する(本部以外にも開ける余地があるため)。 */
export function decideRenameCompany(
  scope: Scope,
  companies: Company[],
  company: Company,
  name: string
): OrgDecision {
  if (!companyEditRights(scope).name) {
    return { kind: "denied", reason: "not_allowed" }
  }
  return checkName(name, companies.filter((c) => c.id !== company.id).map((c) => c.name))
}

/** 既存店舗の改称。店舗名は企業をまたげば重複してよい。 */
export function decideRenameStore(
  scope: Scope,
  stores: Store[],
  store: Store,
  name: string
): OrgDecision {
  if (!storeEditRights(scope).name) {
    return { kind: "denied", reason: "not_allowed" }
  }
  return checkName(
    name,
    stores
      .filter((s) => s.id !== store.id && s.companyId === store.companyId)
      .map((s) => s.name)
  )
}

function checkName(name: string, taken: string[]): OrgDecision {
  const trimmed = name.trim()
  if (!trimmed) return { kind: "denied", reason: "empty_name" }
  if (taken.some((t) => t.trim() === trimmed)) {
    return { kind: "denied", reason: "duplicate_name" }
  }
  return { kind: "allowed" }
}

export function decideCreateCompany(
  scope: Scope,
  companies: Company[],
  name: string,
  /** 編集時は自分自身を重複判定から外す。 */
  selfId?: CompanyId
): OrgDecision {
  if (!canEditOrganizations(scope)) {
    return { kind: "denied", reason: "not_operator" }
  }
  const trimmed = name.trim()
  if (!trimmed) return { kind: "denied", reason: "empty_name" }
  if (companies.some((c) => c.id !== selfId && c.name.trim() === trimmed)) {
    return { kind: "denied", reason: "duplicate_name" }
  }
  return { kind: "allowed" }
}

export function decideCreateStore(
  scope: Scope,
  stores: Store[],
  companyId: CompanyId,
  name: string,
  selfId?: StoreId
): OrgDecision {
  if (!canEditOrganizations(scope)) {
    return { kind: "denied", reason: "not_operator" }
  }
  const trimmed = name.trim()
  if (!trimmed) return { kind: "denied", reason: "empty_name" }
  // 店舗名は企業をまたげば重複してよい(「〇〇店」は各社にありうる)
  const dup = stores.some(
    (s) => s.id !== selfId && s.companyId === companyId && s.name.trim() === trimmed
  )
  return dup ? { kind: "denied", reason: "duplicate_name" } : { kind: "allowed" }
}

/** `co_xxxx`。既存と衝突しない連番。 */
export function nextCompanyId(companies: Company[]): CompanyId {
  let n = companies.length + 1
  while (companies.some((c) => c.id === `co_new${n}`)) n += 1
  return `co_new${n}`
}

export function nextStoreId(companyId: CompanyId, stores: Store[]): StoreId {
  let n = stores.filter((s) => s.companyId === companyId).length + 1
  while (stores.some((s) => s.id === `${companyId}_st${n}`)) n += 1
  return `${companyId}_st${n}`
}

export function applyCreateCompany(
  companies: Company[],
  input: { id: CompanyId; name: string; contractStatus: Company["contractStatus"] },
  now: string
): Company[] {
  return [
    ...companies,
    {
      id: input.id,
      name: input.name.trim(),
      // 管理画面から作れるのは契約企業だけ。本部(internal)は増やさない
      kind: "partner",
      contractStatus: input.contractStatus,
      contractedAt: now,
    },
  ]
}

export function applyUpdateCompany(
  companies: Company[],
  companyId: CompanyId,
  patch: { name?: string; contractStatus?: Company["contractStatus"] }
): Company[] {
  return companies.map((c) =>
    c.id === companyId
      ? {
          ...c,
          name: patch.name?.trim() || c.name,
          contractStatus: patch.contractStatus ?? c.contractStatus,
        }
      : c
  )
}

export function applyCreateStore(
  stores: Store[],
  input: {
    id: StoreId
    companyId: CompanyId
    name: string
    status: Store["status"]
  },
  now: string
): Store[] {
  return [
    ...stores,
    {
      id: input.id,
      companyId: input.companyId,
      name: input.name.trim(),
      status: input.status,
      openedAt: now,
    },
  ]
}

export function applyUpdateStore(
  stores: Store[],
  storeId: StoreId,
  patch: { name?: string; status?: Store["status"] }
): Store[] {
  return stores.map((s) =>
    s.id === storeId
      ? {
          ...s,
          name: patch.name?.trim() || s.name,
          status: patch.status ?? s.status,
        }
      : s
  )
}

/**
 * 企業を解約・停止すると、その配下の店舗も合わせて止める。
 * 🔴 店舗だけが動いたまま残ると、契約が切れているのに撮影できる状態になる。
 */
export function applyCompanyStatusToStores(
  stores: Store[],
  companyId: CompanyId,
  contractStatus: Company["contractStatus"]
): Store[] {
  if (contractStatus === "active") return stores
  return stores.map((s) =>
    s.companyId === companyId ? { ...s, status: "closed" as const } : s
  )
}
