import { renderToString } from "react-dom/server"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { NotificationsProvider } from "@/contexts/NotificationsContext"
import { SessionProvider } from "@/contexts/SessionContext"
import { TooltipProvider } from "@/components/ui/tooltip"
import DashboardPage from "@/pages/DashboardPage"
import CustomersPage from "@/pages/CustomersPage"
import CustomerAnalysesPage from "@/pages/CustomerAnalysesPage"
import CustomerDetailPage from "@/pages/CustomerDetailPage"
import AnalysisDetailPage from "@/pages/AnalysisDetailPage"
import AnalysisPage from "@/pages/AnalysisPage"
import OrganizationsPage from "@/pages/OrganizationsPage"
import CareVideosPage from "@/pages/CareVideosPage"
import RecommendationPage from "@/pages/RecommendationPage"
import RetentionPage from "@/pages/RetentionPage"
import AuditPage from "@/pages/AuditPage"
import BrandingPage from "@/pages/BrandingPage"
import AccountPage from "@/pages/AccountPage"
import LoginPage from "@/pages/LoginPage"
import { AggregateStat } from "@/components/AggregateStat"
import { BaselineDiff, PolicyDiff } from "@/components/RecommendationDiff"
import {
  diffBaselineSets,
  diffPolicySets,
  previewBaselineImpact,
} from "@/lib/domain/recommendation"
import { buildPeriod } from "@/lib/domain/periods"
import {
  analysisSessions,
  baselineSets,
  policySets,
  recommendationRuns,
} from "@/lib/mock/seed"

const pages: [string, string, React.ComponentType][] = [
  ["ダッシュボード", "/dashboard", DashboardPage],
  ["顧客一覧", "/customers", CustomersPage],
  ["顧客詳細", "/customers/ds_010", CustomerDetailPage],
  // 履歴が上限を超える顧客。打ち切り表示と全件への導線を通す
  ["顧客詳細(履歴12件)", "/customers/ds_036", CustomerDetailPage],
  ["分析履歴(全件)", "/customers/ds_036/analyses", CustomerAnalysesPage],
  // 分析詳細は独立ページ。顧客詳細の一覧からここへ送る
  ["分析詳細", "/customers/ds_036/analyses/__SESSION__", AnalysisDetailPage],
  ["分析", "/analysis", AnalysisPage],
  ["会社・店舗", "/organizations", OrganizationsPage],
  ["care動画", "/care", CareVideosPage],
  ["推奨設定", "/recommendation", RecommendationPage],
  ["画像・保持", "/retention", RetentionPage],
  ["監査", "/audit", AuditPage],
  ["ブランド設定", "/branding", BrandingPage],
  ["アカウント", "/account", AccountPage],
  ["ログイン", "/login", LoginPage],
]

/** 分析詳細は実在する session を指さないと fallback が描かれるだけで検証にならない。 */
const sampleSessionId = analysisSessions.find((s) => s.dataSubjectId === "ds_036")?.id
if (!sampleSessionId) throw new Error("ds_036 の分析が seed に無い")

let failed = 0
for (const [name, rawPath, Page] of pages) {
  const path = rawPath.replace("__SESSION__", sampleSessionId)
  try {
    const html = renderToString(
      <SessionProvider>
        <NotificationsProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              {/* param が入らないと fallback が描かれるだけで検証にならない */}
              <Route path="/customers/:dataSubjectId/analyses/:sessionId" element={<Page />} />
              <Route path="/customers/:dataSubjectId/analyses" element={<Page />} />
              <Route path="/customers/:dataSubjectId" element={<Page />} />
              <Route path="*" element={<Page />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
        </NotificationsProvider>
      </SessionProvider>
    )
    const len = html.length
    if (len < 200) { failed++; console.log(`  FAIL  ${name} — 出力が短すぎる (${len})`) }
    else console.log(`  ok    ${name.padEnd(12)} ${len} bytes`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${name} — ${(e as Error).message.split("\n")[0]}`)
  }
}
/*
  role で出し分ける画面は、本部だけ描いても分岐が通らない。
  🔴 care 画面は審査の列・ボタンを本部にしか出さないので、他 role でも描いておく。
*/
{
  const roles: [string, string][] = [
    ["契約企業管理者", "acc_company_admin"],
    ["店舗管理者", "acc_store_admin"],
  ]
  for (const [label, accountId] of roles) {
    for (const [name, path, Page] of [
      ["care動画", "/care", CareVideosPage],
      ["顧客一覧", "/customers", CustomersPage],
    ] as [string, string, React.ComponentType][]) {
      try {
        const html = renderToString(
          <SessionProvider initialAccountId={accountId}>
            <NotificationsProvider>
              <TooltipProvider>
                <MemoryRouter initialEntries={[path]}>
                  <Routes>
                    <Route path="*" element={<Page />} />
                  </Routes>
                </MemoryRouter>
              </TooltipProvider>
            </NotificationsProvider>
          </SessionProvider>
        )
        if (html.length < 200) {
          failed++
          console.log(`  FAIL  ${label} / ${name} — 出力が短すぎる (${html.length})`)
        } else console.log(`  ok    ${`${label} / ${name}`.padEnd(20)} ${html.length} bytes`)
      } catch (e) {
        failed++
        console.log(`  FAIL  ${label} / ${name} — ${(e as Error).message.split("\n")[0]}`)
      }
    }
  }
}

/*
  ダイアログの中身は閉じている間 render されないので、ページ巡回では通らない。
  推奨設定の差分・影響 preview は中身が重いので、部品単体でも 1 度描いておく。
*/
{
  const activeBaseline = baselineSets.find((s) => s.status === "active")!
  const draftBaseline = baselineSets.find((s) => s.status === "draft")!
  const activePolicy = policySets.find((s) => s.status === "active")!
  const otherPolicy = policySets.find((s) => s.status !== "active")!
  const impact = previewBaselineImpact(
    recommendationRuns,
    analysisSessions,
    activeBaseline,
    draftBaseline,
    buildPeriod("last_12m")
  )
  const parts: [string, React.ReactElement][] = [
    [
      "基準値の差分",
      <BaselineDiff
        rows={diffBaselineSets(activeBaseline, draftBaseline)}
        fromVersion={activeBaseline.version}
        toVersion={draftBaseline.version}
      />,
    ],
    [
      "方針の差分",
      <PolicyDiff
        rows={diffPolicySets(activePolicy, otherPolicy)}
        fromVersion={activePolicy.version}
      />,
    ],
    [
      "影響 preview の集計",
      <AggregateStat
        title="推奨動作が入れ替わる割合"
        aggregate={impact.aggregate}
        format="rate"
      />,
    ],
  ]
  for (const [name, node] of parts) {
    try {
      const html = renderToString(<TooltipProvider>{node}</TooltipProvider>)
      if (html.length < 100) {
        failed++
        console.log(`  FAIL  ${name} — 出力が短すぎる (${html.length})`)
      } else console.log(`  ok    ${name.padEnd(12)} ${html.length} bytes`)
    } catch (e) {
      failed++
      console.log(`  FAIL  ${name} — ${(e as Error).message.split("\n")[0]}`)
    }
  }
}

console.log(failed === 0 ? "\n✅ 全ページ render OK" : `\n❌ ${failed} ページ失敗`)
process.exit(failed === 0 ? 0 : 1)
