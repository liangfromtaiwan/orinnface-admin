import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom"

import { ChartCard } from "@/components/ChartCard"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { calculateAge } from "@/lib/utils"
import { getCompany } from "@/lib/mock-data/companies"
import {
  expressionLevel,
  fatigueLevel,
  recordHasGap,
  subjectiveLevel,
} from "@/lib/mock-data/types"
import type { ActivityRecord } from "@/lib/mock-data/types"
import { getUserById } from "@/lib/mock-data/users"

const trendConfig: ChartConfig = {
  expression: { label: "表情", color: "var(--chart-1)" },
  subjective: { label: "主観疲労", color: "var(--chart-2)" },
  aiFatigue: { label: "AI 疲労", color: "var(--chart-3)" },
}

const TREND_END_DATE_MS = new Date("2026-05-13T00:00:00Z").getTime()
const TREND_DAYS = 30

type TrendPoint = {
  date: string
  expression: number | null
  subjective: number | null
  aiFatigue: number | null
  rawExpression?: string
  rawSubjective?: string
  rawAiFatigue?: string
}

// activityLog から 30 日分の TrendPoint 配列を生成。
// 同日複数記録ある場合は最新(activityLog は新→旧 sort 済)を採用、
// 該当日記録無しは null(Line は connectNulls で繋ぐ)。
// subjective / aiFatigue は 6 - level で invert、全 line で「5 = 良好」に統一。
// 規格 1-3 章:Premium のみ fatigue を持つため、Guest / Member ユーザーの
// レコードでは subjective / aiFatigue が undefined → null として line 非描画。
function buildTrendData(activityLog: ActivityRecord[]): TrendPoint[] {
  const result: TrendPoint[] = []
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(TREND_END_DATE_MS - i * 86400000)
    const dateIso = d.toISOString().slice(0, 10)
    const mmdd = dateIso.slice(5)

    const rec = activityLog.find((r) => r.analyzedAt.slice(0, 10) === dateIso)
    if (rec) {
      result.push({
        date: mmdd,
        expression: expressionLevel(rec.expression),
        subjective:
          rec.subjectiveFatigue !== undefined
            ? 6 - subjectiveLevel(rec.subjectiveFatigue)
            : null,
        aiFatigue:
          rec.fatigueAi !== undefined ? 6 - fatigueLevel(rec.fatigueAi) : null,
        rawExpression: rec.expression,
        rawSubjective: rec.subjectiveFatigue,
        rawAiFatigue: rec.fatigueAi,
      })
    } else {
      result.push({
        date: mmdd,
        expression: null,
        subjective: null,
        aiFatigue: null,
      })
    }
  }
  return result
}

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ")
}

function InfoField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-medium ${mono ? "tabular-nums" : ""}`}
      >
        {value}
      </dd>
    </div>
  )
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"

  // b2b はユーザー詳細を見られない(個人情報非開示)
  if (type === "b2b") return <Navigate to="/dashboard" replace />

  const userId = id ? Number(id) : NaN
  if (isNaN(userId)) return <Navigate to="/users" replace />

  const qs = searchParams.toString()
  const usersHref = qs ? `/users?${qs}` : "/users"

  const user = getUserById(userId)
  if (!user) {
    return (
      <div className="space-y-4">
        <Link
          to={usersHref}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          ユーザー一覧
        </Link>
        <p className="text-sm">ID {id} のユーザーは見つかりません</p>
      </div>
    )
  }

  // OEM は自社ユーザーのみアクセス可
  if (type === "oem") {
    const companyId = Number(searchParams.get("company_id") ?? 0)
    if (user.companyId !== companyId) return <Navigate to="/users" replace />
  }

  const company = getCompany(user.companyId)
  const gappedCount = user.activityLog.filter((r) => recordHasGap(r)).length
  const trendData = buildTrendData(user.activityLog)
  // 規格 1-3 章:Premium のみ fatigue 両方を持つ。
  const isPremium = user.plan === "Premium"

  return (
    <div className="space-y-8">
      <div>
        <Link
          to={usersHref}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          ユーザー一覧に戻る
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {user.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {company?.name ?? "—"} ・ {user.plan}
              {/* 規格 v2 1-1:性別 + 年齢。BtoB は L140 で redirect 済だが
                  defensive に type ガード。Guest / 未入力は非表示。 */}
              {type !== "b2b" && user.gender && user.birthDate && (
                <>
                  {" ・ "}
                  {user.gender}
                  {" ・ "}
                  {calculateAge(user.birthDate)} 歳
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <InfoField label="プラン" value={user.plan} />
            <InfoField label="最新表情" value={user.expression} />
            <InfoField label="最新 AI 疲労" value={user.fatigueAi ?? "—"} />
            <InfoField
              label="最終分析"
              value={formatDate(user.lastAnalysisAt)}
              mono
            />
          </dl>
          {!isPremium && (
            <p className="mt-4 text-xs text-muted-foreground">
              ※ {user.plan} プランは表情分析のみ対応。疲労判定は Premium 限定機能です。
            </p>
          )}
        </CardContent>
      </Card>

      <ChartCard
        title="コンディション推移"
        description={
          isPremium
            ? "過去 30 日間の表情・主観疲労・AI 判定疲労の重ね合わせ(5 = 良好、1 = 不調 のスケールに正規化)"
            : "過去 30 日間の表情推移(5 = 良好、1 = 不調 のスケールに正規化)。主観疲労・AI 疲労判定は Premium プラン限定。"
        }
      >
        <ChartContainer
          config={trendConfig}
          className="aspect-auto h-[280px] w-full"
        >
          <LineChart
            accessibilityLayer
            data={trendData}
            margin={{ left: 4, right: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={4}
              fontSize={11}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tickLine={false}
              axisLine={false}
              width={20}
              fontSize={11}
              padding={{ top: 12, bottom: 4 }}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as TrendPoint
                if (
                  d.expression === null &&
                  d.subjective === null &&
                  d.aiFatigue === null
                )
                  return null
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                    <div className="mb-1 font-medium">{d.date}</div>
                    <div className="grid gap-0.5">
                      {d.aiFatigue !== null && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: "var(--color-aiFatigue)" }}
                          />
                          <span>
                            AI 疲労:
                            <span className="font-medium tabular-nums">
                              {d.aiFatigue}
                            </span>
                            ({d.rawAiFatigue})
                          </span>
                        </div>
                      )}
                      {d.expression !== null && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: "var(--color-expression)" }}
                          />
                          <span>
                            表情:
                            <span className="font-medium tabular-nums">
                              {d.expression}
                            </span>
                            ({d.rawExpression})
                          </span>
                        </div>
                      )}
                      {d.subjective !== null && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: "var(--color-subjective)" }}
                          />
                          <span>
                            主観疲労:
                            <span className="font-medium tabular-nums">
                              {d.subjective}
                            </span>
                            ({d.rawSubjective})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="expression"
              type="monotone"
              stroke="var(--color-expression)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              dataKey="subjective"
              type="monotone"
              stroke="var(--color-subjective)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              dataKey="aiFatigue"
              type="monotone"
              stroke="var(--color-aiFatigue)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle>全行動履歴</CardTitle>
          <CardDescription>
            分析記録 {user.activityLog.length} 件
            {gappedCount > 0 && (
              <span className="text-destructive">
                {" "}
                (うち主観 vs AI 落差 {gappedCount} 件)
              </span>
            )}
            。落差 2 段階以上のレコードは赤色で表示。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>表情</TableHead>
                <TableHead>AI 疲労</TableHead>
                <TableHead>主観疲労</TableHead>
                <TableHead>主観集中</TableHead>
                <TableHead>気になる部位</TableHead>
                <TableHead>ケア動画</TableHead>
                <TableHead className="w-[110px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.activityLog.map((r, i) => {
                const flagged = recordHasGap(r)
                return (
                  <TableRow
                    key={i}
                    className={
                      flagged ? "bg-red-50 hover:bg-red-100" : undefined
                    }
                  >
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDate(r.analyzedAt)}
                    </TableCell>
                    <TableCell>{r.expression}</TableCell>
                    <TableCell>
                      {r.fatigueAi ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={
                        flagged ? "font-medium text-destructive" : undefined
                      }
                    >
                      {r.subjectiveFatigue ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.subjectiveFocus ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.bodyPart ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.careVideoTitle ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          {r.careCompleted && (
                            <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
                          )}
                          {r.careVideoTitle}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {flagged && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangleIcon className="size-3" />
                          要注目
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
