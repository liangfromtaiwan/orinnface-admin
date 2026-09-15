/**
 * 版の差分表示 (仕様書 v1.0 §8「画面は draft 作成、差分、影響 preview…を提供する」)
 *
 * 🔴 差分は必ず「何と比べた差分か」を書く。基準が見えない差分は読めない。
 * 🔴 ここは表示だけ。値を編集する導線は置かない(active の直接更新禁止)。
 */

import { ArrowRightIcon } from "lucide-react"

import {
  POLICY_FIELD_LABEL,
  POSE_LABEL,
  type BaselineDiffRow,
  type PolicyDiffRow,
} from "@/lib/domain/recommendation"

function DeltaText({ delta }: { delta?: number }) {
  if (delta === undefined || delta === 0) {
    return <span className="text-muted-foreground">変更なし</span>
  }
  return (
    <span className="font-medium tabular-nums">
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  )
}

export function BaselineDiff({
  rows,
  fromVersion,
  toVersion,
}: {
  rows: BaselineDiffRow[]
  fromVersion: string
  toVersion: string
}) {
  const changed = rows.filter((r) => r.delta !== undefined && r.delta !== 0)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-mono">{fromVersion}</span> との差分
        {changed.length === 0 ? "(差分なし)" : `(${changed.length} 動作)`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1 pr-3 text-left font-normal">動作</th>
              <th className="py-1 pr-3 text-right font-normal">{fromVersion}</th>
              <th className="py-1 pr-3 text-right font-normal">{toVersion}</th>
              <th className="py-1 text-right font-normal">差</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.poseCode} className="border-t">
                <td className="py-1 pr-3">
                  {POSE_LABEL[row.poseCode]}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {row.poseCode}
                  </span>
                </td>
                <td className="py-1 pr-3 text-right tabular-nums text-muted-foreground">
                  {row.from?.toFixed(1) ?? "—"}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {row.to?.toFixed(1) ?? "—"}
                </td>
                <td className="py-1 text-right">
                  <DeltaText delta={row.delta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PolicyDiff({
  rows,
  fromVersion,
}: {
  rows: PolicyDiffRow[]
  fromVersion: string
}) {
  const changed = rows.filter((r) => r.changed)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-mono">{fromVersion}</span> との差分
        {changed.length === 0 ? "(差分なし)" : `(${changed.length} 項目)`}
      </p>
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.field} className="border-t pt-2 first:border-t-0 first:pt-0">
            <dt className="text-xs text-muted-foreground">
              {POLICY_FIELD_LABEL[row.field]}
              {row.changed ? "" : "(変更なし)"}
            </dt>
            {row.changed ? (
              <dd className="mt-0.5 space-y-1 text-sm">
                <p className="text-muted-foreground line-through decoration-muted-foreground/50">
                  {row.from}
                </p>
                <p className="flex items-start gap-1.5">
                  <ArrowRightIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                  <span>{row.to}</span>
                </p>
              </dd>
            ) : (
              <dd className="mt-0.5 text-sm text-muted-foreground">{row.to}</dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  )
}
