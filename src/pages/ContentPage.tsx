import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { useSearchParams } from "react-router-dom"

import { ChartCard } from "@/components/ChartCard"
import { StatCard } from "@/components/StatCard"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCompanies } from "@/contexts/CompaniesContext"
import { VIDEO_CATEGORY_LABEL } from "@/lib/mock-data/types"
import {
  allViewRecords,
  getAllVideoStats,
  getViewsByCompany,
  groupVideosByDurationBucket,
  videos,
} from "@/lib/mock-data/videos"

function pct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

const durationChartConfig: ChartConfig = {
  completionRate: { label: "完遂率", color: "var(--chart-1)" },
}

export default function ContentPage() {
  const [searchParams] = useSearchParams()
  const { getCompany } = useCompanies()
  const type = searchParams.get("type") ?? "admin"
  const companyIdRaw = searchParams.get("company_id")
  const companyId = companyIdRaw != null ? Number(companyIdRaw) : 0
  const company = type !== "admin" ? getCompany(companyId) : null

  // 視点に応じた view records filter
  const records =
    type === "admin" ? allViewRecords : getViewsByCompany(companyId)

  // KPI 集計
  const totalVideos = videos.length
  const totalViews = records.length
  const completedViews = records.filter((r) => r.completed).length
  const reanalyzedViews = records.filter((r) => r.reanalyzedWithin24h).length

  const completionRate = totalViews === 0 ? 0 : completedViews / totalViews
  const reanalysisRate =
    completedViews === 0 ? 0 : reanalyzedViews / completedViews

  // 動画別 stats(視聴数で降順)
  const videoStats = getAllVideoStats(records)
  const ranked = videos
    .map((v, i) => ({ video: v, stats: videoStats[i] }))
    .sort((a, b) => b.stats.viewCount - a.stats.viewCount)

  // 動画尺別 bucket stats(6 段階定義、但只顯示有 catalog 動画的 bucket)
  // 将来動画追加で新 bucket が catalog に乗ったら自動的に表示される
  const bucketStats = groupVideosByDurationBucket(records).filter(
    (b) => b.videoCount > 0
  )
  // 30 秒以下 = オレンジ系、30 秒〜1 分 = グリーン系で固定
  // BarChart「動画尺別 完遂率」と Pie「動画尺の選択比率」で同じ色を共有
  const BUCKET_COLOR_MAP: Record<string, string> = {
    "0-30s": "oklch(0.646 0.222 41.116)",
    "30-60s": "oklch(0.6 0.118 184.704)",
  }
  const bucketChartData = bucketStats.map((b, i) => {
    const completedCount = Math.round(b.viewCount * b.completionRate)
    return {
      label: b.bucket.label,
      completionRate: b.completionRate * 100,
      viewCount: b.viewCount,
      completedCount,
      videoCount: b.videoCount,
      fill: BUCKET_COLOR_MAP[b.bucket.key] ?? `var(--chart-${i + 1})`,
    }
  })

  // 動画尺の選択比率 Pie 用データ(viewCount を割合表示)
  const bucketRatioData = bucketStats.map((b, i) => ({
    label: b.bucket.label,
    viewCount: b.viewCount,
    fill: BUCKET_COLOR_MAP[b.bucket.key] ?? `var(--chart-${i + 1})`,
  }))
  const bucketRatioConfig: ChartConfig = Object.fromEntries(
    bucketStats.map((b, i) => [
      b.bucket.label,
      {
        label: b.bucket.label,
        color: BUCKET_COLOR_MAP[b.bucket.key] ?? `var(--chart-${i + 1})`,
      },
    ])
  )
  const bucketRatioTotal = bucketRatioData.reduce(
    (s, d) => s + d.viewCount,
    0
  )

  const stats = [
    {
      title: "動画本数",
      value: `${totalVideos} 本`,
      description: "5 カテゴリ × 2 尺(30/60秒)",
    },
    {
      title: "累計視聴回数",
      value: `${totalViews} 件`,
      description: "過去 30 日間",
    },
    {
      title: "平均完遂率",
      value: pct(completionRate),
      description: `完遂 ${completedViews} 件 / 視聴 ${totalViews} 件`,
    },
    {
      title: "ケア後 再分析率",
      value: pct(reanalysisRate),
      description: `完遂 ${completedViews} 件中、24h 内再分析 ${reanalyzedViews} 件`,
    },
  ] as const

  const subtitle = (() => {
    if (type === "admin") return "全提供先における動画利用状況"
    if (type === "oem")
      return `${company?.name ?? "—"} 自社ユーザーの動画利用`
    return `${company?.name ?? "—"} 員工の動画利用(集計のみ)`
  })()

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            コンテンツ分析
          </h1>
          {type === "b2b" && (
            <Badge variant="outline">BtoB 集計(個人情報非表示)</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="動画尺別 完遂率"
        description="動画の長さによる完遂率の傾向。catalog に該当尺の動画がある bucket のみ表示。"
      >
        <ChartContainer
          config={durationChartConfig}
          className="aspect-auto h-[300px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={bucketChartData}
            margin={{ left: 8, right: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
              fontSize={11}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as (typeof bucketChartData)[number]
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                    <div className="mb-1 font-medium">{d.label}</div>
                    <div className="grid gap-0.5 text-muted-foreground">
                      <div>
                        catalog 内動画:{" "}
                        <span className="tabular-nums text-foreground">
                          {d.videoCount} 本
                        </span>
                      </div>
                      <div>
                        視聴件数:{" "}
                        <span className="tabular-nums text-foreground">
                          {d.viewCount} 件
                        </span>
                      </div>
                      <div>
                        完遂件数:{" "}
                        <span className="tabular-nums text-foreground">
                          {d.completedCount} 件
                        </span>
                      </div>
                      <div>
                        完遂率:{" "}
                        <span className="tabular-nums font-medium text-foreground">
                          {d.completionRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="completionRate" radius={4}>
              {bucketChartData.map((entry) => (
                <Cell key={entry.label} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="動画尺の選択比率"
        description="視聴された動画の長さ別構成比(catalog に該当尺の動画がある bucket のみ)"
      >
        <ChartContainer
          config={bucketRatioConfig}
          className="mx-auto aspect-square h-[280px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="label" />}
            />
            <Pie
              data={bucketRatioData}
              dataKey="viewCount"
              nameKey="label"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-2xl font-semibold"
                        >
                          {bucketRatioTotal}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                          className="fill-muted-foreground text-xs"
                        >
                          視聴件数
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="label" />} />
          </PieChart>
        </ChartContainer>
      </ChartCard>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>人気動画 ランキング</CardTitle>
          <CardDescription>
            過去 30 日間の視聴回数順。完遂率 = 完遂数 / 視聴数、
            再分析率 = 完遂後 24h 内に再分析を行った率。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>動画名</TableHead>
                <TableHead>カテゴリ</TableHead>
                <TableHead>尺</TableHead>
                <TableHead className="text-right">視聴数</TableHead>
                <TableHead className="text-right">完遂率</TableHead>
                <TableHead className="text-right">再分析率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.map(({ video, stats }, idx) => (
                <TableRow key={video.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{video.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {VIDEO_CATEGORY_LABEL[video.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {video.durationSeconds}秒
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {stats.viewCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {stats.viewCount === 0 ? "—" : pct(stats.completionRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {stats.viewCount === 0 || stats.completionRate === 0
                      ? "—"
                      : pct(stats.reanalysisRate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* TODO Day 8 optional: カテゴリ別 完遂率 chart */}
    </div>
  )
}
