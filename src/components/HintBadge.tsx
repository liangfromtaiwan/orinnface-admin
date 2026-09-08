/**
 * 説明つきの状態バッジ
 *
 * 「品質注意」「離脱リスク」「再同意待ち」は、出る条件を知らないと
 * 何を意味するのか分からない。バッジに hover / focus で条件を出す。
 *
 * 説明文は badge-hints.tsx に置く(fast-refresh のため component と分離)。
 */

import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function HintBadge({
  hint,
  children,
  className,
}: {
  hint: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          /*
            顧客一覧の行は Link の after:inset-0 で全体が当たり判定になっている。
            z-10 で覆いより前に出さないと hover が届かず tooltip が出ない。
            tabIndex はキーボードでも説明を読めるようにするため。
          */
          className={cn(
            "relative z-10 cursor-help border-amber-300 px-1 py-0 text-[10px] text-amber-700",
            className
          )}
          tabIndex={0}
        >
          {children}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}
