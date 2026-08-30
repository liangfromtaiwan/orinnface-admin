/**
 * 分析 (仕様書 v1.0 §4, §13)
 *
 * ユーザー側と同じ neutral / 5動作 / 姿勢指標、品質、version、推移を扱う。
 * 🔴 管理画面で別スコアを作らない。値の正本は AI分析 v1.6。
 */

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSession, useStoreName } from "@/contexts/session-context"
import { isEligible, jstDate } from "@/lib/domain/kpi"
import {
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_TYPE_LABEL,
  type AnalysisStatus,
  type AnalysisType,
} from "@/lib/domain/types"

export default function AnalysisPage() {
  const { analysisSessions, customers } = useSession()
  const storeName = useStoreName()

  const [type, setType] = useState<AnalysisType | "all">("all")
  const [status, setStatus] = useState<AnalysisStatus | "all">("all")

  const codeById = useMemo(
    () => new Map(customers.map((c) => [c.dataSubjectId, c.displayCode])),
    [customers]
  )

  const rows = useMemo(
    () =>
      analysisSessions
        .filter((s) => (type === "all" ? true : s.analysisType === type))
        .filter((s) => (status === "all" ? true : s.status === status))
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
        .slice(0, 200),
    [analysisSessions, type, status]
  )

  const eligibleCount = rows.filter(isEligible).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="分析"
        description={`表示 ${rows.length} 件(うち適格分析 ${eligibleCount} 件) / スコープ内 全 ${analysisSessions.length} 件`}
        actions={
          <>
            <Select value={type} onValueChange={(v) => setType(v as AnalysisType | "all")}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="種別" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての種別</SelectItem>
                <SelectItem value="face">表情分析</SelectItem>
                <SelectItem value="posture">姿勢分析</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as AnalysisStatus | "all")}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="状態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての状態</SelectItem>
                {(Object.keys(ANALYSIS_STATUS_LABEL) as AnalysisStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {ANALYSIS_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>完了日</TableHead>
                <TableHead>顧客</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>適格</TableHead>
                <TableHead>品質</TableHead>
                <TableHead>店舗</TableHead>
                <TableHead>model</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="tabular-nums">
                    {s.completedAt ? jstDate(s.completedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/customers/${s.dataSubjectId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {codeById.get(s.dataSubjectId) ?? s.dataSubjectId}
                    </Link>
                  </TableCell>
                  <TableCell>{ANALYSIS_TYPE_LABEL[s.analysisType]}</TableCell>
                  <TableCell>
                    {s.status === "failed" ? (
                      <span className="text-destructive">
                        {ANALYSIS_STATUS_LABEL[s.status]}
                        {s.retryable ? "(再実行可)" : ""}
                      </span>
                    ) : (
                      ANALYSIS_STATUS_LABEL[s.status]
                    )}
                  </TableCell>
                  <TableCell>
                    {isEligible(s) ? (
                      <Badge variant="outline" className="px-1 py-0 text-[10px]">
                        適格
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {s.newCapture ? "—" : "再解析"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.quality === "ok" ? (
                      "—"
                    ) : (
                      <span className="text-amber-700">
                        {s.quality === "warn" ? "注意" : "不足"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{storeName(s.storeId)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.versions.modelVersion}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <SpecNote>
        適格分析 = 新規撮影を伴う completed 分析です。failed / cancelled / invalid と、
        新規撮影のない再解析・再スコアリングは母数から除外しています。姿勢分析は B2B のみで、
        B2C の顧客には出しません。
      </SpecNote>
    </div>
  )
}
