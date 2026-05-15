import { Link, useLocation, useSearchParams } from "react-router-dom"
import { ChevronRightIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export type NavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  items?: { title: string; url: string }[]
  // ?type= が一致する視点で非表示にする。例:["b2b"] は b2b 視点で非表示
  hiddenFor?: string[]
}

function isUrlActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/"
  return pathname === url || pathname.startsWith(url + "/")
}

export function NavMain({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  // 視点切替の context(?company_id / ?type)を nav 遷移時に保持する
  const search = searchParams.toString()
  const withSearch = (url: string) =>
    search ? `${url}?${search}` : url

  return (
    <SidebarGroup>
      <SidebarGroupLabel>メニュー</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const active = isUrlActive(pathname, item.url)

          if (!item.items || item.items.length === 0) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={active}
                >
                  <Link to={withSearch(item.url)}>
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={active}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} isActive={active}>
                    {item.icon}
                    <span>{item.title}</span>
                    <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === subItem.url}
                        >
                          <Link to={withSearch(subItem.url)}>
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
