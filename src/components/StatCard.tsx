import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatDelta = {
  // -1 to 1 (e.g., 0.023 → +2.3pt)
  value: number
  label: string
}

export type StatCardProps = {
  title: string
  value: string
  delta?: StatDelta
  description?: string
}

export function StatCard({ title, value, delta, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {delta ? (
          <DeltaLine delta={delta} />
        ) : description ? (
          <div className="mt-2 text-xs text-muted-foreground">{description}</div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function DeltaLine({ delta }: { delta: StatDelta }) {
  const pt = delta.value * 100
  const direction = Math.abs(pt) < 0.05 ? "flat" : pt > 0 ? "up" : "down"

  const Icon =
    direction === "up"
      ? ArrowUpIcon
      : direction === "down"
        ? ArrowDownIcon
        : ArrowRightIcon

  const color =
    direction === "up"
      ? "text-emerald-600"
      : direction === "down"
        ? "text-destructive"
        : "text-muted-foreground"

  const sign = pt > 0 ? "+" : ""
  return (
    <div className={cn("mt-2 flex items-center gap-1 text-xs", color)}>
      <Icon className="size-3" />
      <span className="tabular-nums">
        {sign}
        {pt.toFixed(1)}pt
      </span>
      <span className="text-muted-foreground">{delta.label}</span>
    </div>
  )
}
