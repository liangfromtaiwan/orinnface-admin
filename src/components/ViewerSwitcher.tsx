/**
 * デモ用のアカウント切替 (実認証実装時に削除する)。
 *
 * role は accounts の単一列ではなく membership から解決されるため、
 * ここでは「どの account でログインしているか」だけを切り替える。
 */

import { BuildingIcon, CheckIcon, ChevronsUpDownIcon, ShieldCheckIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useSession } from "@/contexts/session-context"
import { resolveScope } from "@/lib/domain/scope"
import { ROLE_LABEL, ROLE_REQUIRES_2FA } from "@/lib/domain/types"
import { stores } from "@/lib/mock/seed"

export function ViewerSwitcher() {
  const { account, scope, accounts, switchAccount } = useSession()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <BuildingIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">OrinnFACE 管理画面</span>
                <span className="truncate text-xs text-muted-foreground">
                  {ROLE_LABEL[scope.role]}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72" align="start" side="bottom">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              ログインアカウント(デモ切替)
            </DropdownMenuLabel>
            {accounts.map((a) => {
              const s = resolveScope(a, stores)
              const needs2fa = ROLE_REQUIRES_2FA[s.role]
              return (
                <DropdownMenuItem
                  key={a.id}
                  onClick={() => switchAccount(a.id)}
                  className="gap-2"
                >
                  <div className="grid flex-1">
                    <span className="text-sm">{a.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABEL[s.role]}
                      {s.crossCompany
                        ? " / 全社横断"
                        : s.storeIds.length > 0
                          ? ` / ${s.storeIds.length}店舗`
                          : ""}
                    </span>
                    {needs2fa && !a.twoFactorEnabled ? (
                      <span className="text-[11px] text-destructive">
                        2FA 必須ロールですが未設定
                      </span>
                    ) : null}
                  </div>
                  {needs2fa ? (
                    <ShieldCheckIcon className="size-3.5 text-muted-foreground" />
                  ) : null}
                  {a.id === account.id ? <CheckIcon className="size-4" /> : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
