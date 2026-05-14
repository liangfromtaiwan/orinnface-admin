"use client"

import * as React from "react"
import {
  ActivityIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  UsersIcon,
  VideoIcon,
} from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { CompanySwitcher } from "@/components/CompanySwitcher"
import { NavMain, type NavItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

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
  { title: "設定", url: "/settings", icon: <Settings2Icon /> },
]

const adminUser = {
  name: "管理者",
  email: "admin@orinnme.jp",
  avatar: "",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"
  const visibleNavItems = navItems.filter(
    (item) => !item.hiddenFor?.includes(type)
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <CompanySwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={visibleNavItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={adminUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
