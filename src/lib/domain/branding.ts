/**
 * 契約企業ごとのオリジナル UI (吉田さん確定 2026-09-08)
 *
 * 変更できるのは ブランド表示名 / ロゴ / メインカラー の 3 項目。
 * V1 は運営本部(operator)が管理画面から設定し、V2 で契約企業管理者
 * (company_admin)が自社分を設定できるようにする。
 *
 * 🔴 設定単位は**企業**。配下店舗へ共通適用する。店舗ごとの上書きは持たない。
 * 🔴 B2C 画面は従来どおり orinnFACE ブランド。企業設定を適用しない。
 *    → surface を必ず受け取る resolveBranding() 以外で applied を読ませない。
 * 🔴 draft は「反映」するまで店舗側に出さない。resolve は applied しか見ない。
 */

import type { Scope } from "./scope"
import type { AccountId, CompanyId, Store } from "./types"

export type Branding = {
  /** ブランド表示名。ロゴ未設定時はこの文字を出す */
  displayName: string
  /** ロゴ画像。V1 の管理画面では preview のみ、保存先は backend 実装時に差し替える */
  logoUrl?: string
  /** メインカラー。#RRGGBB */
  mainColor: string
}

export const STANDARD_BRANDING: Branding = {
  displayName: "orinnFACE",
  mainColor: "#7CB518",
}

/**
 * 企業ごとの設定。
 * applied と draft を分けて持ち、反映するまで applied を書き換えない。
 */
export type CompanyBranding = {
  companyId: CompanyId
  /** 反映済み。undefined = 標準表示(orinnFACE) */
  applied?: Branding
  /** 編集中。反映するまで店舗には出ない */
  draft?: Branding
  appliedAt?: string
  appliedBy?: AccountId
}

/**
 * ブランドを適用する画面。
 * 🔴 b2c_app は企業設定を受けない。ここを分岐で持たせるために surface を必須にしている。
 */
export type BrandingSurface =
  /** 管理画面(契約企業・店舗が見る画面) */
  | "admin"
  /** 店舗で顧客に見せる B2B 結果画面 */
  | "b2b_result"
  /** 本人が使う B2C アプリ。常に orinnFACE */
  | "b2c_app"

export const SURFACE_LABEL: Record<BrandingSurface, string> = {
  admin: "管理画面",
  b2b_result: "B2B 結果画面",
  b2c_app: "B2C アプリ",
}

/**
 * その画面に出すブランドを決める。
 *
 * companyId を渡しても surface が b2c_app なら必ず標準ブランドを返す。
 * 反映前の draft はここでは一切参照しない(preview は previewBranding を使う)。
 */
export function resolveBranding(
  surface: BrandingSurface,
  companyId: CompanyId | undefined,
  brandings: CompanyBranding[]
): Branding {
  if (surface === "b2c_app") return STANDARD_BRANDING
  if (!companyId) return STANDARD_BRANDING
  const found = brandings.find((b) => b.companyId === companyId)
  return found?.applied ?? STANDARD_BRANDING
}

/**
 * ログイン中のアカウントに、どの企業のブランドを出すかを決める。
 *
 * 🔴 scope が companyId を持つのは company_admin だけ。店舗管理者・店舗スタッフは
 *    storeIds しか持たないため、店舗から企業を引き直す必要がある。
 *    これを忘れると店舗側が標準表示のままになる。
 * 🔴 本部(operator)は特定の企業に属さないので常に標準表示(orinnFACE)。
 * 🔴 担当店舗が複数企業にまたがる場合はどちらのブランドか決まらないため標準表示に倒す。
 */
export function brandingCompanyIdFor(
  scope: Scope,
  stores: Store[]
): CompanyId | undefined {
  if (scope.crossCompany) return undefined
  if (scope.companyId) return scope.companyId

  const companyIds = new Set(
    scope.storeIds
      .map((id) => stores.find((s) => s.id === id)?.companyId)
      .filter((id): id is CompanyId => !!id)
  )
  return companyIds.size === 1 ? [...companyIds][0] : undefined
}

/** 編集画面の preview 用。draft があれば draft、なければ反映済み、なければ標準。 */
export function previewBranding(entry: CompanyBranding | undefined): Branding {
  return entry?.draft ?? entry?.applied ?? STANDARD_BRANDING
}

/** 標準表示のままか(= 反映済み設定を持たない)。 */
export function isStandard(entry: CompanyBranding | undefined): boolean {
  return !entry?.applied
}

/** 反映していない編集内容が残っているか。 */
export function hasUnappliedDraft(entry: CompanyBranding | undefined): boolean {
  if (!entry?.draft) return false
  const a = entry.applied ?? STANDARD_BRANDING
  return (
    entry.draft.displayName !== a.displayName ||
    entry.draft.mainColor !== a.mainColor ||
    (entry.draft.logoUrl ?? "") !== (a.logoUrl ?? "")
  )
}

/* ------------------------------------------------------------------ *
 * 入力チェック
 *
 * メインカラーはボタンの背景に使うため、載せる文字が読めるかまで見る。
 * 淡い色を選ぶと白文字が読めなくなるので、その場合は黒文字に切り替える。
 * ------------------------------------------------------------------ */

export const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

/** WCAG の相対輝度。 */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** 2 色のコントラスト比 (1〜21)。 */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)]
  const [hi, lo] = x > y ? [x, y] : [y, x]
  return (hi + 0.05) / (lo + 0.05)
}

/** メインカラーの上に載せる文字色。白が読めなければ黒にする。 */
export function readableTextOn(mainColor: string): "#ffffff" | "#111111" {
  return contrastRatio(mainColor, "#ffffff") >= 4.5 ? "#ffffff" : "#111111"
}

export type BrandingIssue = { field: "displayName" | "logoUrl" | "mainColor"; message: string }

/** 反映前に見つけたい問題。空配列なら反映してよい。 */
export function validateBranding(b: Branding): BrandingIssue[] {
  const issues: BrandingIssue[] = []

  const name = b.displayName.trim()
  if (name.length === 0) {
    issues.push({ field: "displayName", message: "ブランド表示名を入力してください" })
  } else if (name.length > 20) {
    issues.push({
      field: "displayName",
      message: "ブランド表示名が長すぎます(20 文字まで)。ヘッダーで折り返します",
    })
  }

  if (!HEX_PATTERN.test(b.mainColor)) {
    issues.push({ field: "mainColor", message: "メインカラーは #RRGGBB の形式で入力してください" })
  } else {
    // ボタンの背景に使うので、白・黒どちらを載せても読めない色は弾く
    const best = Math.max(
      contrastRatio(b.mainColor, "#ffffff"),
      contrastRatio(b.mainColor, "#111111")
    )
    if (best < 4.5) {
      issues.push({
        field: "mainColor",
        message: `この色はボタンの文字が読めません(最大コントラスト ${best.toFixed(1)}:1、必要 4.5:1)。もう少し濃いか薄い色にしてください`,
      })
    }
  }

  return issues
}
