/**
 * 分析詳細 (仕様書 v1.0 §5.2)
 *
 * 顧客詳細から独立したページとして開く。
 * 以前は顧客詳細の一覧の下に差し込んでいたが、指標カードが縦に長く、
 * 一覧から選んでも変化が画面外で起きるため「押しても何も起きない」ように見えていた。
 *
 * 🔴 neutral 6指標と 5動作の可動域は別の指標なので同じ表に混ぜない (§5.2)。
 * 🔴 推奨は Backend 正式 run だけを出す。AI /v1/recommend は使わない (§8)。
 * 🔴 技術情報は既定で畳む (§5.2「通常は詳細 drawer」)。
 */

import { useState } from "react"
import { AlertTriangleIcon } from "lucide-react"

import { InfoHint } from "@/components/InfoHint"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import { METRIC_GROUP_LABEL, metricsByGroup } from "@/lib/domain/metrics"
import type { AnalysisSession } from "@/lib/domain/types"
import { recommendationRuns } from "@/lib/mock/seed"

/* ------------------------------------------------------------------ *
 * 分析詳細
 * ------------------------------------------------------------------ */

export function SessionDetail({ session }: { session: AnalysisSession }) {
  const [showTech, setShowTech] = useState(false)
  const run = recommendationRuns.find((r) => r.analysisSessionId === session.id)

  if (session.status === "failed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">分析詳細</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-1.5 text-destructive">
            <AlertTriangleIcon className="size-4" />
            {session.failureReason ?? "分析に失敗しました"}
          </p>
          <p className="text-xs text-muted-foreground">
            {session.retryable
              ? "再実行が可能です。過去 run や asset は上書きせず、新しい run として実行します。"
              : "再実行できません。"}
          </p>
        </CardContent>
      </Card>
    )
  }

  const isFace = session.analysisType === "face"

  return (
    <div className="space-y-4">
      {isFace ? (
        <>
          <MetricGroupCard
            session={session}
            group="neutral"
            note="無表情の6指標です。5動作の可動域とは別の指標なので混ぜて表示しません。同年代との比較は「比較」タブにあります。"
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricGroupCard session={session} group="range" />
            <MetricGroupCard session={session} group="asymmetry" />
            <MetricGroupCard session={session} group="compensation" />
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <MetricGroupCard
            session={session}
            group="posture_front"
            note="姿勢は B2B のみ。B2C には出しません。"
          />
          <MetricGroupCard
            session={session}
            group="posture_side"
            note="左右の側面結果は別表示です。V1 のユーザー画面は左側面を使います。"
          />
        </div>
      )}

      {run ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              推奨(Backend 正式 run)
              <InfoHint label="推奨の出どころ">
                正式推奨は Backend だけが生成します。AI /v1/recommend の値は
                本番画面・保存に使いません。
              </InfoHint>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>rank</TableHead>
                  <TableHead>pose</TableHead>
                  <TableHead className="text-right">score</TableHead>
                  <TableHead className="text-right">baseline</TableHead>
                  <TableHead className="text-right">deviation</TableHead>
                  <TableHead>video_code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.items.map((item) => (
                  <TableRow key={item.rank}>
                    <TableCell className="tabular-nums">{item.rank}</TableCell>
                    <TableCell className="font-mono text-xs">{item.poseCode}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.score.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.baseline.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.deviation.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.videoCode}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              baseline_version {run.baselineVersion} / policy_version {run.policyVersion}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">技術情報</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowTech((v) => !v)}>
            {showTech ? "閉じる" : "開く"}
          </Button>
        </CardHeader>
        {showTech ? (
          <CardContent>
            <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {Object.entries(session.versions).map(([k, v]) =>
                v ? (
                  <div key={k} className="flex justify-between gap-2 border-b py-1">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ) : null
              )}
              <div className="flex justify-between gap-2 border-b py-1">
                <dt className="text-muted-foreground">quality</dt>
                <dd className="font-mono">{session.quality}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b py-1">
                <dt className="text-muted-foreground">newCapture</dt>
                <dd className="font-mono">{String(session.newCapture)}</dd>
              </div>
            </dl>
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}

function MetricGroupCard({
  session,
  group,
  note,
}: {
  session: AnalysisSession
  group: Parameters<typeof metricsByGroup>[0]
  note?: string
}) {
  const defs = metricsByGroup(group)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          {METRIC_GROUP_LABEL[group]}
          {note ? (
            <InfoHint label={`${METRIC_GROUP_LABEL[group]} について`}>{note}</InfoHint>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {defs.map((def) => {
          const m = session.metrics.find((x) => x.metricCode === def.code)
          return (
            <div
              key={def.code}
              className="flex items-baseline justify-between gap-2 border-b py-1 text-sm last:border-0"
            >
              <span className="text-muted-foreground">{def.label}</span>
              <span className="tabular-nums">
                {m ? (
                  <>
                    {m.value.toFixed(2)}
                    <span className="ml-1 text-xs text-muted-foreground">{def.unit}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">欠測</span>
                )}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
