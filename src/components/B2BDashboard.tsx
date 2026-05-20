import { ShieldIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useSearchParams } from "react-router-dom"

import { ChartCard } from "@/components/ChartCard"
import { StatCard, type StatDelta } from "@/components/StatCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { getActiveUserStats, getAnalytics } from "@/lib/mock-data/analytics"
import { getCompany } from "@/lib/mock-data/companies"
import type {
  BodyPart,
  DailyAnalytics,
  Expression,
  Fatigue,
  SubjectiveFatigue,
  SubjectiveFocus,
  User,
} from "@/lib/mock-data/types"
import {
  BODY_PARTS,
  EXPRESSIONS,
  FATIGUES,
  SUBJECTIVE_FATIGUES,
  SUBJECTIVE_FOCUSES,
} from "@/lib/mock-data/types"
import { getAnalysisStats, getUsersByCompany } from "@/lib/mock-data/users"

const DEFAULT_B2B_COMPANY_ID = 3

const FATIGUE_TO_SCORE: Record<Fatigue, number> = {
  "軽やか": 5,
  "いつも通り": 4,
  "ややお疲れ": 3,
  "蓄積しています": 2,
  "踏ん張りどき": 1,
}

function pct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

function weightedAvg(rows: DailyAnalytics[], key: keyof DailyAnalytics): number {
  const totalDau = rows.reduce((s, r) => s + r.dau, 0)
  if (totalDau === 0) return 0
  return rows.reduce((s, r) => s + (r[key] as number) * r.dau, 0) / totalDau
}

function deltaVsLastWeek(
  series: DailyAnalytics[],
  key: keyof DailyAnalytics
): StatDelta {
  const today = series[series.length - 1][key] as number
  const lastWeek = series[series.length - 8][key] as number
  return { value: today - lastWeek, label: "前週同曜日比" }
}

// 規格 1-3 章:Premium のみ AI 疲労判定を持つため、
// スコアは Premium 利用者のみで集計。Premium が居なければ 0。
function conditionScore(users: User[]): number {
  const scored = users.filter(
    (u): u is User & { fatigueAi: Fatigue } => u.fatigueAi !== undefined
  )
  if (scored.length === 0) return 0
  return (
    scored.reduce((s, u) => s + FATIGUE_TO_SCORE[u.fatigueAi], 0) /
    scored.length
  )
}

function countBy<T extends string>(users: User[], key: keyof User, values: readonly T[]) {
  return values.map((v) => ({
    category: v,
    count: users.filter((u) => u[key] === v).length,
  }))
}

const distributionConfig: ChartConfig = {
  count: { label: "人数", color: "var(--chart-2)" },
}

export function B2BDashboard() {
  const [searchParams] = useSearchParams()
  const companyIdRaw = searchParams.get("company_id")
  let companyId =
    companyIdRaw != null ? Number(companyIdRaw) : DEFAULT_B2B_COMPANY_ID
  let company = getCompany(companyId)
  if (!company || company.type !== "b2b") {
    company = getCompany(DEFAULT_B2B_COMPANY_ID)
    companyId = DEFAULT_B2B_COMPANY_ID
  }
  // company is guaranteed by mock-data (id=3 always exists)
  if (!company) return null

  const series = getAnalytics(companyId)
  const today = series[series.length - 1]
  const last7 = series.slice(-7)
  const prior7 = series.slice(-14, -7)
  const companyUsers = getUsersByCompany(companyId)
  const activeStats = getActiveUserStats(series)
  const analysisStats = getAnalysisStats(companyUsers, 30)

  const stats = [
    {
      title: "利用人数",
      value: `${companyUsers.length} 名`,
      description: "現時点で本企業に登録されているユーザー数",
    },
    {
      title: "全体コンディションスコア",
      value: `${conditionScore(companyUsers).toFixed(1)} / 5.0`,
      description: "AI 疲労判定の 5 段階(軽やか=5 〜 踏ん張りどき=1)平均",
    },
    {
      title: "ケア実行率(本日)",
      value: pct(today.careExecutionRate),
      delta: deltaVsLastWeek(series, "careExecutionRate"),
    },
    {
      title: "平均改善率(7日)",
      value: pct(weightedAvg(last7, "improvementRate")),
      delta: {
        value:
          weightedAvg(last7, "improvementRate") -
          weightedAvg(prior7, "improvementRate"),
        label: "前週比",
      },
    },
  ] as const

  const expressionData = countBy<Expression>(
    companyUsers,
    "expression",
    EXPRESSIONS
  )
  const subjFatigueData = countBy<SubjectiveFatigue>(
    companyUsers,
    "subjectiveFatigue",
    SUBJECTIVE_FATIGUES
  )
  const subjFocusData = countBy<SubjectiveFocus>(
    companyUsers,
    "subjectiveFocus",
    SUBJECTIVE_FOCUSES
  )
  const bodyPartData = countBy<BodyPart>(companyUsers, "bodyPart", BODY_PARTS)

  // mock-data に AI 疲労分布のスナップショットがあるため、analytics 最新日を集計
  const fatigueData = FATIGUES.map((f) => ({
    category: f,
    count: today.fatigueDist[f],
  }))

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">ダッシュボード</h1>
          <Badge variant="outline">BtoB 集計画面</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {company.name} — 集計データのみ表示
        </p>
      </div>

      <Alert>
        <ShieldIcon />
        <AlertTitle>集計データのみ表示</AlertTitle>
        <AlertDescription>
          本画面は集計データのみを表示します。個人を特定できる情報は含まれません。
        </AlertDescription>
      </Alert>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="DAU"
          value={`${activeStats.dau} 名`}
          description="本日アクティブだった自社ユーザー"
        />
        <StatCard
          title="WAU"
          value={`${activeStats.wau} 名`}
          description="過去 7 日間のユニークアクティブ"
        />
        <StatCard
          title="MAU"
          value={`${activeStats.mau} 名`}
          description="過去 30 日間のユニークアクティブ"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          title="分析実行数(30日)"
          value={`${analysisStats.total} 件`}
          description="自社ユーザーの活動ログから集計"
        />
        <StatCard
          title="1 ユーザー平均分析回数(30日)"
          value={`${analysisStats.perUser.toFixed(1)} 回`}
          description={`総件数 ${analysisStats.total} 件 ÷ 自社 ${companyUsers.length} 名`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="表情カテゴリ分布"
          description="現時点の登録ユーザーの表情カテゴリ別人数"
        >
          <ChartContainer
            config={distributionConfig}
            className="aspect-auto h-[220px] w-full"
          >
            <BarChart data={expressionData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="AI 疲労ステージ分布"
          description="本日の AI 判定結果(全提供先内)"
        >
          <ChartContainer
            config={distributionConfig}
            className="aspect-auto h-[220px] w-full"
          >
            <BarChart data={fatigueData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="主観疲労分布"
          description="ユーザー自己申告(3 段階)"
        >
          <ChartContainer
            config={distributionConfig}
            className="aspect-auto h-[200px] w-full"
          >
            <BarChart data={subjFatigueData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="主観集中分布"
          description="ユーザー自己申告(3 段階)"
        >
          <ChartContainer
            config={distributionConfig}
            className="aspect-auto h-[200px] w-full"
          >
            <BarChart data={subjFocusData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </section>

      <ChartCard
        title="部位別コンディション"
        description="気になる部位の集計(複数回答ではなく主訴 1 つ)"
      >
        <ChartContainer
          config={distributionConfig}
          className="aspect-auto h-[260px] w-full"
        >
          <BarChart
            data={bodyPartData}
            layout="vertical"
            accessibilityLayer
            margin={{ left: 100 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="category"
              tickLine={false}
              axisLine={false}
              width={100}
              fontSize={11}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  )
}
