import { renderToString } from "react-dom/server"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { SessionProvider } from "@/contexts/SessionContext"
import { TooltipProvider } from "@/components/ui/tooltip"
import DashboardPage from "@/pages/DashboardPage"
import CustomersPage from "@/pages/CustomersPage"
import CustomerDetailPage from "@/pages/CustomerDetailPage"
import AnalysisPage from "@/pages/AnalysisPage"
import OrganizationsPage from "@/pages/OrganizationsPage"
import CareVideosPage from "@/pages/CareVideosPage"
import RecommendationPage from "@/pages/RecommendationPage"
import RetentionPage from "@/pages/RetentionPage"
import AuditPage from "@/pages/AuditPage"
import AccountPage from "@/pages/AccountPage"
import LoginPage from "@/pages/LoginPage"

const pages: [string, string, React.ComponentType][] = [
  ["ダッシュボード", "/dashboard", DashboardPage],
  ["顧客一覧", "/customers", CustomersPage],
  ["顧客詳細", "/customers/ds_010", CustomerDetailPage],
  ["分析", "/analysis", AnalysisPage],
  ["会社・店舗", "/organizations", OrganizationsPage],
  ["care動画", "/care", CareVideosPage],
  ["推奨設定", "/recommendation", RecommendationPage],
  ["画像・保持", "/retention", RetentionPage],
  ["監査", "/audit", AuditPage],
  ["アカウント", "/account", AccountPage],
  ["ログイン", "/login", LoginPage],
]

let failed = 0
for (const [name, path, Page] of pages) {
  try {
    const html = renderToString(
      <SessionProvider>
        <TooltipProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/customers/:dataSubjectId" element={<Page />} />
              <Route path="*" element={<Page />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
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
console.log(failed === 0 ? "\n✅ 全ページ render OK" : `\n❌ ${failed} ページ失敗`)
process.exit(failed === 0 ? 0 : 1)
