/**
 * 集計値の表示 (仕様書 v1.0 §6)
 *
 * 🔴 平均値・中央値・改善率は母数・期間・対象条件・欠測数・使用 version を
 *    必ず表示する。少数母数を隠さない。
 *    → この component を通すことで、画面ごとの表示漏れを防ぐ。
 *
 * 期間だけはカードに出さない。同一画面の全カードが同じ期間になり冗長なため、
 * 画面上部の <PeriodBanner> で一度だけ表示する。
 * 🔴 AggregateStat を使う画面には必ず PeriodBanner を置くこと(§6 の期間表示要件)。
 */

import { AlertTriangleIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Aggregate } from "@/lib/domain/kpi"
import { cn } from "@/lib/utils"

/** 母数がこれ未満の場合は「少数母数」の注意を添える(隠さずに出す)。 */
const SMALL_SAMPLE_THRESHOLD = 10

type Props = {
  title: string
  aggregate: Aggregate
  /** "rate" は 0-100 の百分率、"count" は実数。 */
  format: "rate" | "count"
  unit?: string
  /** metric_direction が §16 P1 未決の場合に「暫定」を明示する。 */
  provisional?: boolean
  className?: string
}

export function AggregateStat({
  title,
  aggregate,
  format,
  unit,
  provisional,
  className,
}: Props) {
  const { value, numerator, denominator, missing, conditionLabel, version } = aggregate

  const noData = denominator === 0
  const smallSample = denominator > 0 && denominator < SMALL_SAMPLE_THRESHOLD

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {title}
          {provisional ? (
            <span className="rounded-sm border border-amber-300 bg-amber-50 px-1 text-[10px] font-normal text-amber-700">
              暫定
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-semibold tracking-tight tabular-nums">
          {noData ? (
            <span className="text-muted-foreground">—</span>
          ) : format === "rate" ? (
            <>
              {value.toFixed(1)}
              <span className="ml-0.5 text-lg font-normal text-muted-foreground">%</span>
            </>
          ) : (
            <>
              {value.toLocaleString("ja-JP")}
              {unit ? (
                <span className="ml-1 text-lg font-normal text-muted-foreground">
                  {unit}
                </span>
              ) : null}
            </>
          )}
        </div>

        {/* 母数は常に出す。母数 0 でも「0」と書き、値を隠さない。 */}
        <dl className="space-y-0.5 text-xs text-muted-foreground">
          <div className="flex gap-1">
            <dt>母数</dt>
            <dd className="tabular-nums">
              {format === "rate"
                ? `${numerator.toLocaleString("ja-JP")} / ${denominator.toLocaleString("ja-JP")}`
                : denominator.toLocaleString("ja-JP")}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>欠測</dt>
            <dd className="tabular-nums">{missing.toLocaleString("ja-JP")}</dd>
          </div>
          {version ? (
            <div className="flex gap-1">
              <dt>version</dt>
              <dd className="font-mono text-[11px]">{version}</dd>
            </div>
          ) : null}
        </dl>

        <p className="text-[11px] leading-snug text-muted-foreground">
          {conditionLabel}
        </p>

        {smallSample ? (
          <p className="flex items-start gap-1 text-[11px] leading-snug text-amber-700">
            <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
            母数が {SMALL_SAMPLE_THRESHOLD} 件未満です。値のばらつきが大きくなります。
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
