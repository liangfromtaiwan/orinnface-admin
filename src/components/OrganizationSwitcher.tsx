/**
 * 視点切替 (どの組織を見ているか)
 *
 * 誰でログインしているかで見える範囲はすでに決まっているため、
 * 切替の主語は人ではなく組織にする。
 *
 * 🔴 視点は**表示の絞り込み**であって権限ではない。本部が 1 社に絞っても
 *    operator の capability は失われない (SessionContext を参照)。
 * 🔴 選べるのは自分のスコープ内の企業だけ。本部だけが複数から選べる。
 *    選択肢が 1 つしかない役割では dropdown を出さず、そのまま表示する。
 *
 * ヘッダーは選択中の企業のブランド(表示名・ロゴ・メインカラー)で描く。
 * 本部視点では標準ブランド(orinnFACE)になる。
 */

import { BuildingIcon, CheckIcon, ChevronsUpDownIcon, GlobeIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useSession } from "@/contexts/session-context"
import { readableTextOn } from "@/lib/domain/branding"

const CONTRACT_LABEL = {
  active: "契約中",
  suspended: "停止中",
  terminated: "解約",
} as const

export function OrganizationSwitcher() {
  const {
    scope,
    branding,
    viewCompanyId,
    viewableCompanies,
    setViewCompany,
    stores,
  } = useSession()
  const { isMobile } = useSidebar()

  const current = viewableCompanies.find((c) => c.id === viewCompanyId)
  // 本部だけが全社横断と各社を行き来できる
  const switchable = scope.crossCompany && viewableCompanies.length > 0

  const header = (
    <>
      <div
        className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-md"
        style={{ backgroundColor: branding.mainColor }}
      >
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt="" className="size-full object-contain" />
        ) : current ? (
          <BuildingIcon className="size-4" style={{ color: readableTextOn(branding.mainColor) }} />
        ) : (
          <GlobeIcon className="size-4" style={{ color: readableTextOn(branding.mainColor) }} />
        )}
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">
          {current ? current.name : branding.displayName}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {current
            ? `${stores.length} 店舗`
            : scope.crossCompany
              ? "全社横断"
              : "—"}
        </span>
      </div>
    </>
  )

  if (!switchable) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          {/* 選べる先が無いので押せる見た目にしない */}
          <div className="flex h-12 items-center gap-2 rounded-md px-2 text-sidebar-foreground">
            {header}
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              {header}
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-72"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              視点切替
            </DropdownMenuLabel>

            <DropdownMenuItem onClick={() => setViewCompany(undefined)} className="gap-2">
              <GlobeIcon className="size-4 text-muted-foreground" />
              <div className="grid flex-1">
                <span className="text-sm">本部</span>
                <span className="text-xs text-muted-foreground">全社横断</span>
              </div>
              {!viewCompanyId ? <CheckIcon className="size-4" /> : null}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {viewableCompanies.map((c) => {
              const count = stores.filter((s) => s.companyId === c.id).length
              return (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => setViewCompany(c.id)}
                  className="gap-2"
                >
                  <BuildingIcon className="size-4 text-muted-foreground" />
                  <div className="grid flex-1">
                    <span className="text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {CONTRACT_LABEL[c.contractStatus]}
                      {c.id === viewCompanyId ? ` / ${count} 店舗` : ""}
                    </span>
                  </div>
                  {c.id === viewCompanyId ? <CheckIcon className="size-4" /> : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
