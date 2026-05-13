import { StatCard, type StatDelta } from "@/components/StatCard"
import { globalAnalytics } from "@/lib/mock-data/analytics"
import type { DailyAnalytics } from "@/lib/mock-data/types"
import { hasFatigueGap } from "@/lib/mock-data/types"
import { users } from "@/lib/mock-data/users"

function pct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

function weightedAvg(rows: DailyAnalytics[], key: keyof DailyAnalytics): number {
  const totalDau = rows.reduce((s, r) => s + r.dau, 0)
  if (totalDau === 0) return 0
  return (
    rows.reduce((s, r) => s + (r[key] as number) * r.dau, 0) / totalDau
  )
}

function deltaVsLastWeek(
  series: DailyAnalytics[],
  key: keyof DailyAnalytics
): StatDelta {
  const today = series[series.length - 1][key] as number
  const lastWeek = series[series.length - 8][key] as number
  return {
    value: today - lastWeek,
    label: "前週同曜日比",
  }
}

function buildStats() {
  const last30 = globalAnalytics
  const today = last30[last30.length - 1]

  const last7 = last30.slice(-7)
  const prior7 = last30.slice(-14, -7)
  const retentionThisWeek = weightedAvg(last7, "retentionRate")
  const retentionPriorWeek = weightedAvg(prior7, "retentionRate")

  const concordanceCount = users.filter((u) => !hasFatigueGap(u)).length
  const concordanceRate = concordanceCount / users.length

  return [
    {
      title: "今日の再分析率",
      value: pct(today.reanalysisRate),
      delta: deltaVsLastWeek(last30, "reanalysisRate"),
    },
    {
      title: "今週の継続率",
      value: pct(retentionThisWeek),
      delta: {
        value: retentionThisWeek - retentionPriorWeek,
        label: "前週比",
      },
    },
    {
      title: "今日のケア実行率",
      value: pct(today.careExecutionRate),
      delta: deltaVsLastWeek(last30, "careExecutionRate"),
    },
    {
      title: "主観とAI一致率",
      value: pct(concordanceRate),
      description: `現在のユーザー ${users.length} 名のうち、落差 < 2 段階 = ${concordanceCount} 名`,
    },
  ] as const
}

export function AdminDashboard() {
  const stats = buildStats()

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ダッシュボード</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          OrinnME 全体の主要指標と推移
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </section>
    </div>
  )
}
