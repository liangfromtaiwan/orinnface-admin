/**
 * 説明つきの状態バッジ
 *
 * 「品質注意」「離脱リスク」は、出る条件を知らないと
 * 何を意味するのか分からない。バッジに hover / focus で条件を出す。
 *
 * 説明文は badge-hints.ts に置く(fast-refresh のため component と分離)。
 */

import type { ReactNode } from "react"

import type { BadgeHint } from "@/components/badge-hints"
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
  hint: BadgeHint
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
      {/*
        TooltipContent の基底は「一行の短いラベル」向けに inline-flex +
        items-center で組まれている。段落を直接置くと flex item が横に並び、
        見出しが 1 文字ずつ折り返して読めなくなる。
        中身は必ず 1 つの block で包んでから縦に積む。
      */}
      <TooltipContent className="max-w-72">
        <div className="space-y-1 py-0.5">
          <p className="font-semibold">{hint.title}</p>
          {hint.lines.map((line) => (
            <p key={line} className="leading-relaxed text-background/80">
              {line}
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
