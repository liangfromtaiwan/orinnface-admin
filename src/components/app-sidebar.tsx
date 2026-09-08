import * as React from "react"
import {
  BuildingIcon,
  ClipboardListIcon,
  ImageIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  ScanFaceIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { NavMain, type NavItem } from "@/components/nav-main"
import { NavUser, type SwitchableAccount } from "@/components/nav-user"
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useSession } from "@/contexts/session-context"
import { SCREEN_LABEL, resolveScope, visibleScreens, type ScreenKey } from "@/lib/domain/scope"
import { ROLE_LABEL, ROLE_REQUIRES_2FA } from "@/lib/domain/types"
import { stores } from "@/lib/mock/seed"

/** 画面構成は仕様書 v1.0 §4。表示可否は role の membership で決まる。 */
const SCREEN_ROUTES: Record<ScreenKey, { url: string; icon: React.ReactNode }> = {
  dashboard: { url: "/dashboard", icon: <LayoutDashboardIcon /> },
  organizations: { url: "/organizations", icon: <BuildingIcon /> },
  customers: { url: "/customers", icon: <UsersIcon /> },
  analysis: { url: "/analysis", icon: <ScanFaceIcon /> },
  care: { url: "/care", icon: <VideoIcon /> },
  recommendation: { url: "/recommendation", icon: <SlidersHorizontalIcon /> },
  retention: { url: "/retention", icon: <ImageIcon /> },
  audit: { url: "/audit", icon: <ClipboardListIcon /> },
  branding: { url: "/branding", icon: <PaletteIcon /> },
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate()
  const { scope, account, accounts, switchAccount } = useSession()

  /* デモ用。role は membership から解決するので、ここでも resolveScope を通す。 */
  const switchableAccounts: SwitchableAccount[] = accounts.map((a) => {
    const s = resolveScope(a, stores)
    return {
      id: a.id,
      name: a.displayName,
      detail:
        ROLE_LABEL[s.role] +
        (s.crossCompany
          ? " / 全社横断"
          : s.storeIds.length > 0
            ? ` / ${s.storeIds.length}店舗`
            : ""),
      missingTwoFactor: ROLE_REQUIRES_2FA[s.role] && !a.twoFactorEnabled,
    }
  })

  const navItems: NavItem[] = visibleScreens(scope).map((key) => ({
    title: SCREEN_LABEL[key],
    url: SCREEN_ROUTES[key].url,
    icon: SCREEN_ROUTES[key].icon,
  }))

  function handleLogoutClick() {
    // 実認証は未実装。ここでは /login へ遷移するのみ。
    toast.success("ログアウトしました")
    navigate("/login")
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: account.displayName,
            role: ROLE_LABEL[scope.role],
            initial: account.displayName.slice(0, 1),
          }}
          accounts={switchableAccounts}
          currentAccountId={account.id}
          onSwitchAccount={switchAccount}
          onAccountClick={() => navigate("/account")}
          onLogoutClick={handleLogoutClick}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
