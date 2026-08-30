import * as React from "react"
import {
  BuildingIcon,
  ClipboardListIcon,
  ImageIcon,
  LayoutDashboardIcon,
  ScanFaceIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { NavMain, type NavItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { ViewerSwitcher } from "@/components/ViewerSwitcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useSession } from "@/contexts/session-context"
import { SCREEN_LABEL, visibleScreens, type ScreenKey } from "@/lib/domain/scope"
import { ROLE_LABEL } from "@/lib/domain/types"

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
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate()
  const { scope, account } = useSession()

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
        <ViewerSwitcher />
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
          onAccountClick={() => navigate("/account")}
          onLogoutClick={handleLogoutClick}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
