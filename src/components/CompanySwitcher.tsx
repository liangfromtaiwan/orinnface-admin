"use client"

import { useSearchParams } from "react-router-dom"
import {
  Building2Icon,
  ChevronsUpDownIcon,
  ShieldIcon,
  SparklesIcon,
  StoreIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { companies, getCompany } from "@/lib/mock-data/companies"
import type {
  Company,
  CompanySubType,
  CompanyType,
} from "@/lib/mock-data/types"

const typeLabel: Record<CompanyType, string> = {
  admin: "運営管理",
  oem: "OEM",
  b2b: "BtoB企業",
}

function LogoFor({ subType }: { subType: CompanySubType }) {
  if (subType === "operator") return <ShieldIcon className="size-4" />
  if (subType === "shop") return <StoreIcon className="size-4" />
  if (subType === "influencer") return <SparklesIcon className="size-4" />
  return <Building2Icon className="size-4" />
}

export function CompanySwitcher() {
  const { isMobile } = useSidebar()
  const [searchParams, setSearchParams] = useSearchParams()

  const companyIdRaw = searchParams.get("company_id")
  const companyId = companyIdRaw != null ? Number(companyIdRaw) : 0
  const active: Company = getCompany(companyId) ?? companies[0]

  function selectCompany(c: Company) {
    const next = new URLSearchParams(searchParams)
    next.set("company_id", String(c.id))
    next.set("type", c.type)
    setSearchParams(next)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <LogoFor subType={active.subType} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{active.name}</span>
                <span className="truncate text-xs">
                  {typeLabel[active.type]}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              視点切替
            </DropdownMenuLabel>
            {companies.map((c, index) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => selectCompany(c)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <LogoFor subType={c.subType} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {typeLabel[c.type]}
                  </div>
                </div>
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              現在: ?company_id={active.id}&amp;type={active.type}
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
