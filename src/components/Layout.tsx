import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/components/app-sidebar"
import { NotificationBell } from "@/components/NotificationBell"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4
                           transition-[width] ease-linear">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            {/*
              🔴 公開 URL で確認してもらうので、ここに出ている数値・氏名・店舗が
                 架空のものだと常に分かるようにする(吉田さん指摘 2026-09-25)。
                 ページを移っても消えないよう、ヘッダーに常設する。
            */}
            <span
              className="truncate rounded-sm border border-dashed px-2 py-0.5 text-xs text-muted-foreground"
              title="画面に出ている氏名・店舗名・数値はすべて架空のサンプルです。メールアドレスも文書用に予約された example.jp を使っています。"
            >
              デモ環境・架空のサンプルデータ
            </span>
          </div>
          <NotificationBell />
        </header>
        {/* min-w-0: 中の表が広くても、この列は画面幅を超えない */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
