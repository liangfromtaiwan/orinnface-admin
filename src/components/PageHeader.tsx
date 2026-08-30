import type { Period } from "@/lib/domain/kpi"
import type { ReactNode } from "react"

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** 仕様上の注意を画面に固定表示するための注記ブロック。 */
export function SpecNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * 集計期間を画面に一度だけ表示する (仕様書 v1.0 §6)。
 *
 * 🔴 AggregateStat はカードごとに期間を出さないため、
 *    AggregateStat を使う画面には必ずこれを置くこと。
 */
export function PeriodBanner({
  period,
  note,
}: {
  period: Period
  note?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b pb-2 text-sm">
      <span className="text-muted-foreground">集計期間</span>
      <span className="font-medium tabular-nums">{period.label}</span>
      {note ? (
        <span className="text-xs text-muted-foreground">{note}</span>
      ) : null}
    </div>
  )
}
