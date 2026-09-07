/**
 * care動画 (仕様書 v1.0 §7)
 *
 * 固定13枠、asset、差し替え申請、承認、公開、rollback。
 * 🔴 V1 は 13 枠だけ。slot 新設・14番目の枠・「はじめて向け」枠を追加しない。
 * 🚫 training_videos / facial_training / is_starter / release を実装名に使わない。
 * 🔴 差し替えは care_asset_id だけを切り替える。video_code / pose_code は不変。
 */

import { useMemo } from "react"
import { toast } from "sonner"

import { InfoHint } from "@/components/InfoHint"
import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSession } from "@/contexts/session-context"
import {
  CARE_CATEGORY_LABEL,
  CARE_VIDEO_SLOTS,
  providerOf,
  resolveAssignment,
} from "@/lib/domain/care-catalog"
import { formatDate } from "@/lib/domain/kpi"
import { can } from "@/lib/domain/scope"
import {
  CARE_ASSIGNMENT_STATUS_LABEL,
  PLAN_LABEL,
  type CareAssignment,
} from "@/lib/domain/types"
import { careAssets, careAssignments } from "@/lib/mock/seed"

export default function CareVideosPage() {
  const { scope } = useSession()
  const canApprove = can(scope, "care.approve")
  const canRequest = can(scope, "care.request_replacement")

  const assetById = useMemo(
    () => new Map(careAssets.map((a) => [a.id, a])),
    []
  )

  /**
   * 🔴 同じ枠に店舗動画と標準動画を重複表示しない(吉田さん確定 2026-09-07)。
   *    店舗 > 会社 > 本部デフォルト の順に 1 件だけ解決する。
   *    ここでは本部視点なので、差し替えが入っている枠は「店舗提供」として見せる。
   */
  const now = new Date().toISOString()
  const activeAssignmentByCode = useMemo(() => {
    const map = new Map<string, CareAssignment>()
    for (const slot of CARE_VIDEO_SLOTS) {
      // 差し替えが設定されている枠は、その scope を優先して解決する
      const scoped = careAssignments.find(
        (a) =>
          a.videoCode === slot.videoCode &&
          a.status === "active" &&
          (a.scope.storeId || a.scope.companyId)
      )
      const resolved =
        scoped ??
        resolveAssignment(careAssignments, slot.videoCode, {}, now)
      if (resolved) map.set(slot.videoCode, resolved)
    }
    return map
  }, [now])

  const requests = careAssignments.filter(
    (a) => a.status !== "active" || a.scope.companyId || a.scope.storeId
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="care動画"
        description={`固定 ${CARE_VIDEO_SLOTS.length} 枠。ユーザー向け機能名は「顔トレ」、内部総称は care video です。`}
      />

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>区分</TableHead>
                <TableHead>video_code</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>権限</TableHead>
                <TableHead>公開中の asset</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CARE_VIDEO_SLOTS.map((slot) => {
                const assignment = activeAssignmentByCode.get(slot.videoCode)
                const asset = assignment ? assetById.get(assignment.careAssetId) : undefined
                return (
                  <TableRow key={slot.videoCode}>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {CARE_CATEGORY_LABEL[slot.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{slot.videoCode}</TableCell>
                    <TableCell className="text-sm">{slot.targetLabel}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {slot.requiredPlans.map((p) => PLAN_LABEL[p]).join(" / ")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {asset ? (
                        <>
                          <span className="flex flex-wrap items-center gap-1.5">
                            {asset.title}
                            {providerOf(assignment) === "store" ? (
                              <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                                {asset.provider}提供
                              </Badge>
                            ) : null}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {providerOf(assignment) === "store"
                              ? "標準動画を差し替え中"
                              : "本部標準"}
                            {" / "}
                            {asset.durationSeconds}秒
                          </div>
                        </>
                      ) : (
                        <span className="text-destructive">未解決</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canRequest}
                        onClick={() =>
                          toast.info("差し替え申請", {
                            description: `${slot.videoCode} の care_asset_id のみを切り替えます。video_code / pose_code は変更しません。`,
                          })
                        }
                      >
                        差し替え申請
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="py-0">
        <CardHeader className="pt-6">
          <CardTitle className="flex items-center gap-1.5 text-base">
            差し替え申請
            <InfoHint label="差し替え申請について">
              本部承認前の asset は顧客へ公開できません。重複する有効期間は publish 前に
              拒否します。差し替えは care_asset_id だけを切り替え、video_code と pose_code は
              変更しません。
            </InfoHint>
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>video_code</TableHead>
                <TableHead>適用範囲</TableHead>
                <TableHead>申請者</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>期間</TableHead>
                <TableHead>権利</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const asset = assetById.get(r.careAssetId)
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.videoCode}</TableCell>
                    <TableCell className="text-sm">
                      {r.scope.storeId
                        ? "店舗限定"
                        : r.scope.companyId
                          ? "会社全体"
                          : "本部デフォルト"}
                    </TableCell>
                    <TableCell className="text-sm">{r.requestedBy}</TableCell>
                    <TableCell className="text-sm">
                      {CARE_ASSIGNMENT_STATUS_LABEL[r.status]}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {r.startAt ? formatDate(r.startAt) : "—"}
                      {r.endAt ? ` 〜 ${formatDate(r.endAt)}` : ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      {asset?.rightsCleared ? (
                        <span className="text-muted-foreground">確認済</span>
                      ) : (
                        <span className="text-amber-700">未確認</span>
                      )}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          !canApprove ||
                          r.status !== "pending_approval" ||
                          !asset?.rightsCleared
                        }
                        title={
                          !asset?.rightsCleared
                            ? "権利確認が未完了のため承認できません"
                            : undefined
                        }
                        onClick={() =>
                          toast.success("承認しました", {
                            description: "有効日時に care_asset_id を切り替えます。",
                          })
                        }
                      >
                        承認
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canApprove || r.status !== "pending_approval"}
                        onClick={() => toast.info("却下しました")}
                      >
                        却下
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <SpecNote>
        契約企業・店舗は既存枠への差し替えを申請できますが、V1 で slot・pose・video_code を
        新設することはできません。差し替え時は care_asset_id だけを切り替え、元 asset・
        差し替え asset・申請者・承認者・理由・開始終了・取消・catalog version を履歴として
        保持します。会員権限は Guest = 推奨2件を lock 表示 + 登録 CTA(再生不可)、
        Member = 選定2動作の1分 care を JST 暦月10回、Premium = 1分・3分・リンパ・神経で
        商品上の月間上限なしです。
      </SpecNote>
    </div>
  )
}
