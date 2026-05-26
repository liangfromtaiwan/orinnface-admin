import { useState } from "react"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { AlertTriangleIcon, SearchIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCompanies } from "@/contexts/CompaniesContext"
import { hasFatigueGap } from "@/lib/mock-data/types"
import { users } from "@/lib/mock-data/users"

function formatDate(iso: string): string {
  // "2026-05-13T09:12:00" → "2026-05-13 09:12"
  return iso.slice(0, 16).replace("T", " ")
}

export default function UsersPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { getCompany } = useCompanies()
  const type = searchParams.get("type") ?? "admin"
  const companyIdRaw = searchParams.get("company_id")
  const [query, setQuery] = useState("")

  // b2b はユーザー一覧画面を見られない(個人情報非開示)
  if (type === "b2b") {
    return <Navigate to="/dashboard" replace />
  }

  const companyId = companyIdRaw != null ? Number(companyIdRaw) : 0
  const isOEM = type === "oem"

  // type=oem は自社のみ、admin は全員
  const scopedUsers = isOEM
    ? users.filter((u) => u.companyId === companyId)
    : users

  // 「山田 太郎」と「山田太郎」どちらでもヒットするよう半角・全角空白を除去して比較
  const normalizeName = (s: string) => s.replace(/\s+/g, "").toLowerCase()
  const normalizedQuery = normalizeName(query)
  const filtered = normalizedQuery
    ? scopedUsers.filter((u) => normalizeName(u.name).includes(normalizedQuery))
    : scopedUsers

  const attentionCount = filtered.filter((u) => hasFatigueGap(u)).length

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

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="名前で検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
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
                  colSpan={isOEM ? 5 : 6}
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
