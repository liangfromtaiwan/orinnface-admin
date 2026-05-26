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
import { useCompanies } from "@/contexts/CompaniesContext"
import type { Company } from "@/lib/mock-data/types"

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

// 視点 + company_id から sidebar footer に表示する管理者情報を組み立てる。
// mock 値で UI 確認用、真實実装では JWT claim から取得する。
function buildNavUser(
  type: string,
  company: Company | undefined
): NavUserData {
  if (type === "oem") {
    const isKol = company?.subType === "influencer"
    return {
      name: company ? `${company.name} 管理者` : "OEM 管理者",
      role: isKol ? "OEM(KOL)" : "OEM(店舗)",
      initial: isKol ? "K" : "店",
    }
  }
  if (type === "b2b") {
    return {
      name: company ? `${company.name} HR` : "BtoB HR",
      role: "BtoB クライアント",
      initial: "企",
    }
  }
  // admin
  return {
    name: "OrinnME 田中",
    role: "OrinnME 運営",
    initial: "田",
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { getCompany } = useCompanies()
  const type = searchParams.get("type") ?? "admin"
  const companyId = Number(searchParams.get("company_id") ?? 0)

  const visibleNavItems = navItems.filter(
    (item) => !item.hiddenFor?.includes(type)
  )
  const navUser = buildNavUser(type, getCompany(companyId))

  function handleAccountClick() {
    const qs = searchParams.toString()
    navigate(qs ? `/settings?${qs}` : "/settings")
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
        <NavUser user={navUser} onAccountClick={handleAccountClick} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
