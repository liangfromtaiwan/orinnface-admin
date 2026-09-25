/**
 * 画像・保持 (仕様書 v1.0 §10, §13)
 *
 * 理由付き一時閲覧、期限、通知、削除 state、失敗再試行。
 * 🚫 「全データ削除」「完全削除」「匿名化」「個人情報は含まれません」は使わない。
 *    → 正しい表現は「紐付けを切った状態で保管」。
 */

import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { TableEmpty } from "@/components/TableEmpty"
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
import { Input } from "@/components/ui/input"
import { useSession, useStoreName } from "@/contexts/session-context"
import { formatDate } from "@/lib/domain/kpi"
import { can } from "@/lib/domain/scope"
import {
  HANDOFF_STATUS_LABEL,
  RETENTION_POLICY_LABEL,
  RETENTION_STATE_LABEL,
  type RetentionState,
} from "@/lib/domain/types"
import { analysisSessions, handoffTokens, NOW, rawImageAssets } from "@/lib/mock/seed"

/** 満了 30 日前に通知する (§10)。 */
const NOTICE_DAYS_BEFORE_EXPIRY = 30

/** 一度に描く上限。超える分は検索で絞ってもらう。 */
const DISPLAY_LIMIT = 150

export default function RetentionPage() {
  const { scope, customers } = useSession()
  const storeName = useStoreName()
  const canOperate = can(scope, "retention.operate")
  const [state, setState] = useState<RetentionState | "all">("all")
  /** asset ID と顧客番号での絞り込み。件数が多く、目的の 1 件に辿り着けない。 */
  const [query, setQuery] = useState("")

  /** 画像を撮影した店舗。undefined = 本人が自宅で撮影した分。 */
  const captureStoreById = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const s of analysisSessions) map.set(s.id, s.storeId)
    return map
  }, [])

  const codeById = useMemo(
    () => new Map(customers.map((c) => [c.dataSubjectId, c.displayCode])),
    [customers]
  )

  /*
    検索は asset ID と顧客番号の両方に当てる。画面には両方が出ていて、
    どちらで探すかは場面による(監査の request から asset を辿る / 顧客の
    問い合わせから辿る)。表示名は出していないので対象にしない。
  */
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rawImageAssets.filter((a) => {
      if (state !== "all" && a.state !== state) return false
      if (!q) return true
      /* 表の「対象」欄に出している文字列で探せるようにする。
         未連携分析は顧客番号を持たないので anonymous_id で拾う。 */
      const subject = a.dataSubjectId
        ? (codeById.get(a.dataSubjectId) ?? a.dataSubjectId)
        : (a.anonymousId ?? "")
      const captureStore = captureStoreById.get(a.analysisSessionId)
      const place = captureStore ? storeName(captureStore) : "ご本人撮影"
      return (
        a.id.toLowerCase().includes(q) ||
        subject.toLowerCase().includes(q) ||
        place.toLowerCase().includes(q)
      )
    })
  }, [state, query, codeById, captureStoreById, storeName])

  const rows = useMemo(
    () =>
      [...matched]
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
        .slice(0, DISPLAY_LIMIT),
    [matched]
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
        description={
          <>
            {/* 🔴 絞った結果が全件なのか打ち切りなのかを隠さない */}
            表示 {rows.length} 件
            {matched.length > rows.length
              ? `（該当 ${matched.length} 件のうち先頭 ${DISPLAY_LIMIT} 件）`
              : ""}{" "}
            / 生画像 asset 全 {rawImageAssets.length} 件。満了{" "}
            {NOTICE_DAYS_BEFORE_EXPIRY} 日前に登録ユーザーへ通知します。
          </>
        }
        actions={
          <>
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="asset ID・顧客番号・撮影場所"
                className="h-9 w-56 pl-8"
              />
            </div>
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
          </>
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
              {rows.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  filtered={state !== "all" || query.trim() !== ""}
                  emptyLabel="生画像 asset はまだありません"
                  /* 🔴 この画面は表示名を持たない(§5 analytics に PII を混ぜない)。
                        名前で探して 0 件になった人に、探し方まで返す */
                  filteredLabel="条件に合う asset がありません。この画面は顧客の表示名では探せません（asset ID・顧客番号・撮影場所で探してください）。"
                  onClear={() => {
                    setState("all")
                    setQuery("")
                  }}
                />
              ) : null}
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
                          <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
                            未連携分析
                          </Badge>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {RETENTION_POLICY_LABEL[a.policy]}
                    </TableCell>
                    {/*
                      🔴 どこで撮ったかは「誰が見られるか」を決める。店舗は自店で
                         撮影した画像しか見られず、自宅撮影分は本部しか見られない
                         (decideRawImageView)。画面に出ていないと、閲覧できない
                         理由が読み取れない。
                    */}
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(a.capturedAt)}
                      <div className="text-[11px] text-muted-foreground">
                        {captureStoreById.get(a.analysisSessionId)
                          ? storeName(captureStoreById.get(a.analysisSessionId))
                          : "ご本人撮影"}
                      </div>
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
                        captureStoreId={captureStoreById.get(a.analysisSessionId)}
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
