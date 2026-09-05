/**
 * 営収シグナル(Premium 推移)
 *
 * ℹ️ 仕様書 v1.0 §6 の正式 KPI ではなく、本部が課金状況を把握するための補助指標。
 *    課金プランは Premium のみ (Guest / Member は無料)。
 *
 * 会員数(ストック)は 24〜29、日次の新規・離脱(フロー)は 0〜3 と桁が違うため、
 * 同じ Y 軸に重ねるとフローが潰れて読めない。二軸は使わず、
 * X 軸を共有した上下 2 段(スモールマルチプル)に分けている。
 */

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { InfoHint } from "@/components/InfoHint"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { PremiumSignalPoint, SignalGranularity } from "@/lib/domain/plans"

const config = {
  premiumTotal: { label: "Premium 会員数", color: "var(--chart-3)" },
  newPremium: { label: "Premium 新規", color: "var(--chart-2)" },
  lostPremium: { label: "Premium 離脱", color: "var(--chart-1)" },
} satisfies ChartConfig

/**
 * 日次は "08-26"、月次は "8月" で表示する。
 * 日次は本数が多いので、収まる本数だけ残るよう間引き幅を点数から決める。
 */
function makeTickFormatter(granularity: SignalGranularity, count: number) {
  if (granularity === "month") return (value: string) => `${Number(value.slice(5))}月`
  const step = Math.max(1, Math.ceil(count / 6))
  return (value: string, index: number) =>
    index % step === 0 ? value.slice(5) : ""
}

export function PremiumSignalCard({
  points,
  periodLabel,
  granularity,
}: {
  points: PremiumSignalPoint[]
  /** 上部の期間 filter に追従する。集計対象を文言に出すために受け取る。 */
  periodLabel: string
  granularity: SignalGranularity
}) {
  const tickFormatter = makeTickFormatter(granularity, points.length)
  const current = points[points.length - 1]?.premiumTotal ?? 0
  const gained = points.reduce((n, p) => n + p.newPremium, 0)
  const lost = points.reduce((n, p) => n + p.lostPremium, 0)
  const net = gained - lost

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base font-medium">
          営収シグナル(Premium 推移)
          <InfoHint label="営収シグナルについて">
            <p className="font-medium text-foreground">営収シグナル</p>
            <p className="mt-1">
              {periodLabel}の Premium 新規 vs 離脱。課金プランは Premium のみのため、
              Guest ⇄ Member の移動は営収に影響せず集計に含めません。
            </p>
            <p className="mt-1">
              新規 = Guest / Member から Premium へ。離脱 = Premium から Guest / Member へ。
            </p>
            <p className="mt-1">
              🔴 店舗連携済みの顧客は機能面では Premium 相当ですが、費用は店舗負担で
              本人課金がないため、この指標には含めていません(契約プランで数えます)。
            </p>
            <p className="mt-2 border-t pt-2 text-muted-foreground">
              会員数(ストック)と新規・離脱(フロー)は桁が違うため、二軸にせず
              X 軸を共有した 2 段に分けて表示しています。
              {granularity === "month"
                ? "期間が長いため月次にまとめています(会員数は各月末の値)。"
                : "日次で表示しています。"}
            </p>
          </InfoHint>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm text-muted-foreground">現在 Premium 会員数</span>
            <span className="text-3xl font-semibold tabular-nums">{current}</span>
            <span className="text-sm text-muted-foreground">名</span>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {periodLabel} 新規 {gained} / 離脱 {lost} / 純増減{" "}
            <span className={net < 0 ? "text-destructive" : undefined}>
              {net > 0 ? "+" : ""}
              {net}
            </span>
          </div>
        </div>

        {/* 上段: 会員数(ストック) */}
        <ChartContainer config={config} className="h-24 w-full">
          <LineChart data={points} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" hide />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={28}
              fontSize={11}
              allowDecimals={false}
              domain={["dataMin - 1", "dataMax + 1"]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="premiumTotal"
              type="monotone"
              stroke="var(--color-premiumTotal)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>

        {/* 下段: 新規 / 離脱(フロー)。X 軸は上段と共有。 */}
        <ChartContainer config={config} className="h-36 w-full">
          <LineChart data={points} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              interval={0}
              tickFormatter={tickFormatter}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={28}
              fontSize={11}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="newPremium"
              type="monotone"
              stroke="var(--color-newPremium)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="lostPremium"
              type="monotone"
              stroke="var(--color-lostPremium)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>

        {/* 系列が 2 つ以上あるため凡例は常設する。 */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(
            [
              ["premiumTotal", "上段"],
              ["newPremium", "下段"],
              ["lostPremium", "下段"],
            ] as const
          ).map(([key, where]) => (
            <li key={key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 rounded-sm"
                style={{ background: config[key].color }}
              />
              {config[key].label}
              <span className="text-[10px]">({where})</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
