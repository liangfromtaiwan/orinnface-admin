/**
 * 画像・保持 (仕様書 v1.0 §10, §13)
 *
 * 理由付き一時閲覧、期限、通知、削除 state、失敗再試行。
 * 🚫 「全データ削除」「完全削除」「匿名化」「個人情報は含まれません」は使わない。
 *    → 正しい表現は「紐付けを切った状態で保管」。
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { RawImageViewButton } from "@/components/RawImageAccess"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { useSession } from "@/contexts/session-context"
import { formatDate } from "@/lib/domain/kpi"
import { can } from "@/lib/domain/scope"
import {
  HANDOFF_STATUS_LABEL,
  RETENTION_POLICY_LABEL,
  RETENTION_STATE_LABEL,
  type RetentionState,
} from "@/lib/domain/types"
import { handoffTokens, NOW, rawImageAssets } from "@/lib/mock/seed"

/** 満了 30 日前に通知する (§10)。 */
const NOTICE_DAYS_BEFORE_EXPIRY = 30

export default function RetentionPage() {
  const { scope, customers } = useSession()
  const canOperate = can(scope, "retention.operate")
  const [state, setState] = useState<RetentionState | "all">("all")

  const codeById = useMemo(
    () => new Map(customers.map((c) => [c.dataSubjectId, c.displayCode])),
    [customers]
  )

  const rows = useMemo(
    () =>
      rawImageAssets
        .filter((a) => (state === "all" ? true : a.state === state))
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
        .slice(0, 150),
    [state]
  )

  const counts = useMemo(() => {
    const map = new Map<RetentionState, number>()
    for (const a of rawImageAssets) {
      map.set(a.state, (map.get(a.state) ?? 0) + 1)
    }
    return map
  }, [])

  return (
    <div className="space-y-4">
      <PageHeader
        title="画像・保持"
        description={`生画像 asset ${rawImageAssets.length} 件。満了 ${NOTICE_DAYS_BEFORE_EXPIRY} 日前に登録ユーザーへ通知します。`}
        actions={
          <Select
            value={state}
            onValueChange={(v) => setState(v as RetentionState | "all")}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="状態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての状態</SelectItem>
              {(Object.keys(RETENTION_STATE_LABEL) as RetentionState[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {RETENTION_STATE_LABEL[s]} ({counts.get(s) ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>asset</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>policy</TableHead>
                <TableHead>撮影</TableHead>
                <TableHead>期限</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const expired = new Date(a.expiresAt).getTime() < NOW.getTime()
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.id}</TableCell>
                    <TableCell className="text-sm">
                      {a.dataSubjectId ? (
                        codeById.get(a.dataSubjectId) ?? a.dataSubjectId
                      ) : (
                        <span className="text-muted-foreground">
                          {a.anonymousId}
                          <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
                            未連携分析
                          </Badge>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {RETENTION_POLICY_LABEL[a.policy]}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(a.capturedAt)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      <span className={expired ? "text-amber-700" : undefined}>
                        {formatDate(a.expiresAt)}
                      </span>
                      {a.noticeSentAt ? (
                        <div className="text-[11px] text-muted-foreground">
                          通知済 {formatDate(a.noticeSentAt)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.state === "failed" ? (
                        <span className="text-destructive">
                          {RETENTION_STATE_LABEL[a.state]}
                        </span>
                      ) : (
                        RETENTION_STATE_LABEL[a.state]
                      )}
                      {a.failureReason ? (
                        <div className="text-[11px] text-muted-foreground">
                          {a.failureReason}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {a.state === "failed" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canOperate}
                          onClick={() =>
                            toast.success("削除処理を再試行します", {
                              description:
                                "queue → 全 generation 削除 → 不存在確認 → 監査完了の順で実行します。",
                            })
                          }
                        >
                          再試行
                        </Button>
                      ) : null}
                      <RawImageViewButton
                        rawImageAssetId={a.id}
                        disabled={a.state === "deleted"}
                        disabledReason="削除済みのため閲覧できません"
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">handoff (B2B 未連携分析)</h2>
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>token</TableHead>
                  <TableHead>発行</TableHead>
                  <TableHead>QR / URL 失効</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>発行者</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {handoffTokens.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono text-xs">{h.token}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(h.issuedAt)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(h.expiresAt)}
                      <div className="text-[11px] text-muted-foreground">発行から1日</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {HANDOFF_STATUS_LABEL[h.status]}
                    </TableCell>
                    <TableCell className="text-sm">{h.issuedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </section>

      <SpecNote>
        handoff の QR / URL は発行から 1 日で失効しますが、失効しても画像は削除しません。
        未連携分析の生画像は分析完了から 180 日で、180 日以内に紐付ければ登録 2 年の規則へ
        移行します(起算は登録日ではなく対象の最終適格分析完了日)。期限到達後は署名 URL を
        停止し、queue → 全 generation 削除 → 不存在確認 → 監査完了の順で処理します。退会時は
        生画像を削除し、特徴量はアカウント情報との紐付けを切った状態で保管します。
      </SpecNote>
    </div>
  )
}
