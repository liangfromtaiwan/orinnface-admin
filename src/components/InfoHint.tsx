/**
 * 指標の定義や集計条件を、タイトル横の i アイコンから開いて見せる。
 *
 * 仕様書 v1.0 §6 は対象条件の表示を求めているが、
 * 常時表示すると数値より説明文のほうが目立ってしまうため、
 * 既定では畳んでおき、クリックで開く形にしている(削除はしない)。
 */

import { InfoIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function InfoHint({
  children,
  label = "説明を表示",
  className,
}: {
  children: ReactNode
  /** スクリーンリーダー向けのボタン名。 */
  label?: string
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            className
          )}
        >
          <InfoIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="text-xs leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  )
}
