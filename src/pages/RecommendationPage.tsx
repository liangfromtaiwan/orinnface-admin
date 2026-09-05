/**
 * 推奨設定 (仕様書 v1.0 §8)
 *
 * 🔴 正式推奨は Backend だけが生成する。AI /v1/recommend は本番で使わない。
 * 🔴 baseline_version(5動作の基準値 set)と policy_version(順位・tie-break・
 *    欠損・fallback 方針)は分離する。
 * 🔴 active 値の直接更新は禁止。過去 recommendation_run を再計算・上書きしない。
 * 🔴 rollback は新 version として実行する。
 */

import { toast } from "sonner"

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useSession } from "@/contexts/session-context"
import { formatDate } from "@/lib/domain/kpi"
import { can } from "@/lib/domain/scope"
import {
  VERSIONED_SET_STATUS_LABEL,
  type VersionedSetStatus,
} from "@/lib/domain/types"
import { baselineSets, policySets } from "@/lib/mock/seed"

function StatusBadge({ status }: { status: VersionedSetStatus }) {
  return (
    <Badge variant={status === "active" ? "default" : "outline"}>
      {VERSIONED_SET_STATUS_LABEL[status]}
    </Badge>
  )
}

export default function RecommendationPage() {
  const { scope } = useSession()
  const canDraft = can(scope, "recommendation.draft")
  const canApprove = can(scope, "recommendation.approve")

  return (
    <div className="space-y-4">
      <PageHeader
        title="推奨設定"
        description="基準値 set と方針 set は別 version として管理します。"
        actions={
          <Button
            disabled={!canDraft}
            onClick={() => toast.info("draft を作成します(active は直接編集できません)")}
          >
            draft 作成
          </Button>
        }
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">基準値 set (recommendation_baseline_version)</h2>
        {baselineSets.map((set) => (
          <Card key={set.version}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span className="font-mono text-sm">{set.version}</span>
                <StatusBadge status={set.status} />
              </CardTitle>
              <CardDescription className="text-xs">
                作成 {set.createdBy} / {formatDate(set.createdAt)}
                {set.approvedBy ? ` ・承認 ${set.approvedBy}` : ""}
                {set.activatedAt ? ` ・有効化 ${formatDate(set.activatedAt)}` : ""}
                {set.scheduledActivateAt
                  ? ` ・有効化予約 ${formatDate(set.scheduledActivateAt)}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {set.values.map((v) => (
                  <div key={v.poseCode} className="tabular-nums">
                    <span className="text-muted-foreground">{v.poseCode}</span>{" "}
                    {v.baseline.toFixed(1)}
                  </div>
                ))}
              </div>
              {set.note ? (
                <p className="text-xs text-muted-foreground">{set.note}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canApprove || set.status !== "draft"}
                  onClick={() => toast.info("影響 preview を表示します")}
                >
                  影響 preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canApprove || set.status !== "draft"}
                  onClick={() => toast.success("承認しました")}
                >
                  承認
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canApprove || set.status !== "approved"}
                  onClick={() => toast.success("有効化しました")}
                >
                  有効化
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canApprove || set.status !== "retired"}
                  onClick={() =>
                    toast.success("rollback を新 version として実行します", {
                      description: "過去の recommendation_run は再計算・上書きしません。",
                    })
                  }
                >
                  rollback
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">方針 set (recommendation_policy_version)</h2>
        {policySets.map((set) => (
          <Card key={set.version}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span className="font-mono text-sm">{set.version}</span>
                <StatusBadge status={set.status} />
              </CardTitle>
              <CardDescription className="text-xs">
                作成 {set.createdBy} / {formatDate(set.createdAt)}
                {set.scheduledActivateAt
                  ? ` ・有効化予約 ${formatDate(set.scheduledActivateAt)}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <dl className="space-y-1">
                <div>
                  <dt className="text-xs text-muted-foreground">tie-break</dt>
                  <dd>{set.tieBreak}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">欠損の扱い</dt>
                  <dd>{set.missingValueHandling}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">fallback</dt>
                  <dd>{set.fallback}</dd>
                </div>
              </dl>
              {set.note ? (
                <p className="text-xs text-muted-foreground">{set.note}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>

      <SpecNote>
        同年代平均の average_version、AI の threshold_version、推奨基準の version は
        それぞれ別のものです。同じ値として扱わないでください。初期の推奨基準値と policy
        version は仕様書 §16 の P0 未決事項(実測 + 事業承認待ち)のため、画面と table は
        先行して作れますが有効化はできません。
      </SpecNote>
    </div>
  )
}
