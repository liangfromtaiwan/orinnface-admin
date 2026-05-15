import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
} from "lucide-react"
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCompany } from "@/lib/mock-data/companies"
import { recordHasGap } from "@/lib/mock-data/types"
import { getUserById } from "@/lib/mock-data/users"

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
            <InfoField label="最新 AI 疲労" value={user.fatigueAi} />
            <InfoField
              label="最終分析"
              value={formatDate(user.lastAnalysisAt)}
              mono
            />
          </dl>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { title: "表情カテゴリ推移", desc: "過去 30 日の表情変化" },
          { title: "疲労ステージ推移", desc: "AI 判定と主観の併記" },
          { title: "ケア実行履歴", desc: "おすすめ動画の実行率" },
        ].map((c) => (
          <Card key={c.title}>
            <CardHeader>
              <CardTitle className="text-base">{c.title}</CardTitle>
              <CardDescription>{c.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex aspect-video items-center justify-center rounded-md bg-muted/50 text-sm text-muted-foreground">
                グラフ:Day 7+ 実装予定
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

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
                    <TableCell>{r.fatigueAi}</TableCell>
                    <TableCell
                      className={
                        flagged ? "font-medium text-destructive" : undefined
                      }
                    >
                      {r.subjectiveFatigue}
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
