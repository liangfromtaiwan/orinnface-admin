/**
 * 顧客詳細・分析詳細 (仕様書 v1.0 §5.2)
 *
 * 🔴 同一指標原則: ユーザー側へ表示するスコアと同じ metric_code・同じ値を使う。
 * 🔴 neutral(無表情6指標)を 5動作の可動域と混ぜて表示しない。
 * 🔴 姿勢は B2B のみ。左右の側面結果は別表示。
 * 🔴 2時点比較は 左=古い日 / 右=新しい日。version 非互換は警告する。
 * 🔴 推奨は Backend 正式 run のみ。AI /v1/recommend の値は表示しない。
 */

import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AlertTriangleIcon, ArrowLeftIcon } from "lucide-react"

import { InfoHint } from "@/components/InfoHint"
import { PageHeader, SpecNote } from "@/components/PageHeader"
import { RawImagePlaceholder, RawImageViewButton } from "@/components/RawImageAccess"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession, useStoreName } from "@/contexts/session-context"
import { isEligible, jstDate } from "@/lib/domain/kpi"
import { usesB2bDisplay } from "@/lib/domain/scope"
import { careEntitlement, getCareSlot } from "@/lib/domain/care-catalog"
import { getMetric, isImproved, METRIC_GROUP_LABEL, metricsByGroup } from "@/lib/domain/metrics"
import {
  ANALYSIS_STATUS_LABEL,
  ANALYSIS_TYPE_LABEL,
  CONSENT_KIND_LABEL,
  PLAN_LABEL,
  RETENTION_POLICY_LABEL,
  RETENTION_STATE_LABEL,
  type AnalysisSession,
} from "@/lib/domain/types"
import { consentEvents, rawImageAssets, recommendationRuns } from "@/lib/mock/seed"

export default function CustomerDetailPage() {
  const { dataSubjectId = "" } = useParams()
  const { customers, analysisSessions, carePlaybacks, storeDataLinks } = useSession()
  const storeName = useStoreName()

  const customer = customers.find((c) => c.dataSubjectId === dataSubjectId)

  /**
   * 🔴 姿勢分析は B2B のみ。active な店舗連携がない顧客には出さない (§5.2)。
   *    連携解除でデータが消えるわけではなく、表示形式が B2C に戻るだけ。
   */
  const isB2b = usesB2bDisplay(dataSubjectId, storeDataLinks)

  const allOwnSessions = useMemo(
    () =>
      analysisSessions
        .filter((s) => s.dataSubjectId === dataSubjectId)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [analysisSessions, dataSubjectId]
  )
  const sessions = useMemo(
    () => (isB2b ? allOwnSessions : allOwnSessions.filter((s) => s.analysisType !== "posture")),
    [allOwnSessions, isB2b]
  )
  /** 連携解除で非表示にした姿勢分析の件数(データは保持されている旨を出すため)。 */
  const hiddenPostureCount = allOwnSessions.length - sessions.length

  const faceSessions = sessions.filter((s) => s.analysisType === "face" && isEligible(s))
  const postureSessions = sessions.filter((s) => s.analysisType === "posture" && isEligible(s))

  const [selectedId, setSelectedId] = useState<string>(() => faceSessions[0]?.id ?? "")
  const selected =
    sessions.find((s) => s.id === selectedId) ?? faceSessions[0] ?? sessions[0]

  if (!customer) {
    return (
      <div className="space-y-4">
        <PageHeader title="顧客詳細" />
        <SpecNote>
          この顧客は現在のスコープでは閲覧できません。active な店舗連携と、その店舗の
          担当に割り当てられていることの両方が必要です。連携が解除された顧客も閲覧できません。
        </SpecNote>
        <Button variant="outline" asChild>
          <Link to="/customers">
            <ArrowLeftIcon /> 顧客一覧へ戻る
          </Link>
        </Button>
      </div>
    )
  }

  const activeLink = storeDataLinks.find(
    (l) => l.dataSubjectId === dataSubjectId && l.status === "active"
  )
  const plays = carePlaybacks.filter((p) => p.dataSubjectId === dataSubjectId)
  const entitlement = careEntitlement(customer.plan)
  const assets = rawImageAssets.filter((a) => a.dataSubjectId === dataSubjectId)
  const consents = consentEvents.filter((c) => c.dataSubjectId === dataSubjectId)

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${customer.displayCode}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{customer.displayName}</span>
            <Badge variant="outline">{PLAN_LABEL[customer.plan]}</Badge>
            {customer.ageBand ? (
              <span className="text-xs">{customer.ageBand}</span>
            ) : null}
            <span className="text-xs">
              店舗: {activeLink ? storeName(activeLink.storeId) : "連携なし"}
            </span>
          </span>
        }
        actions={
          <Button variant="outline" asChild>
            <Link to="/customers">
              <ArrowLeftIcon /> 一覧
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis">分析</TabsTrigger>
          <TabsTrigger value="compare">比較</TabsTrigger>
          <TabsTrigger value="care">care</TabsTrigger>
          <TabsTrigger value="retention">画像・同意</TabsTrigger>
        </TabsList>

        {/* ---------------- 分析 ---------------- */}
        <TabsContent value="analysis" className="space-y-4">
          <Card className="py-0">
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
                    <TableRow
                      key={s.id}
                      data-state={s.id === selected?.id ? "selected" : undefined}
                    >
                      <TableCell className="tabular-nums">
                        {s.completedAt ? (
                          jstDate(s.completedAt)
                        ) : (
                          <span className="text-muted-foreground">
                            {jstDate(s.startedAt)}
                            <span className="ml-1 text-[10px]">開始</span>
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
                        {s.quality === "ok" ? (
                          "—"
                        ) : (
                          <span className="text-amber-700">
                            {s.quality === "warn" ? "注意" : "不足"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.newCapture ? "新規撮影" : "再解析(適格外)"}
                      </TableCell>
                      <TableCell className="text-sm">{storeName(s.storeId)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedId(s.id)}
                        >
                          詳細
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {hiddenPostureCount > 0 ? (
            <SpecNote>
              この顧客は店舗連携が有効でないため、姿勢分析 {hiddenPostureCount} 件は
              表示していません。姿勢分析は B2B のみの項目で、連携を解除すると表示は
              B2C 形式に戻ります。データ自体は削除されておらず、再連携すれば
              また表示されます。
            </SpecNote>
          ) : null}

          {selected ? <SessionDetail session={selected} /> : null}
        </TabsContent>

        {/* ---------------- 比較 ---------------- */}
        <TabsContent value="compare" className="space-y-4">
          <ComparePanel sessions={faceSessions} title="表情分析" />
          {postureSessions.length > 0 ? (
            <ComparePanel sessions={postureSessions} title="姿勢分析(B2B)" />
          ) : null}
          <SpecNote>
            2時点比較は左が古い日、右が新しい日です。同一 analysis_type / metric_code の
            全項目を当時の version のまま表示します。画像を削除したあとも数値履歴は残ります。
          </SpecNote>
        </TabsContent>

        {/* ---------------- care ---------------- */}
        <TabsContent value="care" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base">
                プラン別の見え方
                <InfoHint label="プラン別の見え方について">
                  実際の判定は Backend entitlement が正です。ここは「その顧客に何が
                  見えているはずか」を説明するための表示です。
                </InfoHint>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>
                再生: {entitlement.canPlay ? "可" : "不可"}
                {entitlement.showLockedWithCta
                  ? "(推奨2件は lock 表示 + 登録 CTA。非表示にはしない)"
                  : ""}
              </div>
              <div>
                月間上限:{" "}
                {entitlement.monthlyLimit === null
                  ? "商品上の上限なし"
                  : `JST暦月 ${entitlement.monthlyLimit} 回`}
              </div>
              <div>
                尺: {entitlement.durations.length ? entitlement.durations.join(" / ") : "—"}
                {entitlement.specialist ? " + リンパ・神経" : ""}
              </div>
            </CardContent>
          </Card>

          <Card className="py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>開始</TableHead>
                    <TableHead>video_code</TableHead>
                    <TableHead>対象</TableHead>
                    <TableHead>完了</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plays.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="tabular-nums">{jstDate(p.startedAt)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.videoCode}</TableCell>
                      <TableCell>{getCareSlot(p.videoCode)?.targetLabel ?? "—"}</TableCell>
                      <TableCell>
                        {p.completedAt ? (
                          jstDate(p.completedAt)
                        ) : (
                          <span className="text-muted-foreground">未完了</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {plays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        care 再生の記録はありません
                        {customer.plan === "guest" ? "(Guest は再生不可)" : ""}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ---------------- 画像・同意 ---------------- */}
        <TabsContent value="retention" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">生画像</CardTitle>
              </CardHeader>
              <CardContent>
                <RawImagePlaceholder />
              </CardContent>
            </Card>

            <Card className="py-0 lg:col-span-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>asset</TableHead>
                      <TableHead>policy</TableHead>
                      <TableHead>期限</TableHead>
                      <TableHead>状態</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.id}</TableCell>
                        <TableCell className="text-sm">
                          {RETENTION_POLICY_LABEL[a.policy]}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {jstDate(a.expiresAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {RETENTION_STATE_LABEL[a.state]}
                        </TableCell>
                        <TableCell className="text-right">
                          <RawImageViewButton
                            rawImageAssetId={a.id}
                            disabled={a.state === "deleted"}
                            disabledReason="削除済みのため閲覧できません"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {assets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          生画像 asset はありません
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">同意</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {consents.map((c) => (
                <div key={c.id}>
                  {CONSENT_KIND_LABEL[c.kind]}: {c.granted ? "同意あり" : "同意なし"}
                  <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                    {jstDate(c.occurredAt)}
                  </span>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                長期保存と研究・AI品質改善は独立した二軸です。研究同意は初期 OFF で
                V1 画面には表示せず、サービス条件にもしません。
              </p>
            </CardContent>
          </Card>

          <SpecNote>
            期限は新規撮影を伴う分析が completed したときにのみ更新され、過去の全画像が
            同じ期限へ揃います。ログイン・予約・来店・店舗連携・カルテ閲覧・再解析・
            施術記録では更新しません。退会時は生画像を削除し、特徴量はアカウント情報との
            紐付けを切った状態で保管します。
          </SpecNote>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 分析詳細
 * ------------------------------------------------------------------ */

function SessionDetail({ session }: { session: AnalysisSession }) {
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
            note="無表情の6指標です。5動作の可動域とは別の指標なので混ぜて表示しません。"
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

/* ------------------------------------------------------------------ *
 * 2時点比較 (左=古い / 右=新しい)
 * ------------------------------------------------------------------ */

function ComparePanel({
  sessions,
  title,
}: {
  sessions: AnalysisSession[]
  title: string
}) {
  const sorted = [...sessions].sort((a, b) =>
    (a.completedAt ?? "").localeCompare(b.completedAt ?? "")
  )
  const [leftId, setLeftId] = useState(sorted[0]?.id ?? "")
  const [rightId, setRightId] = useState(sorted[sorted.length - 1]?.id ?? "")

  if (sorted.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-xs">
            比較には適格分析が 2 件以上必要です(現在 {sorted.length} 件)。
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const left = sorted.find((s) => s.id === leftId) ?? sorted[0]
  const right = sorted.find((s) => s.id === rightId) ?? sorted[sorted.length - 1]

  const swapped =
    (left.completedAt ?? "") > (right.completedAt ?? "")
  const versionMismatch =
    left.versions.modelVersion !== right.versions.modelVersion ||
    left.versions.thresholdVersion !== right.versions.thresholdVersion

  const codes = [
    ...new Set([
      ...left.metrics.map((m) => m.metricCode),
      ...right.metrics.map((m) => m.metricCode),
    ]),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          {title}
          <InfoHint label="比較の見かた">
            左 = 古い日 / 右 = 新しい日。同一 analysis_type / metric_code の全項目を
            当時の version のまま表示します。画像を削除したあとも数値履歴は残ります。
          </InfoHint>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={left.id} onValueChange={setLeftId}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.completedAt ? jstDate(s.completedAt) : s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">→</span>
          <Select value={right.id} onValueChange={setRightId}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.completedAt ? jstDate(s.completedAt) : s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {swapped ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangleIcon className="size-3.5" />
            左に新しい日が選ばれています。左=古い日 / 右=新しい日で選び直してください。
          </p>
        ) : null}
        {versionMismatch ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangleIcon className="size-3.5" />
            model / threshold の version が異なります。単純比較はできません。
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>指標</TableHead>
                <TableHead className="text-right">
                  {left.completedAt ? jstDate(left.completedAt) : "—"}
                </TableHead>
                <TableHead className="text-right">
                  {right.completedAt ? jstDate(right.completedAt) : "—"}
                </TableHead>
                <TableHead className="text-right">評価</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => {
                const def = getMetric(code)
                const a = left.metrics.find((m) => m.metricCode === code)?.value
                const b = right.metrics.find((m) => m.metricCode === code)?.value
                const verdict = isImproved(code, a, b)
                return (
                  <TableRow key={code}>
                    <TableCell className="text-sm">{def?.label ?? code}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {a?.toFixed(2) ?? <span className="text-muted-foreground">欠測</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {b?.toFixed(2) ?? <span className="text-muted-foreground">欠測</span>}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {verdict === null ? (
                        <span className="text-muted-foreground">判定不能</span>
                      ) : verdict ? (
                        <span className="text-emerald-700">改善</span>
                      ) : (
                        <span className="text-muted-foreground">非改善</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
