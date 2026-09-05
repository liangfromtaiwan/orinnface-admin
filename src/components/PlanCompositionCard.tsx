/**
 * プラン構成比
 *
 * ℹ️ 仕様書 v1.0 §6 の正式 KPI ではなく、本部が会員構成を把握するための補助指標。
 * 🔴 B2C 顧客は店舗に紐づかないため、店舗スコープでは意味が変わる。
 *    本部(crossCompany)のみに表示する。
 */

import { Cell, Label, Pie, PieChart } from "recharts"

import { InfoHint } from "@/components/InfoHint"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { PlanComposition } from "@/lib/domain/plans"

const config = {
  count: { label: "ユーザー数" },
  guest: { label: "Guest", color: "var(--chart-1)" },
  member: { label: "Member", color: "var(--chart-2)" },
  premium: { label: "Premium", color: "var(--chart-3)" },
} satisfies ChartConfig

export function PlanCompositionCard({
  composition,
}: {
  composition: PlanComposition
}) {
  const { slices, total } = composition
  const data = slices.map((s) => ({ ...s, fill: `var(--color-${s.plan})` }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base font-medium">
          プラン構成比
          <InfoHint label="プラン構成比について">
            <p className="font-medium text-foreground">プラン構成比</p>
            <p className="mt-1">
              現在の会員プラン別ユーザー数です。B2C 顧客は店舗に紐づかないため、
              本部スコープでのみ表示します。
            </p>
            <p className="mt-1">
              未登録顧客(未連携分析のみ)は Guest に含めています。
            </p>
            <p className="mt-2 border-t pt-2 text-muted-foreground">
              🔴 店舗連携済みの顧客は機能面では Premium 相当として扱いますが、
              本人課金が発生しないため、ここでは**契約プランのまま**数えています。
              課金の実態を見る指標なので実効プランでは集計しません。
            </p>
          </InfoHint>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <ChartContainer config={config} className="mx-auto aspect-square h-48">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              strokeWidth={2}
              // セグメント間に背景色の隙間を入れて境界を明示する
              stroke="var(--card)"
              paddingAngle={2}
            >
              {data.map((s) => (
                <Cell key={s.plan} fill={s.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox)) return null
                  const { cx, cy } = viewBox as { cx: number; cy: number }
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan
                        x={cx}
                        y={cy - 6}
                        className="fill-foreground text-2xl font-semibold tabular-nums"
                      >
                        {total.toLocaleString("ja-JP")}
                      </tspan>
                      <tspan x={cx} y={cy + 14} className="fill-muted-foreground text-xs">
                        名
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* 4 系列以下なので凡例に実数と比率を直接書く(色だけに頼らない) */}
        <ul className="space-y-1 text-xs">
          {slices.map((s) => (
            <li key={s.plan} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: `var(--chart-${PLAN_CHART_INDEX[s.plan]})` }}
              />
              <span className="flex-1 text-muted-foreground">{s.label}</span>
              <span className="tabular-nums">{s.count}</span>
              <span className="w-10 text-right text-muted-foreground tabular-nums">
                {total === 0 ? "—" : `${((s.count / total) * 100).toFixed(0)}%`}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

const PLAN_CHART_INDEX = { guest: 1, member: 2, premium: 3 } as const
