import { useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { AlertTriangleIcon, SearchIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCompanies } from "@/contexts/CompaniesContext"
import { hasFatigueGap, type Plan } from "@/lib/mock-data/types"
import { users } from "@/lib/mock-data/users"

function formatDate(iso: string): string {
  // "2026-05-13T09:12:00" → "2026-05-13 09:12"
  return iso.slice(0, 16).replace("T", " ")
}

type PlanFilter = "all" | Plan
type SortKey =
  | "lastAnalysis-desc"
  | "lastAnalysis-asc"
  | "name-asc"
  | "plan-asc"
  | "plan-desc"

const PLAN_RANK: Record<Plan, number> = { Guest: 0, Member: 1, Premium: 2 }

function planBadgeVariant(plan: Plan): "default" | "secondary" | "outline" {
  if (plan === "Premium") return "default"
  if (plan === "Member") return "secondary"
  return "outline" // Guest
}

export default function UsersPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { companies, getCompany } = useCompanies()
  const type = searchParams.get("type") ?? "admin"
  const companyIdRaw = searchParams.get("company_id")

  const [query, setQuery] = useState("")
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [onlyAttention, setOnlyAttention] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>("lastAnalysis-desc")

  // b2b はユーザー一覧画面を見られない(個人情報非開示)
  if (type === "b2b") {
    return <Navigate to="/dashboard" replace />
  }

  const companyId = companyIdRaw != null ? Number(companyIdRaw) : 0
  const isOEM = type === "oem"

  // 視点別スコープ
  const scopedUsers = isOEM
    ? users.filter((u) => u.companyId === companyId)
    : users

  // 「山田 太郎」と「山田太郎」どちらでもヒットするよう半角・全角空白を除去
  const normalizeName = (s: string) => s.replace(/\s+/g, "").toLowerCase()
  const normalizedQuery = normalizeName(query)

  // Filter chain
  let working = scopedUsers
  if (normalizedQuery) {
    working = working.filter((u) =>
      normalizeName(u.name).includes(normalizedQuery)
    )
  }
  if (planFilter !== "all") {
    working = working.filter((u) => u.plan === planFilter)
  }
  if (!isOEM && companyFilter !== "all") {
    working = working.filter((u) => String(u.companyId) === companyFilter)
  }
  if (onlyAttention) {
    working = working.filter((u) => hasFatigueGap(u))
  }

  // Sort(filter 結果を不変コピーしてから sort)
  const filtered = [...working].sort((a, b) => {
    switch (sortBy) {
      case "lastAnalysis-desc":
        return b.lastAnalysisAt.localeCompare(a.lastAnalysisAt)
      case "lastAnalysis-asc":
        return a.lastAnalysisAt.localeCompare(b.lastAnalysisAt)
      case "name-asc":
        return a.name.localeCompare(b.name, "ja")
      case "plan-asc":
        return PLAN_RANK[a.plan] - PLAN_RANK[b.plan]
      case "plan-desc":
        return PLAN_RANK[b.plan] - PLAN_RANK[a.plan]
      default:
        return 0
    }
  })

  const attentionCount = filtered.filter((u) => hasFatigueGap(u)).length

  // 提供先 filter の選択肢(admin 視点のみ。運営 = id 0 は除外)
  const companyOptions = companies.filter((c) => c.id !== 0)

  function resetFilters() {
    setQuery("")
    setPlanFilter("all")
    setCompanyFilter("all")
    setOnlyAttention(false)
    setSortBy("lastAnalysis-desc")
  }

  const hasActiveFilter =
    query !== "" ||
    planFilter !== "all" ||
    companyFilter !== "all" ||
    onlyAttention ||
    sortBy !== "lastAnalysis-desc"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ユーザー一覧</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOEM ? "自社ユーザー" : "全提供先のユーザー"} — 合計{" "}
          {filtered.length} 名
          {attentionCount > 0 && (
            <span className="text-destructive">
              {" "}
              (うち要注意 {attentionCount} 名)
            </span>
          )}
        </p>
      </div>

      {/* Filter / Sort バー */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="名前で検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={planFilter}
          onValueChange={(v) => setPlanFilter(v as PlanFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="プラン" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全プラン</SelectItem>
            <SelectItem value="Guest">Guest</SelectItem>
            <SelectItem value="Member">Member</SelectItem>
            <SelectItem value="Premium">Premium</SelectItem>
          </SelectContent>
        </Select>

        {!isOEM && (
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="提供先" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全提供先</SelectItem>
              {companyOptions.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="並び順" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastAnalysis-desc">
              最終分析(新しい順)
            </SelectItem>
            <SelectItem value="lastAnalysis-asc">最終分析(古い順)</SelectItem>
            <SelectItem value="name-asc">名前順(50音)</SelectItem>
            <SelectItem value="plan-asc">プラン(Guest→Premium)</SelectItem>
            <SelectItem value="plan-desc">プラン(Premium→Guest)</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="only-attention"
            checked={onlyAttention}
            onCheckedChange={setOnlyAttention}
          />
          <label htmlFor="only-attention" className="text-sm">
            要注意のみ
          </label>
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            リセット
          </button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead>プラン</TableHead>
              {!isOEM && <TableHead>提供先</TableHead>}
              <TableHead>最新表情</TableHead>
              <TableHead>最新 AI 疲労</TableHead>
              <TableHead>最終分析</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isOEM ? 6 : 7}
                  className="py-8 text-center text-muted-foreground"
                >
                  該当ユーザーはいません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const company = getCompany(u.companyId)
                const flagged = hasFatigueGap(u)
                return (
                  <TableRow
                    key={u.id}
                    onClick={() => {
                      const qs = searchParams.toString()
                      navigate(qs ? `/users/${u.id}?${qs}` : `/users/${u.id}`)
                    }}
                    className={
                      flagged
                        ? "cursor-pointer bg-red-50 hover:bg-red-100"
                        : "cursor-pointer"
                    }
                  >
                    <TableCell
                      className={
                        flagged
                          ? "font-medium text-destructive"
                          : "font-medium"
                      }
                    >
                      <span className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {u.name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        {u.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={planBadgeVariant(u.plan)}>
                        {u.plan}
                      </Badge>
                    </TableCell>
                    {!isOEM && (
                      <TableCell className="text-muted-foreground">
                        {company?.name ?? "—"}
                      </TableCell>
                    )}
                    <TableCell
                      className={flagged ? "text-muted-foreground" : undefined}
                    >
                      {u.expression}
                    </TableCell>
                    <TableCell
                      className={flagged ? "text-muted-foreground" : undefined}
                    >
                      {u.fatigueAi ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatDate(u.lastAnalysisAt)}
                    </TableCell>
                    <TableCell>
                      {flagged && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangleIcon className="size-3" />
                          要注意
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
