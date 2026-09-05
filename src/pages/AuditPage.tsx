/**
 * 監査 (仕様書 v1.0 §11)
 *
 * 権限変更、画像閲覧、export、care 差し替え、基準値変更、削除、rollback を記録する。
 * 🔴 重い操作は理由入力を必須にし、閲覧者・対象・理由・日時・request ID を残す。
 */

import { useMemo, useState } from "react"

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { useSession } from "@/contexts/session-context"
import { formatDateTime } from "@/lib/domain/kpi"
import { can } from "@/lib/domain/scope"
import { AUDIT_CATEGORY_LABEL, type AuditCategory } from "@/lib/domain/types"
import { auditEvents } from "@/lib/mock/seed"

export default function AuditPage() {
  const { scope } = useSession()
  const [category, setCategory] = useState<AuditCategory | "all">("all")
  const [query, setQuery] = useState("")

  const allowed = can(scope, "audit.search")

  const rows = useMemo(
    () =>
      auditEvents
        .filter((e) => (category === "all" ? true : e.category === category))
        .filter((e) => {
          if (!query.trim()) return true
          const q = query.trim().toLowerCase()
          return (
            e.targetLabel.toLowerCase().includes(q) ||
            e.actorName.toLowerCase().includes(q) ||
            (e.reason ?? "").toLowerCase().includes(q)
          )
        })
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [category, query]
  )

  if (!allowed) {
    return (
      <div className="space-y-4">
        <PageHeader title="監査" />
        <SpecNote>
          監査ログの横断検索は本部(operator)のみが利用できます。
        </SpecNote>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="監査"
        description={`${rows.length} 件`}
        actions={
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="対象・実行者・理由"
              className="h-9 w-56"
            />
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as AuditCategory | "all")}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="種別" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての種別</SelectItem>
                {(Object.keys(AUDIT_CATEGORY_LABEL) as AuditCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {AUDIT_CATEGORY_LABEL[c]}
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
                <TableHead>日時</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>実行者</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>理由</TableHead>
                <TableHead>request ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm tabular-nums">
                    {formatDateTime(e.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={e.category === "image_access" ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {AUDIT_CATEGORY_LABEL[e.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.actorName}</TableCell>
                  <TableCell className="text-sm">{e.targetLabel}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.reason ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.requestId}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <SpecNote>
        生画像の一時閲覧は権限・所有・active な店舗連携・目的・理由を検証したうえで
        署名 URL を 300 秒だけ発行し、閲覧者・対象 asset・理由・日時・request ID を
        image_access_logs に記録します。
      </SpecNote>
    </div>
  )
}
