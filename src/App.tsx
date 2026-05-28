import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { Layout } from "@/components/Layout"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CompaniesProvider } from "@/contexts/CompaniesContext"
import { UserProfilesProvider } from "@/contexts/UserProfilesContext"
import DashboardPage from "./pages/DashboardPage"
import UsersPage from "./pages/UsersPage"
import UserDetailPage from "./pages/UserDetailPage"
import ContentPage from "./pages/ContentPage"
import StatusPage from "./pages/StatusPage"
import CTAAnalysisPage from "./pages/CTAAnalysisPage"
import SettingsPage from "./pages/SettingsPage"
import LoginPage from "./pages/LoginPage"
import AccountPage from "./pages/AccountPage"

export default function App() {
  return (
    <CompaniesProvider>
      <UserProfilesProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            {/* /login は Layout(Sidebar)外で表示 */}
            <Route path="/login" element={<LoginPage />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/users/:id" element={<UserDetailPage />} />
              <Route path="/content" element={<ContentPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/cta-analysis" element={<CTAAnalysisPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
      </UserProfilesProvider>
    </CompaniesProvider>
  )
}
