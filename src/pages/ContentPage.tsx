import { useSearchParams } from "react-router-dom"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCompany } from "@/lib/mock-data/companies"
import { VIDEO_CATEGORY_LABEL } from "@/lib/mock-data/types"
import {
  allViewRecords,
  getAllVideoStats,
  getViewsByCompany,
  videos,
} from "@/lib/mock-data/videos"

function pct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export default function ContentPage() {
  const [searchParams] = useSearchParams()
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

  const stats = [
    {
      title: "動画本数",
      value: `${totalVideos} 本`,
      description: "5 カテゴリ × 3 尺(30/60/120秒)",
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

      {/* TODO Day 8: 動画尺別 完遂率 bar chart */}
      {/* TODO Day 8 optional: カテゴリ別 完遂率 chart */}
    </div>
  )
}
