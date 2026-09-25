/**
 * 表に 1 件も出ないときの行。
 *
 * 🔴 空の tbody を残さない。ヘッダーだけの表は「壊れている / 読み込み中」に
 *    見えるため、実際に「保持の画面が空白」という指摘を受けた(2026-09-25)。
 *    出ない理由(絞り込みの結果なのか、元々 0 件なのか)まで書く。
 * 🔴 絞り込みの結果なら**その場で戻せる**ようにする。条件を探して直す手間を
 *    残さない。
 */

import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"

export function TableEmpty({
  colSpan,
  filtered,
  emptyLabel,
  filteredLabel = "条件に合うものがありません",
  onClear,
}: {
  colSpan: number
  /** 絞り込みの結果 0 件か。false なら元データが 0 件。 */
  filtered: boolean
  /** 元データが 0 件のときの文面。 */
  emptyLabel: string
  filteredLabel?: string
  onClear?: () => void
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10 text-center">
        <p className="text-sm text-muted-foreground">
          {filtered ? filteredLabel : emptyLabel}
        </p>
        {filtered && onClear ? (
          <Button variant="link" size="sm" className="h-auto" onClick={onClear}>
            絞り込みを解除する
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  )
}
