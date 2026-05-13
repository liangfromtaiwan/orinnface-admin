"use client"

import * as React from "react"
import {
  ActivityIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  Settings2Icon,
  UsersIcon,
  VideoIcon,
} from "lucide-react"

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
  { title: "ユーザー", url: "/users", icon: <UsersIcon /> },
  { title: "コンテンツ分析", url: "/content", icon: <VideoIcon /> },
  { title: "ステータス", url: "/status", icon: <ActivityIcon /> },
  { title: "文言管理", url: "/messages", icon: <MessageSquareIcon /> },
  { title: "設定", url: "/settings", icon: <Settings2Icon /> },
]

const adminUser = {
  name: "管理者",
  email: "admin@orinnme.jp",
  avatar: "",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <CompanySwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={adminUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
