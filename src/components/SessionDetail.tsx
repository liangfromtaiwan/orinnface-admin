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
import { Badge } from "@/components/ui/badge"
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
import {
  METRIC_GROUP_LABEL,
  POSE_DISPLAY,
  getMetric,
  metricsByGroup,
} from "@/lib/domain/metrics"
import { useSession } from "@/contexts/session-context"
import {
  ACTIVE_THRESHOLD_SET,
  BINARY_LABEL,
  JUDGE_LABEL,
  judge,
} from "@/lib/domain/thresholds"
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
            note="無表情の6指標です。5動作の可動域とは別の指標なので混ぜて表示しません。同年代との比較は「比較」タブにあります。各動作のカードに出る 正常 / 要注意 / 要ケア は判定閾値(推奨設定の「判定閾値」タブ)から引いていますが、その閾値は暫定です。"
          />
          {/*
            🔴 動作ごとに 1 枚にする。ユーザーの結果画面が「い ー」「う ー」…の
               セクション単位で並んでいるので、本部が同じ並びで見られないと
               「私の口すぼめが要ケアなのはなぜ」と聞かれたときに突き合わせられない。
               指標の種類(可動域/左右差/代償)ごとに 3 枚へ分けると、1 つの動作の
               話をするのに 3 枚を見比べることになる。
          */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {POSE_DISPLAY.map((pose) => (
              <PoseCard key={pose.pose} session={session} pose={pose} />
            ))}
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

/**
 * 1 動作分の結果。ユーザーの結果画面のカード 1 枚に対応する。
 * 🔴 判定(正常/要注意/要ケア)は判定閾値から引く。閾値は暫定なので、その旨を出す。
 * 🔴 筋肉タグは表示だけの情報で、推奨の順位や判定には使わない。
 */
function PoseCard({
  session,
  pose,
}: {
  session: AnalysisSession
  pose: (typeof POSE_DISPLAY)[number]
}) {
  const { muscleTags } = useSession()

  const rows = [
    getMetric(`${pose.pose}_range`),
    getMetric(`${pose.pose}_asymmetry`),
    getMetric(`${pose.pose}_compensation`),
  ].filter((d): d is NonNullable<typeof d> => d !== undefined)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-2 text-base">
          {pose.cue}
          <span className="text-sm font-normal text-muted-foreground">
            {pose.label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          {rows.map((def) => {
            const m = session.metrics.find((x) => x.metricCode === def.code)
            const rule = ACTIVE_THRESHOLD_SET.rules.find(
              (r) => r.group === def.group
            )
            const verdict = m && rule ? judge(rule, m.value) : undefined
            /* 可動域の「◯◯ 可動域」は見出しと重複するので落とす */
            const label = def.label.replace(`${pose.label} `, "")
            return (
              <div
                key={def.code}
                className="flex items-baseline justify-between gap-2 border-b py-1 text-sm last:border-0"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="flex items-baseline gap-2 tabular-nums">
                  {m ? (
                    rule?.kind === "binary" && verdict ? (
                      /* 代償は数値を出さない。結果画面と同じ なし / あり */
                      <span className={`text-xs ${JUDGE_LABEL[verdict].className}`}>
                        {BINARY_LABEL[verdict === "danger" ? "danger" : "normal"]}
                      </span>
                    ) : (
                      <>
                        <span>
                          {m.value.toFixed(1)}
                          <span className="ml-0.5 text-xs text-muted-foreground">
                            {def.unit}
                          </span>
                        </span>
                        {verdict ? (
                          <span className={`text-xs ${JUDGE_LABEL[verdict].className}`}>
                            {JUDGE_LABEL[verdict].label}
                          </span>
                        ) : null}
                      </>
                    )
                  ) : (
                    <span className="text-muted-foreground">欠測</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-1">
          {muscleTags[pose.pose].map((tag) => (
            <Badge key={tag} variant="outline" className="px-1.5 py-0 text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
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
          /* 判定閾値がある指標は判定も出す。姿勢は閾値が未確認なので値だけ */
          const rule = ACTIVE_THRESHOLD_SET.rules.find((r) => r.group === def.group)
          const verdict = m && rule ? judge(rule, m.value) : undefined
          return (
            <div
              key={def.code}
              className="flex items-baseline justify-between gap-2 border-b py-1 text-sm last:border-0"
            >
              <span className="text-muted-foreground">{def.label}</span>
              <span className="flex items-baseline gap-2 tabular-nums">
                {m ? (
                  <>
                    <span>
                      {m.value.toFixed(1)}
                      <span className="ml-0.5 text-xs text-muted-foreground">
                        {def.unit}
                      </span>
                    </span>
                    {verdict ? (
                      <span className={`text-xs ${JUDGE_LABEL[verdict].className}`}>
                        {JUDGE_LABEL[verdict].label}
                      </span>
                    ) : null}
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
