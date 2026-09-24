/**
 * 分析履歴のテーブル (仕様書 v1.0 §5)
 *
 * 顧客詳細(最新 10 件)と全件ページの両方で使う。
 * 行の描き方を 1 箇所に置き、2 画面で列や表記がずれないようにしている。
 */

import { QualityBadge } from "@/components/QualityBadge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useStoreName } from "@/contexts/session-context"
import { formatDate } from "@/lib/domain/kpi"
import {
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_TYPE_LABEL,
  type AnalysisSession,
} from "@/lib/domain/types"

/**
 * 顧客詳細に出す件数の上限。
 * 履歴は使うほど増えるので、詳細画面では打ち切って全件ページへ送る。
 */
export const HISTORY_PREVIEW_LIMIT = 10

export function AnalysisHistoryTable({
  sessions,
  onSelect,
}: {
  sessions: AnalysisSession[]
  /** 行の「詳細」。顧客詳細・全件ページとも分析詳細ページへ送る。 */
  onSelect: (sessionId: string) => void
}) {
  const storeName = useStoreName()

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>完了日</TableHead>
            <TableHead>種別</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>品質</TableHead>
            <TableHead>撮影</TableHead>
            <TableHead>店舗</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="tabular-nums">
                {s.completedAt ? (
                  formatDate(s.completedAt)
                ) : (
                  <span className="text-muted-foreground">
                    {formatDate(s.startedAt)}
                    <span className="ml-1 text-xs">開始</span>
                  </span>
                )}
              </TableCell>
              <TableCell>{ANALYSIS_TYPE_LABEL[s.analysisType]}</TableCell>
              <TableCell>
                {s.status === "failed" ? (
                  <span className="text-destructive">
                    {ANALYSIS_STATUS_LABEL[s.status]}
                  </span>
                ) : (
                  ANALYSIS_STATUS_LABEL[s.status]
                )}
              </TableCell>
              <TableCell>
                <QualityBadge quality={s.quality} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {s.newCapture ? "新規撮影" : "再解析(適格外)"}
              </TableCell>
              <TableCell className="text-sm">{storeName(s.storeId)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onSelect(s.id)}>
                  詳細
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
