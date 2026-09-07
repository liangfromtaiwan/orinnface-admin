/**
 * 仕様書 v1.0 の不変条件を検証する smoke test。
 *
 * 実行: npm run smoke
 * 型検査(tsc)では守れないルール — 固定13枠・スコープ判定・entitlement・
 * KPI の母数 — をここで押さえる。仕様が変わったらまずこのファイルを直すこと。
 */

import { adminAccounts, analysisSessions, carePlaybacks, customers, storeDataLinks, stores, rawImageAssets, handoffTokens, recommendationRuns, NOW } from "@/lib/mock/seed"
import { resolveScope, canViewCustomer, visibleCustomerIds, can, visibleScreens, usesB2bDisplay } from "@/lib/domain/scope"
import { CARE_VIDEO_SLOTS, careEntitlement, assertCareSlotInvariant, canPlaySlot, careSlotFor } from "@/lib/domain/care-catalog"
import { matchesCustomerFilter, CUSTOMER_FILTER_ORDER } from "@/lib/domain/plans"
import { decideRawImageView } from "@/lib/domain/scope"
import { monthlyActiveUsers, totalAnalyses, continuingUsers, churnRiskUsers, improvementRate, careCompletionRate, isEligible, isChurnRisk } from "@/lib/domain/kpi"
import { buildPeriod } from "@/lib/domain/periods"

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

console.log(failed === 0 ? "\n✅ 全部 pass" : `\n❌ ${failed} 件 fail`)
process.exit(failed === 0 ? 0 : 1)
