import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { Layout } from "@/components/Layout"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SessionProvider } from "@/contexts/SessionContext"
import AccountPage from "./pages/AccountPage"
import AnalysisPage from "./pages/AnalysisPage"
import AuditPage from "./pages/AuditPage"
import CareVideosPage from "./pages/CareVideosPage"
import CustomerDetailPage from "./pages/CustomerDetailPage"
import CustomersPage from "./pages/CustomersPage"
import DashboardPage from "./pages/DashboardPage"
import LoginPage from "./pages/LoginPage"
import OrganizationsPage from "./pages/OrganizationsPage"
import RecommendationPage from "./pages/RecommendationPage"
import RetentionPage from "./pages/RetentionPage"
import RequireScreen from "./components/RequireScreen"

/**
 * 画面構成は仕様書 v1.0 §4。
 * 🔴 RequireScreen は画面の出し分けであり、これ自体をアクセス制御の根拠にしない。
 *    実 API 接続時は各 query で membership / store_data_link / scope を再検証する。
 */
export default function App() {
  return (
    <SessionProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            {/* /login は Layout(Sidebar)外で表示 */}
            <Route path="/login" element={<LoginPage />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <RequireScreen screen="dashboard">
                    <DashboardPage />
                  </RequireScreen>
                }
              />
              <Route
                path="/organizations"
                element={
                  <RequireScreen screen="organizations">
                    <OrganizationsPage />
                  </RequireScreen>
                }
              />
              <Route
                path="/customers"
                element={
                  <RequireScreen screen="customers">
                    <CustomersPage />
                  </RequireScreen>
                }
              />
              <Route
                path="/customers/:dataSubjectId"
                element={
                  <RequireScreen screen="customers">
                    <CustomerDetailPage />
                  </RequireScreen>
                }
              />
              <Route
                path="/analysis"
                element={
                  <RequireScreen screen="analysis">
                    <AnalysisPage />
                  </RequireScreen>
                }
              />
              <Route
                path="/care"
                element={
                  <RequireScreen screen="care">
                    <CareVideosPage />
                  </RequireScreen>
                }
              />
              <Route
                path="/recommendation"
                element={
                  <RequireScreen screen="recommendation">
                    <RecommendationPage />
                  </RequireScreen>
                }
              />
              <Route
                path="/retention"
                element={
                  <RequireScreen screen="retention">
                    <RetentionPage />
                  </RequireScreen>
                }
              />
              <Route
                path="/audit"
                element={
                  <RequireScreen screen="audit">
                    <AuditPage />
                  </RequireScreen>
                }
              />
              <Route path="/account" element={<AccountPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </SessionProvider>
  )
}
