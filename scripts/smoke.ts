/**
 * 仕様書 v1.0 の不変条件を検証する smoke test。
 *
 * 実行: npm run smoke
 * 型検査(tsc)では守れないルール — 固定13枠・スコープ判定・entitlement・
 * KPI の母数 — をここで押さえる。仕様が変わったらまずこのファイルを直すこと。
 */

import { adminAccounts, analysisSessions, carePlaybacks, customers, storeDataLinks, stores, rawImageAssets, handoffTokens, recommendationRuns } from "@/lib/mock/seed"
import { resolveScope, canViewCustomer, visibleCustomerIds, can, visibleScreens } from "@/lib/domain/scope"
import { CARE_VIDEO_SLOTS, careEntitlement, assertCareSlotInvariant } from "@/lib/domain/care-catalog"
import { monthlyActiveUsers, totalAnalyses, continuingUsers, churnRiskUsers, improvementRate, careCompletionRate, isEligible } from "@/lib/domain/kpi"
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
check("Guest に care playback が無い",
  carePlaybacks.every(p => customers.find(c => c.dataSubjectId === p.dataSubjectId)?.plan !== "guest"))

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

console.log("── entitlement ──")
check("Guest 再生不可 + lock表示", careEntitlement("guest").canPlay === false && careEntitlement("guest").showLockedWithCta === true)
check("Member 月10回", careEntitlement("member").monthlyLimit === 10)
check("Premium 上限なし", careEntitlement("premium").monthlyLimit === null)

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
check("適格分析は再解析を除外",
  analysisSessions.filter(s => !s.newCapture).every(s => !isEligible(s)))

console.log(failed === 0 ? "\n✅ 全部 pass" : `\n❌ ${failed} 件 fail`)
process.exit(failed === 0 ? 0 : 1)
