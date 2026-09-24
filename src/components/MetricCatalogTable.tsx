/**
 * 指標一覧 (表示のみ)
 *
 * 🔴 **正本は AI分析 v1.6**。指標の追加・削除はこの画面からはできない。
 *    metric_code は AI が返すものがそのまま入る。ここで増やしても、AI が
 *    計算しない指標は「欠測」の行が増えるだけで、§5 の同一指標原則(管理画面と
 *    ユーザー画面で同じ metric_code・同じ値)も崩れる。
 * 🔴 それでも一覧を置くのは、「システムが今どの指標を認識しているか」を本部が
 *    確認できる場所がどこにも無かったため(使用者確定 2026-09-22)。
 *
 * 並びはユーザー向け結果画面と同じセクション単位にする。画面と突き合わせる
 * ために見るものなので、種類ごとに並べ替えない。
 */

import { Badge } from "@/components/ui/badge"
import {
  METRIC_DIRECTION_LABEL,
  POSE_DISPLAY,
  getMetric,
  metricsByGroup,
  type MetricDef,
} from "@/lib/domain/metrics"

function Rows({ defs }: { defs: MetricDef[] }) {
  return (
    <>
      {defs.map((def) => (
        <tr key={def.code} className="border-t">
          <td className="py-1.5 pr-3 font-mono text-xs">{def.code}</td>
          <td className="py-1.5 pr-3">{def.label}</td>
          <td className="py-1.5 pr-3 text-right tabular-nums">{def.unit}</td>
          <td className="py-1.5 pr-3 text-xs text-muted-foreground">
            {METRIC_DIRECTION_LABEL[def.direction]}
          </td>
          <td className="py-1.5 text-right">
            {def.provisional ? (
              <Badge
                variant="outline"
                className="border-amber-300 px-1 py-0 text-xs text-amber-700"
              >
                暫定
              </Badge>
            ) : null}
          </td>
        </tr>
      ))}
    </>
  )
}

function Section({ title, aside, defs }: { title: string; aside?: string; defs: MetricDef[] }) {
  if (defs.length === 0) return null
  return (
    <>
      <tr className="border-t bg-muted/40">
        <td colSpan={5} className="py-1.5 text-sm font-medium">
          {title}
          {aside ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {aside}
            </span>
          ) : null}
        </td>
      </tr>
      <Rows defs={defs} />
    </>
  )
}

export function MetricCatalogTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1 pr-3 text-left font-normal">metric_code</th>
            <th className="py-1 pr-3 text-left font-normal">表示名</th>
            <th className="py-1 pr-3 text-right font-normal">単位</th>
            <th className="py-1 pr-3 text-left font-normal">よい方向</th>
            <th className="py-1 text-right font-normal">metric_direction</th>
          </tr>
        </thead>
        <tbody>
          <Section title="無表情" defs={metricsByGroup("neutral")} />
          {POSE_DISPLAY.map((pose) => (
            <Section
              key={pose.pose}
              title={`${pose.cue} ${pose.label}`}
              aside={pose.pose}
              defs={[
                getMetric(`${pose.pose}_range`),
                getMetric(`${pose.pose}_asymmetry`),
                getMetric(`${pose.pose}_compensation`),
              ].filter((d): d is MetricDef => d !== undefined)}
            />
          ))}
          <Section
            title="姿勢(正面)"
            aside="B2B のみ"
            defs={metricsByGroup("posture_front")}
          />
          <Section
            title="姿勢(側面)"
            aside="B2B のみ・左右は別表示"
            defs={metricsByGroup("posture_side")}
          />
        </tbody>
      </table>
    </div>
  )
}
