"use client"

import * as React from "react"
import {
  ActivityIcon,
  LayoutDashboardIcon,
  MousePointerClickIcon,
  Settings2Icon,
  UsersIcon,
  VideoIcon,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { CompanySwitcher } from "@/components/CompanySwitcher"
import { NavMain, type NavItem } from "@/components/nav-main"
import { NavUser, type NavUserData } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  useUserProfiles,
  type UserProfile,
} from "@/contexts/UserProfilesContext"

const navItems: NavItem[] = [
  { title: "ダッシュボード", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  // b2b は個人情報非開示のため ユーザー画面 を表示しない
  {
    title: "ユーザー",
    url: "/users",
    icon: <UsersIcon />,
    hiddenFor: ["b2b"],
  },
  { title: "コンテンツ分析", url: "/content", icon: <VideoIcon /> },
  // b2b は個別プラン変更履歴を見られないため ステータス を表示しない
  {
    title: "ステータス",
    url: "/status",
    icon: <ActivityIcon />,
    hiddenFor: ["b2b"],
  },
  // b2b は個別 CTA 効果(コンバージョン履歴)を見られない
  {
    title: "CTA 分析",
    url: "/cta-analysis",
    icon: <MousePointerClickIcon />,
    hiddenFor: ["b2b"],
  },
  { title: "設定", url: "/settings", icon: <Settings2Icon /> },
]

// profile から sidebar footer に表示する情報を組み立てる。
// 上段(name)= displayName、下段(role)= メンバー管理上の Role
//   admin: Owner / Admin / Viewer
//   OEM / BtoB: 管理者 / メンバー
function buildNavUser(profile: UserProfile): NavUserData {
  return {
    name: profile.displayName || profile.name || "ユーザー",
    role: profile.role || "—",
    initial: (profile.displayName || profile.name || "?").slice(0, 1),
    avatarUrl: profile.avatarUrl || undefined,
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { getProfile } = useUserProfiles()
  const type = searchParams.get("type") ?? "admin"
  const companyId = Number(searchParams.get("company_id") ?? 0)

  const visibleNavItems = navItems.filter(
    (item) => !item.hiddenFor?.includes(type)
  )
  const navUser = buildNavUser(getProfile(`${type}:${companyId}`))

  function handleAccountClick() {
    const qs = searchParams.toString()
    navigate(qs ? `/account?${qs}` : "/account")
  }

  function handleLogoutClick() {
    // 実認証は v2 で実装。ここでは toast + /login へ遷移するのみ。
    toast.success("ログアウトしました")
    navigate("/login")
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <CompanySwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={visibleNavItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={navUser}
          onAccountClick={handleAccountClick}
          onLogoutClick={handleLogoutClick}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
