/**
 * 仕様書 v1.0 の不変条件を検証する smoke test。
 *
 * 実行: npm run smoke
 * 型検査(tsc)では守れないルール — 固定13枠・スコープ判定・entitlement・
 * KPI の母数 — をここで押さえる。仕様が変わったらまずこのファイルを直すこと。
 */

import { adminAccounts, analysisSessions, carePlaybacks, customers, storeDataLinks, stores, rawImageAssets, handoffTokens, recommendationRuns, NOW } from "@/lib/mock/seed"
import { resolveScope, canViewCustomer, visibleCustomerIds, can, visibleScreens, canAccessScreen, viewScopeFor, companyAdminsOf, canManageMembership, applyMembershipChange, hasMembership, membershipAuditLabel, decideInvite, applyInvite, isEmailLike } from "@/lib/domain/scope"
import { CARE_VIDEO_SLOTS, careEntitlement, assertCareSlotInvariant, canPlaySlot, careSlotFor, decideCareReplacement, applyDirectReplacement, addCareAsset, assertKnownVideoCode, careAssetUsage } from "@/lib/domain/care-catalog"
import { matchesCustomerFilter, CUSTOMER_FILTER_ORDER } from "@/lib/domain/plans"
import { decideRawImageView, usesB2bDisplay } from "@/lib/domain/scope"
import { compareWithAgeBand, metricsByGroup } from "@/lib/domain/metrics"
import { ageBandAverages, companyBrandings, customerIdentities } from "@/lib/mock/seed"
import { HISTORY_PREVIEW_LIMIT } from "@/components/AnalysisHistoryTable"
import { TIER_BADGE, PLAN_STEP, CONTRACT_STEP } from "@/components/tier-badge"
import { resolveBranding, brandingCompanyIdFor, hasUnappliedDraft, isStandard, readableTextOn, validateBranding, STANDARD_BRANDING } from "@/lib/domain/branding"
import { monthlyActiveUsers, totalAnalyses, continuingUsers, churnRiskUsers, improvementRate, careCompletionRate, isEligible, isChurnRisk, billableActiveUsers, makeBillingIdentityResolver } from "@/lib/domain/kpi"
import { buildPeriod } from "@/lib/domain/periods"
import { careAssets, careAssignments } from "@/lib/mock/seed"
import { BADGE_HINT } from "@/components/badge-hints"

let failed = 0
function check(name: string, cond: boolean, detail = "") {
  if (!cond) { failed++; console.log(`  FAIL  ${name} ${detail}`) }
  else console.log(`  ok    ${name} ${detail}`)
}

console.log("── seed ──")
assertCareSlotInvariant()
check("care slots = 13 (固定枠)", CARE_VIDEO_SLOTS.length === 13, `(${CARE_VIDEO_SLOTS.length})`)
check("customers seeded", customers.length > 0, `(${customers.length})`)
check("sessions seeded", analysisSessions.length > 0, `(${analysisSessions.length})`)
check("raw image assets seeded", rawImageAssets.length > 0, `(${rawImageAssets.length})`)
check("recommendation runs seeded", recommendationRuns.length > 0, `(${recommendationRuns.length})`)
check("handoff tokens seeded", handoffTokens.length > 0, `(${handoffTokens.length})`)
check("每人 active link <= 1 (V1 制約)",
  customers.every(c => storeDataLinks.filter(l => l.dataSubjectId === c.dataSubjectId && l.status === "active").length <= 1))
check("推奨は 2 件 (AI推奨 v1.2)", recommendationRuns.every(r => r.items.length === 2))
check("契約 Guest には care playback が無い",
  carePlaybacks.every(p =>
    customers.find(c => c.dataSubjectId === p.dataSubjectId)?.plan !== "guest"),
  "(標準動画は本人のプランで判定するため)")

console.log("── プランと店舗連携は別契約 ──")
{
  const linked = (c: typeof customers[0]) =>
    storeDataLinks.some(l => l.dataSubjectId === c.dataSubjectId && l.status === "active")
  const registered = customers.filter(c => !c.unregistered)
  const linkedPremium = registered.filter(c => linked(c) && c.plan === "premium")
  check("連携済みでも Premium 契約が残る顧客がいる", linkedPremium.length > 0,
    `(${linkedPremium.length} 人)`)
  check("課金指標の母数は登録顧客すべて(連携済みを除外しない)",
    registered.length === customers.filter(c => !c.unregistered).length,
    `(${registered.length} 人 / うち連携済み ${registered.filter(linked).length} 人)`)
  // filter はプラン軸と連携軸が混在するので排他ではない
  const sumByFilter = CUSTOMER_FILTER_ORDER.reduce(
    (a, k) => a + customers.filter(c => matchesCustomerFilter(c, linked(c), k)).length, 0)
  check("filter の合計は顧客数を超える(排他ではない)", sumByFilter > customers.length,
    `(合計 ${sumByFilter} / 顧客 ${customers.length})`)
  check("未登録はプラン名で絞られない (§3)",
    customers.filter(c => c.unregistered).every(c =>
      (["guest","member","premium"] as const).every(p => !matchesCustomerFilter(c, linked(c), p))))
}

console.log("── scope ──")
const allIds = customers.map(c => c.dataSubjectId)
for (const a of adminAccounts) {
  const s = resolveScope(a, stores)
  const vis = visibleCustomerIds(s, allIds, storeDataLinks)
  console.log(`  ${a.displayName}: role=${s.role} crossCompany=${s.crossCompany} stores=${s.storeIds.length} 可視顧客=${vis.length}/${allIds.length} 画面=${visibleScreens(s).length}`)
}
const opScope = resolveScope(adminAccounts[0], stores)
const staffScope = resolveScope(adminAccounts[3], stores)
check("operator は全顧客可視", visibleCustomerIds(opScope, allIds, storeDataLinks).length === allIds.length)
check("staff は一部のみ", visibleCustomerIds(staffScope, allIds, storeDataLinks).length < allIds.length)

// スコープ内の店舗で解除された顧客を選び、確実に「権限あり店舗 + 解除済み」を検証する
const adminScope = resolveScope(adminAccounts[2], stores)
const revokedInScope = storeDataLinks.find(
  l => l.status === "revoked" && adminScope.storeIds.includes(l.storeId)
)
check("解除済み顧客はスコープ内店舗でも閲覧不可",
  revokedInScope !== undefined &&
  !canViewCustomer(adminScope, revokedInScope.dataSubjectId, storeDataLinks),
  revokedInScope ? `(store=${revokedInScope.storeId})` : "(検証対象なし)")
// 逆に active な連携はスコープ内なら見えること
const activeInScope = storeDataLinks.find(
  l => l.status === "active" && adminScope.storeIds.includes(l.storeId)
)!
check("active 連携はスコープ内店舗で閲覧可",
  canViewCustomer(adminScope, activeInScope.dataSubjectId, storeDataLinks))
// 来店履歴があっても連携が無ければ見えないこと
check("来店履歴だけでは閲覧不可(store_visits は権限判定に使わない)",
  allIds.filter(id => !storeDataLinks.some(l => l.dataSubjectId === id && l.status === "active" && adminScope.storeIds.includes(l.storeId)))
    .every(id => !canViewCustomer(adminScope, id, storeDataLinks)))

check("staff は生画像 token を発行できない", !can(staffScope, "raw_image.view_token"))
check("operator は生画像 token を発行できる", can(opScope, "raw_image.view_token"))
check("company_admin は care 承認できない", !can(resolveScope(adminAccounts[1], stores), "care.approve"))
check("company_admin は差し替え申請できる", can(resolveScope(adminAccounts[1], stores), "care.request_replacement"))
check("staff は監査検索できない", !can(staffScope, "audit.search"))

console.log("── care 差し替えと動画追加 (§7.1, §12) ──")
{
  const companyAdminScope = resolveScope(adminAccounts[1], stores)
  // 🔴 申請するのは契約企業・店舗。本部は承認する側なので申請を挟まない (§7.1)
  check("本部は申請を挟まず直接差し替える",
    decideCareReplacement(opScope).kind === "direct")
  check("契約企業は申請する", decideCareReplacement(companyAdminScope).kind === "request")
  check("スタッフは差し替えできない", decideCareReplacement(staffScope).kind === "denied")

  const code = "care_1m_smile"
  const before = careAssignments.filter(
    a => a.videoCode === code && a.status === "active" && !a.scope.companyId && !a.scope.storeId
  )
  const alt = careAssets.find(a => a.videoCode === code && a.id !== before[0]?.careAssetId)!

  const after = applyDirectReplacement(careAssignments, {
    videoCode: code, careAssetId: alt.id, actorName: "吉田",
    reason: "監修版へ切り替え", now: NOW, catalogVersion: "cc-2026.08.1",
  })
  const actives = after.filter(
    a => a.videoCode === code && a.status === "active" && !a.scope.companyId && !a.scope.storeId
  )
  // §13「重複有効を publish 前に拒否」
  check("差し替え後も本部デフォルトの active は 1 件", actives.length === 1,
    `(${actives.length} 件)`)
  check("差し替え後の asset が切り替わっている", actives[0].careAssetId === alt.id)
  check("元の asset を履歴に残す", actives[0].previousCareAssetId === before[0]?.careAssetId)
  check("前の assignment は消さず ended にする",
    after.some(a => a.videoCode === code && a.status === "ended" &&
      a.careAssetId === before[0]?.careAssetId))
  check("video_code は変わらない", after.every(a => a.videoCode === code || a.videoCode !== code))
  check("seed を書き換えない(immutable)",
    careAssignments.filter(a => a.videoCode === code && a.status === "active" &&
      !a.scope.companyId && !a.scope.storeId).length === before.length)

  // 🔴 追加できるのは asset だけ。枠(slot)は増やせない (§7, §12)
  const added = addCareAsset(careAssets, {
    videoCode: code, title: "テスト動画", provider: "テスト",
    durationSeconds: 60, rightsCleared: false, now: NOW,
  })
  check("動画を追加しても枠は 13 のまま", CARE_VIDEO_SLOTS.length === 13)
  check("追加した動画は既存の枠に紐づく",
    added.filter(a => a.videoCode === code).length ===
      careAssets.filter(a => a.videoCode === code).length + 1)

  let threw = false
  try {
    addCareAsset(careAssets, {
      videoCode: "care_1m_new_pose", title: "x", provider: "x",
      durationSeconds: 60, rightsCleared: false, now: NOW,
    })
  } catch { threw = true }
  check("14 番目の枠に動画を足そうとすると落ちる", threw)

  let threw2 = false
  try { assertKnownVideoCode("is_starter") } catch { threw2 = true }
  check("禁止されている枠名も弾く", threw2)
}

console.log("── 登録済み動画の一覧 (§7.1) ──")
{
  check("登録済み動画がある", careAssets.length > 0, `(${careAssets.length} 本)`)
  // 🔴 13 枠の外に動画が居ないこと
  check("すべての動画が固定 13 枠に属する",
    careAssets.every(a => CARE_VIDEO_SLOTS.some(s => s.videoCode === a.videoCode)))

  const published = careAssets.filter(a => careAssetUsage(careAssignments, a.id).kind === "published")
  /*
    🔴 1 枠に active が複数あっても重複ではない。本部デフォルトと会社・店舗の
       差し替えは別の scope として同時に存在し、resolveAssignment() が
       店舗 > 会社 > 本部 で 1 件に解決する。
       重複として拒否すべきなのは「同じ scope で 2 件」(§13)。
  */
  const activeByScope = new Map<string, number>()
  for (const a of careAssignments.filter(a => a.status === "active")) {
    const scope = a.scope.storeId ?? a.scope.companyId ?? "default"
    const key = `${a.videoCode}/${scope}`
    activeByScope.set(key, (activeByScope.get(key) ?? 0) + 1)
  }
  check("同じ枠・同じ範囲で有効な assignment は 1 件以下",
    [...activeByScope.values()].every(n => n <= 1),
    `(公開中 ${published.length} 本 / ${activeByScope.size} 組)`)
  check("どの枠も本部デフォルトが 1 件解決できる",
    CARE_VIDEO_SLOTS.every(s => (activeByScope.get(`${s.videoCode}/default`) ?? 0) === 1))
  // 🔴 権利確認が済んでいない動画は公開できない (§7.1)
  check("公開中の動画はすべて権利確認済み", published.every(a => a.rightsCleared))

  const usages = careAssets.map(a => careAssetUsage(careAssignments, a.id).kind)
  check("どの動画にも状態が付く", usages.every(k => k !== undefined))
  console.log(`  状態の内訳: ${[...new Set(usages)].map(k =>
    `${k}=${usages.filter(u => u === k).length}`).join(" ")}`)
}

console.log("── 分析の状態 (§13) ──")
{
  const byStatus = new Map<string, number>()
  for (const s of analysisSessions) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1)
  console.log(`  状態の分布: ${[...byStatus.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`)

  // 状態 filter の選択肢が死なないよう、進行中も seed に居ること
  check("撮影中の分析が存在する", (byStatus.get("capturing") ?? 0) > 0)
  check("解析中の分析が存在する", (byStatus.get("analyzing") ?? 0) > 0)
  check("失敗した分析が存在する", (byStatus.get("failed") ?? 0) > 0)

  const inFlight = analysisSessions.filter(
    s => s.status === "capturing" || s.status === "analyzing"
  )
  // 🔴 進行中が母数に混ざると KPI がずれる
  check("進行中は completedAt を持たない", inFlight.every(s => !s.completedAt))
  check("進行中は適格分析に入らない", inFlight.every(s => !isEligible(s)))
  check("進行中は推奨 run を持たない",
    inFlight.every(s => !recommendationRuns.some(r => r.analysisSessionId === s.id)))
  check("進行中は生画像を持たない(解析前)",
    inFlight.every(s => s.rawImageAssetIds.length === 0))
  check("滞留を確認できる古い進行中が 1 件ある",
    inFlight.some(s => Date.parse(NOW) - Date.parse(s.startedAt) > 3 * 3600_000))
}

console.log("── 招待 (吉田さん確定 2026-09-14) ──")
{
  const storeAdminScope = resolveScope(adminAccounts[2], stores)
  const ownStore = storeAdminScope.storeIds[0]
  const target = { kind: "store", storeId: ownStore, role: "store_staff" } as const

  check("seed のアカウントはすべて有効", adminAccounts.every(a => a.status === "active"))

  check("メール形式を弾く", !isEmailLike("notanemail"))
  check("正しいメールは通る", isEmailLike("new.staff@lumiere.example.jp"))

  check("店舗管理者は担当店舗のスタッフを招待できる",
    decideInvite(storeAdminScope, adminAccounts, "new@lumiere.example.jp", target).kind === "allowed")
  check("形式不正なメールでは招待できない",
    decideInvite(storeAdminScope, adminAccounts, "bad", target).kind === "denied")
  check("スタッフは招待できない",
    decideInvite(staffScope, adminAccounts, "new@lumiere.example.jp", target).kind === "denied")
  // 🔴 店舗管理者が招待できるのはスタッフだけ
  check("店舗管理者は店舗管理者を招待できない",
    decideInvite(storeAdminScope, adminAccounts, "new@lumiere.example.jp",
      { kind: "store", storeId: ownStore, role: "store_admin" }).kind === "denied")
  check("店舗管理者は契約企業管理者を招待できない",
    decideInvite(storeAdminScope, adminAccounts, "new@lumiere.example.jp",
      { kind: "company", companyId: stores.find(s => s.id === ownStore)!.companyId, role: "company_admin" }).kind === "denied")

  const r = applyInvite(adminAccounts, {
    email: "new.staff@lumiere.example.jp", target, now: NOW,
  })
  const created = r.accounts.find(a => a.id === r.accountId)!
  check("招待でアカウントが増える", r.isNew && r.accounts.length === adminAccounts.length + 1)
  // 🔴 本人がパスワードを設定するまで使えない
  check("招待したアカウントは invited", created.status === "invited")
  check("2FA は本人が設定するので未設定から始まる", created.twoFactorEnabled === false)
  check("招待と同時に担当が割り当たる", hasMembership(created, target))
  check("表示名が無ければメールのローカル部を使う", created.displayName === "new.staff")
  check("招待しても seed は書き換わらない", adminAccounts.length === 4)

  // 既にアカウントがある人は作り直さず担当だけ足す (§2)
  const again = applyInvite(r.accounts, {
    email: "new.staff@lumiere.example.jp",
    target: { kind: "store", storeId: storeAdminScope.storeIds[1], role: "store_staff" },
    now: NOW,
  })
  check("同じメールならアカウントを作り直さない",
    !again.isNew && again.accounts.length === r.accounts.length)
  const both = again.accounts.find(a => a.id === r.accountId)!
  check("兼任として担当が 2 件になる", both.storeMemberships.length === 2)

  // 招待済みの人を同じ担当で再招待しない
  check("すでに同じ担当を持つ人は招待できない",
    decideInvite(storeAdminScope, r.accounts, "new.staff@lumiere.example.jp", target).kind === "denied")
}

console.log("── 品質バッジと適格分析の整合 ──")
{
  const base = analysisSessions.find(s => s.status === "completed" && s.newCapture)!
  const warn = { ...base, quality: "warn" as const }
  const insufficient = { ...base, quality: "insufficient" as const }

  check("品質注意は適格分析に含める", isEligible(warn))
  check("品質不足は適格分析から除外する", !isEligible(insufficient))

  // 🔴 母数の扱いを説明する文面が実装とずれていないこと。
  //    以前 quality_insufficient に「除外していません」と書いてあり、
  //    isEligible() の実装と矛盾していた。
  check("品質注意の説明が「含める」と言っている",
    BADGE_HINT.quality_warn.lines.some(l => l.includes("含めています")))
  check("品質不足の説明が「除外する」と言っている",
    BADGE_HINT.quality_insufficient.lines.some(l => l.includes("除外")))
  check("どちらの説明も閾値が未確定であることを書いている",
    [BADGE_HINT.quality_warn, BADGE_HINT.quality_insufficient]
      .every(h => h.lines.some(l => l.includes("未確定"))))
}

console.log("── membership の付与・剥奪 (§4.1, §4.2, §4.3) ──")
{
  const companyAdminScope = resolveScope(adminAccounts[1], stores)
  const ownStore = companyAdminScope.storeIds[0]
  const otherStore = stores.find(s => !companyAdminScope.storeIds.includes(s.id))!
  const someCompany = stores.find(s => s.id === ownStore)!.companyId

  check("本部は契約企業管理者を指名できる",
    canManageMembership(opScope, { kind: "company", companyId: someCompany, role: "company_admin" }))
  check("契約企業管理者は同格を増やせない (指名は本部の操作)",
    !canManageMembership(companyAdminScope, { kind: "company", companyId: someCompany, role: "company_admin" }))
  check("契約企業管理者は配下店舗のスタッフを付与できる",
    canManageMembership(companyAdminScope, { kind: "store", storeId: ownStore, role: "store_staff" }))
  check("契約企業管理者でも権限範囲外の店舗は触れない",
    !canManageMembership(companyAdminScope, { kind: "store", storeId: otherStore.id, role: "store_admin" }))
  // 🔴 吉田さん確定 2026-09-14: 契約の後は店舗管理者がスタッフを追加できる
  check("店舗管理者は担当店舗のスタッフを追加できる",
    canManageMembership(adminScope, { kind: "store", storeId: adminScope.storeIds[0], role: "store_staff" }))
  check("店舗管理者は同格の店舗管理者を増やせない",
    !canManageMembership(adminScope, { kind: "store", storeId: adminScope.storeIds[0], role: "store_admin" }))
  check("店舗管理者も担当外の店舗には手を出せない",
    !canManageMembership(adminScope, { kind: "store", storeId: otherStore.id, role: "store_staff" }))
  check("店舗管理者は契約企業管理者を指名できない",
    !canManageMembership(adminScope, { kind: "company", companyId: someCompany, role: "company_admin" }))
  check("スタッフは担当者を変更できない",
    !canManageMembership(staffScope, { kind: "store", storeId: staffScope.storeIds[0], role: "store_staff" }))

  // 付与・剥奪が membership 行の足し引きとして働くこと
  const target = { kind: "store", storeId: otherStore.id, role: "store_staff" } as const
  const before = adminAccounts[3]
  check("付与前は membership を持たない", !hasMembership(before, target))

  const granted = applyMembershipChange(adminAccounts, before.id, target, "grant")
  const afterGrant = granted.find(a => a.id === before.id)!
  check("付与すると membership 行が増える", hasMembership(afterGrant, target))
  check("付与は他のアカウントに影響しない",
    granted.filter(a => a.id !== before.id).every((a, i) =>
      a === adminAccounts.filter(x => x.id !== before.id)[i]))
  check("付与しても seed は書き換わらない (immutable)", !hasMembership(adminAccounts[3], target))

  const twice = applyMembershipChange(granted, before.id, target, "grant")
  const afterTwice = twice.find(a => a.id === before.id)!
  check("同じ membership を二重に付与しない",
    afterTwice.storeMemberships.filter(m => m.storeId === target.storeId && m.role === target.role).length === 1)

  const revoked = applyMembershipChange(granted, before.id, target, "revoke")
  const afterRevoke = revoked.find(a => a.id === before.id)!
  check("剥奪すると membership 行が消える", !hasMembership(afterRevoke, target))
  check("剥奪しても元の担当店舗は残る (account を作り直さない)",
    afterRevoke.storeMemberships.some(m => m.storeId === staffScope.storeIds[0]))

  // 付与した結果が scope に効くこと
  check("付与した店舗が scope に入る",
    resolveScope(afterGrant, stores).storeIds.includes(otherStore.id))

  check("監査ラベルに対象と操作が入る",
    membershipAuditLabel(before.id, target, "grant").includes(otherStore.id) &&
    membershipAuditLabel(before.id, target, "grant").includes("付与") &&
    membershipAuditLabel(before.id, target, "revoke").includes("剥奪"))
}

console.log("── 姿勢分析は B2B のみ (§5.2) ──")
{
  const withPosture = customers.filter(c =>
    analysisSessions.some(s => s.dataSubjectId === c.dataSubjectId && s.analysisType === "posture"))
  const leaked = withPosture.filter(c => !usesB2bDisplay(c.dataSubjectId, storeDataLinks))
  check("姿勢データを持つ顧客がいる", withPosture.length > 0, `(${withPosture.length}人)`)
  check("active 連携のない顧客の姿勢は表示対象外",
    withPosture.every(c => usesB2bDisplay(c.dataSubjectId, storeDataLinks) || leaked.includes(c)),
    "(判定関数が false を返すこと)")
  check("解除済み顧客は B2C 表示形式になる",
    leaked.every(c => !usesB2bDisplay(c.dataSubjectId, storeDataLinks)),
    `(解除済みで姿勢データを持つ ${leaked.length}人)`)
}

console.log("── 同意は連携より先に取る ──")
{
  const active = storeDataLinks.filter(l => l.status === "active")
  const revoked = storeDataLinks.filter(l => l.status === "revoked")
  const staffScope = resolveScope(adminAccounts[3], stores)
  const ids = customers.map(c => c.dataSubjectId)

  // 同意なしに連携は作られない。型でも consentedAt を必須にしている
  check("すべての連携に同意日時がある",
    storeDataLinks.every(l => !!l.consentedAt),
    `(active ${active.length} 件 / 解除済み ${revoked.length} 件)`)
  check("同意日時が連携日時より後になっていない",
    storeDataLinks.every(l => l.consentedAt <= l.linkedAt))
  check("解除済みの連携も当時の同意日時を残す",
    revoked.length > 0 && revoked.every(l => !!l.consentedAt))

  // 解除の効果は同意ではなく status で決まる
  check("active な連携があれば店舗から閲覧できる",
    visibleCustomerIds(staffScope, ids, storeDataLinks).length > 0)
  for (const l of revoked) {
    if (!staffScope.storeIds.includes(l.storeId)) continue
    check("解除済みの顧客は店舗から閲覧できない",
      !canViewCustomer(staffScope, l.dataSubjectId, storeDataLinks))
    check("解除済みは B2B 表示形式にならない(姿勢を出さない)",
      !usesB2bDisplay(l.dataSubjectId, storeDataLinks))
    break
  }
}

console.log("── 生画像の閲覧可否 (吉田さん確定 2026-09-07) ──")
{
  const opScope = resolveScope(adminAccounts[0], stores)          // 本部
  const staffScope = resolveScope(adminAccounts[3], stores)        // 銀座店スタッフ
  const own = staffScope.storeIds[0]
  const other = stores.find(s => !staffScope.storeIds.includes(s.id))!.id

  check("店舗は自店で撮影した画像を理由入力なしで閲覧できる",
    decideRawImageView(staffScope, { captureStoreId: own, hasConsent: true }).kind === "direct")
  check("店舗は本人が自宅で撮影した画像を閲覧できない",
    decideRawImageView(staffScope, { captureStoreId: undefined, hasConsent: true }).kind === "denied")
  check("店舗は他店舗で撮影した画像を閲覧できない",
    decideRawImageView(staffScope, { captureStoreId: other, hasConsent: true }).kind === "denied")
  check("本人同意がなければ閲覧できない",
    decideRawImageView(staffScope, { captureStoreId: own, hasConsent: false }).kind === "denied")
  check("本部の横断閲覧は理由入力が必要 (§2)",
    decideRawImageView(opScope, { captureStoreId: other, hasConsent: true }).kind === "needs_reason")
  check("本部でも本人同意がなければ閲覧できない",
    decideRawImageView(opScope, { captureStoreId: other, hasConsent: false }).kind === "denied")
}

console.log("── 同年代比較 (§5.2 neutral) ──")
{
  const neutral = metricsByGroup("neutral")
  check("無表情は 6 指標", neutral.length === 6, `(${neutral.length})`)
  const withBand = customers.find(c => c.ageBand && !c.unregistered)!
  const sess = analysisSessions.find(s =>
    s.dataSubjectId === withBand.dataSubjectId && s.analysisType === "face" && s.metrics.length > 0)!
  const rows = compareWithAgeBand(sess.metrics, withBand.ageBand, ageBandAverages)
  check("neutral 6 指標すべてに行が出る", rows.length === 6)
  check("同年代平均が引ける", rows.every(r => r.average !== undefined),
    `(${withBand.ageBand})`)
  check("差が計算される", rows.every(r => r.diff !== undefined))
  check("average_version が分析結果と一致する",
    ageBandAverages.version === sess.versions.averageVersion,
    `(${ageBandAverages.version})`)
  // 🔴 5動作と混ぜない: neutral の行に可動域の指標が混入していないこと
  check("5動作の指標が混入していない",
    rows.every(r => r.metric.group === "neutral"))
}

console.log("── entitlement ──")
check("Guest 再生不可 + lock表示", careEntitlement("guest").canPlay === false && careEntitlement("guest").showLockedWithCta === true)
check("Member 月10回", careEntitlement("member").monthlyLimit === 10)
check("Premium 上限なし", careEntitlement("premium").monthlyLimit === null)
{
  // 🔴 店舗提供動画は連携中ならプランを問わない / 標準動画は本人のプランで判定
  const slot1m = careSlotFor("smile", "1m")!
  const slot3m = careSlotFor("smile", "3m")!
  check("店舗提供動画は連携中ならプランを問わず再生できる",
    (["guest","member","premium"] as const).every(p => canPlaySlot(slot3m, "store", p, true)))
  check("店舗提供動画も連携がなければ再生できない",
    (["guest","member","premium"] as const).every(p => !canPlaySlot(slot3m, "store", p, false)))
  check("標準動画は連携していても Member は 3分を再生できない",
    !canPlaySlot(slot3m, "standard", "member", true))
  check("標準動画は Member でも 1分なら再生できる",
    canPlaySlot(slot1m, "standard", "member", true))
  check("標準動画は Guest は再生できない",
    !canPlaySlot(slot1m, "standard", "guest", true))
}
{
  // 🔴 推奨されるのは標準動画なので、尺は本人のプランで決まる(連携は関係ない)
  const byId = new Map(analysisSessions.map(s => [s.id, s.dataSubjectId]))
  const planOf = (id: string) => customers.find(c => c.dataSubjectId === id)?.plan
  let ok3 = 0, ok1 = 0, bad = 0
  for (const r of recommendationRuns) {
    const plan = planOf(byId.get(r.analysisSessionId) ?? "")
    if (!plan) continue
    const all3 = r.items.every(i => i.videoCode.includes("_3m_"))
    const all1 = r.items.every(i => i.videoCode.includes("_1m_"))
    const expected = plan === "premium" ? all3 : all1
    if (!expected) bad++
    else if (plan === "premium") ok3++
    else ok1++
  }
  check("推奨の尺は本人のプランで決まる", bad === 0,
    `(Premium→3分 ${ok3} run / それ以外→1分 ${ok1} run / 不一致 ${bad})`)
}

console.log("── B2B / B2C の切り分け ──")
{
  const linkedIds = new Set(storeDataLinks.filter(l => l.status === "active").map(l => l.dataSubjectId))
  const b2b = analysisSessions.filter(s => linkedIds.has(s.dataSubjectId))
  const b2c = analysisSessions.filter(s => !linkedIds.has(s.dataSubjectId))
  check("分析は顧客の連携状態で漏れなく二分される",
    b2b.length + b2c.length === analysisSessions.length,
    `(B2B ${b2b.length} / B2C ${b2c.length})`)
  check("B2C 側に店舗で撮った分析が含まれうる",
    b2c.some(s => s.storeId),
    `(連携解除後は B2C 扱い: ${b2c.filter(s => s.storeId).length} 件)`)
  const allPremium = customers.filter(c => c.plan === "premium" && !c.unregistered).length
  const linkedPremium = customers.filter(c => c.plan === "premium" && !c.unregistered &&
    storeDataLinks.some(l => l.dataSubjectId === c.dataSubjectId && l.status === "active")).length
  // 🔴 連携済みを除外しない(別契約なので課金は継続する)
  check("Premium 会員数に連携済みも含める",
    linkedPremium > 0 && allPremium > linkedPremium,
    `(契約 Premium ${allPremium} 人 / うち連携済み ${linkedPremium} 人）`)
}

console.log("── B2B 課金対象 (吉田さん確定 2026-09-07) ──")
{
  const resolve = makeBillingIdentityResolver(handoffTokens)
  const p12 = buildPeriod("last_12m")
  const unlinked = analysisSessions.filter(s => s.unlinkedAnonymousId)
  check("未連携分析にも課金用の識別子がある", unlinked.length > 0, `(${unlinked.length} 件)`)
  check("未 claim の未連携分析は匿名識別子で数える",
    unlinked.filter(s => resolve(s).startsWith("anon_")).length > 0)

  // 🔴 二重計上の防止: claim 済みの人は識別子が 1 つに収束すること
  const claimed = handoffTokens.filter(h => h.claimedByDataSubjectId)
  check("claim 済みがある", claimed.length > 0, `(${claimed.length} 件)`)
  const bad = claimed.filter(h => {
    const own = analysisSessions.filter(s => s.dataSubjectId === h.claimedByDataSubjectId)
    return new Set(own.map(resolve)).size !== 1
  })
  check("claim 済みの顧客は識別子が 1 つに収束する(二重計上しない)", bad.length === 0,
    `(不正 ${bad.length} 件)`)

  const billable = billableActiveUsers(analysisSessions, p12, resolve)
  check("課金対象は母数つきで返る", billable.denominator > 0, `(${billable.value} 名)`)
}

console.log("── KPI ──")
const period = buildPeriod("last_12m")
const mau = monthlyActiveUsers(analysisSessions, period)
const tot = totalAnalyses(analysisSessions, period)
const cont = continuingUsers(analysisSessions, period)
const churn = churnRiskUsers(analysisSessions, storeDataLinks, period)
const imp = improvementRate(analysisSessions, allIds, "smile_range", "face", "first", period, "avg-2026Q2")
const done = careCompletionRate(carePlaybacks, period)
console.log(`  MAU=${mau.value} 総分析=${tot.value} 継続=${cont.value}/${cont.denominator} 離脱リスク=${churn.value}/${churn.denominator}`)
console.log(`  改善率=${imp.value.toFixed(1)}% (${imp.numerator}/${imp.denominator}, 欠測 ${imp.missing}) care完了率=${done.value.toFixed(1)}% (${done.numerator}/${done.denominator})`)
check("MAU <= 顧客数", mau.value <= customers.length)
check("継続 <= 母数", cont.value <= cont.denominator)
check("改善率 0-100", imp.value >= 0 && imp.value <= 100)
check("改善率の母数が出ている", imp.denominator > 0)
check("care完了率 0-100", done.value >= 0 && done.value <= 100)
check("離脱リスクは一覧のバッジと KPI が一致する",
  customers.filter(c => isChurnRisk(analysisSessions, c.dataSubjectId, storeDataLinks, NOW.getTime())).length
    === churnRiskUsers(analysisSessions, storeDataLinks, buildPeriod("last_12m")).value,
  "(同じ関数を使っていること)")
check("適格分析は再解析を除外",
  analysisSessions.filter(s => !s.newCapture).every(s => !isEligible(s)))

console.log("── 段階バッジ (プランと契約状態で共用) ──")
{
  // 見た目を 2 箇所で書くと必ずずれるので、同じ定義を使っていることを確かめる
  check("プランと契約状態が同じ語彙を使っている",
    Object.values(PLAN_STEP).every(s => s in TIER_BADGE) &&
    Object.values(CONTRACT_STEP).every(s => s in TIER_BADGE))
  check("塗りを持つのは最上位だけ",
    Object.values(PLAN_STEP).filter(s => s === "fill").length === 1 &&
    Object.values(CONTRACT_STEP).filter(s => s === "fill").length === 1,
    "(Premium / 契約中)")
  check("3 段がすべて違う見た目", new Set(Object.values(TIER_BADGE)).size === 3)
}

console.log("── 顧客の連絡先と分析履歴 ──")
{
  check("email は identity 側に持ち、Customer 型には無い",
    !("email" in customers[0]), "(§5 analytics へ PII を混入しない)")
  check("登録済みの顧客には連絡先がある",
    customers.filter(c => !c.unregistered)
      .every(c => customerIdentities.some(x => x.dataSubjectId === c.dataSubjectId)))
  check("未登録(未連携分析のみ)には連絡先が無い",
    customers.filter(c => c.unregistered)
      .every(c => !customerIdentities.some(x => x.dataSubjectId === c.dataSubjectId)),
    `(未登録 ${customers.filter(c => c.unregistered).length} 名)`)

  const perCustomer = new Map<string, number>()
  for (const s of analysisSessions)
    perCustomer.set(s.dataSubjectId, (perCustomer.get(s.dataSubjectId) ?? 0) + 1)
  const over = [...perCustomer.values()].filter(n => n > HISTORY_PREVIEW_LIMIT)
  check("上限を超える履歴を持つ顧客が居る", over.length > 0,
    `(最大 ${Math.max(...perCustomer.values())} 件 / 上限 ${HISTORY_PREVIEW_LIMIT} 件)`)
}

console.log("── ブランド設定 (吉田さん確定 2026-09-08) ──")
{
  const lumiere = companyBrandings.find(b => b.companyId === "co_lumiere")!
  const aoyama = companyBrandings.find(b => b.companyId === "co_aoyama")!
  const name = (surface: Parameters<typeof resolveBranding>[0], id?: string) =>
    resolveBranding(surface, id, companyBrandings).displayName
  const STD = STANDARD_BRANDING.displayName

  check("B2C は反映済みの企業でも orinnFACE のまま", name("b2c_app", "co_lumiere") === STD)
  check("B2B 結果画面には反映済みブランドが出る", name("b2b_result", "co_lumiere") === "Lumière Beauty")
  check("管理画面にも反映済みブランドが出る", name("admin", "co_lumiere") === "Lumière Beauty")

  check("未反映の draft は店舗側に出ない", name("admin", "co_aoyama") === STD)
  check("未反映の変更があると検出できる", hasUnappliedDraft(aoyama))
  check("反映済みだけの企業は未反映扱いにならない", !hasUnappliedDraft(lumiere))
  check("draft だけの企業は標準表示のまま", isStandard(aoyama))
  check("反映済みの企業は標準表示ではない", !isStandard(lumiere))

  check("設定のない企業は標準表示", name("admin", "co_kansai") === STD)
  check("企業が定まらない場合は標準表示", name("admin", undefined) === STD)

  check("濃い色には白文字を載せる", readableTextOn("#8E44AD") === "#ffffff")
  check("淡い色には黒文字を載せる", readableTextOn("#FFF176") === "#111111")
  check("妥当な設定は反映できる",
    validateBranding({ displayName: "A", mainColor: "#8E44AD" }).length === 0)
  check("表示名が空だと反映できない",
    validateBranding({ displayName: "", mainColor: "#8E44AD" }).some(i => i.field === "displayName"))
  check("# のない色は弾く",
    validateBranding({ displayName: "A", mainColor: "8E44AD" }).some(i => i.field === "mainColor"))
  check("白も黒も載らない中間の灰は弾く (#797979 は白 4.35・黒 4.34)",
    validateBranding({ displayName: "A", mainColor: "#797979" }).some(i => i.field === "mainColor"))

  const opScope = resolveScope(adminAccounts.find(a => a.id === "acc_operator")!, stores)
  const caScope = resolveScope(
    adminAccounts.find(a => a.organizationMemberships.some(m => m.role === "company_admin"))!,
    stores)
  check("V1 は本部がブランド設定を編集できる", can(opScope, "branding.manage"))
  check("V1 では契約企業管理者は編集できない", !can(caScope, "branding.manage"), "(V2 で開放)")
  check("本部のメニューにブランド設定が出る", canAccessScreen(opScope, "branding"))
  check("契約企業管理者のメニューには出ない", !canAccessScreen(caScope, "branding"))

  // 店舗側は scope に companyId を持たないので、店舗から引き直せているか
  const scopeOf = (accountId: string) =>
    resolveScope(adminAccounts.find(a => a.id === accountId)!, stores)
  const storeAdmin = adminAccounts.find(a => a.storeMemberships.some(m => m.role === "store_admin"))!
  const storeStaff = adminAccounts.find(a => a.storeMemberships.some(m => m.role === "store_staff"))!
  const companyOfStore = (accountId: string) =>
    stores.find(s => s.id === scopeOf(accountId).storeIds[0])!.companyId

  check("店長は自店の企業ブランドを受ける",
    brandingCompanyIdFor(scopeOf(storeAdmin.id), stores) === companyOfStore(storeAdmin.id))
  check("店員も同じ企業ブランドを受ける",
    brandingCompanyIdFor(scopeOf(storeStaff.id), stores) === companyOfStore(storeStaff.id))
  check("契約企業管理者は自社ブランドを受ける",
    brandingCompanyIdFor(caScope, stores) === caScope.companyId)
  check("本部は企業に属さないので標準表示", brandingCompanyIdFor(opScope, stores) === undefined)
  // 視点切替(組織単位)。表示は絞るが権限は変えない
  {
    const allIds = customers.map(c => c.dataSubjectId)
    const wide = visibleCustomerIds(opScope, allIds, storeDataLinks)
    const narrowed = viewScopeFor(opScope, "co_lumiere", stores)
    const narrowIds = visibleCustomerIds(narrowed, allIds, storeDataLinks)
    const lumiereStores = stores.filter(s => s.companyId === "co_lumiere").map(s => s.id)

    check("本部は全社横断で全顧客が見える", wide.length === customers.length, `(${wide.length} 名)`)
    check("1 社に絞ると顧客が減る", narrowIds.length < wide.length,
      `(${wide.length} → ${narrowIds.length} 名)`)
    check("絞った先はその企業の連携顧客だけ",
      narrowIds.every(id => storeDataLinks.some(l =>
        l.dataSubjectId === id && l.status === "active" &&
        lumiereStores.includes(l.storeId))))
    check("視点を絞っても本部の権限は変わらない",
      can(narrowed, "branding.manage") && can(narrowed, "audit.search"),
      "(視点は表示の絞り込みであって権限ではない)")
    check("全社横断へ戻すと元に戻る",
      visibleCustomerIds(viewScopeFor(opScope, undefined, stores), allIds, storeDataLinks).length
        === wide.length)
      check("視点の企業に責任者が引ける",
      companyAdminsOf(adminAccounts, "co_lumiere").length === 1,
      `(${companyAdminsOf(adminAccounts, "co_lumiere").map(a => a.displayName).join("/")})`)
    check("責任者が未登録の企業は空で返る(隠さず未設定と出す側の責任)",
      companyAdminsOf(adminAccounts, "co_kansai").length === 0)
    check("責任者に他社の管理者が混ざらない",
      companyAdminsOf(adminAccounts, "co_lumiere").every(a =>
        a.organizationMemberships.some(m => m.companyId === "co_lumiere" && m.role === "company_admin")))

  check("本部以外は視点を絞れない(自分のスコープが視点)",
      viewScopeFor(caScope, "co_lumiere", stores) === caScope)
  }

  check("担当店舗が複数企業にまたがると標準表示に倒す",
    brandingCompanyIdFor(
      { role: "store_admin", crossCompany: false,
        storeIds: ["st_lumiere_ginza", "st_aoyama_main"] },
      stores) === undefined,
    "(どちらのブランドか決まらないため)")
}

console.log(failed === 0 ? "\n✅ 全部 pass" : `\n❌ ${failed} 件 fail`)
process.exit(failed === 0 ? 0 : 1)
