/**
 * 差し替え申請の確認と承認 (仕様書 v1.0 §7.1)
 *
 * 🔴 §7.1 は本部が「提供者・**内容**・権利・承認状態・公開期間・対象 scope を確認し、
 *    approve 後に assignment を予約する」と定めている。一覧の行だけでは内容を確認
 *    できないので、**承認・却下はこのダイアログからだけ**行えるようにしている。
 *    一覧に承認ボタンを戻すと、中身を見ずに承認できてしまう。
 * 🔴 「今この範囲に出ている動画」と並べる。差し替えは置き換えの判断なので、
 *    切り替え先だけ見ても判断できない。
 * 🔴 権利未確認の動画は承認できない (§7.1)。却下は理由を必須にする。
 *    申請元に理由が伝わらないと、同じ申請が繰り返される。
 * ⚠️ 承認・却下の結果は永続化しない(backend 担当)。リロードで戻る。
 */

import { useState } from "react"
import { toast } from "sonner"

import { CareVideoPreview } from "@/components/CareVideoPreview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useCompanyName,
  useSession,
  useStoreName,
} from "@/contexts/session-context"
import {
  CARE_CATEGORY_LABEL,
  careScopeLabel,
  getCareSlot,
  resolveAssignment,
} from "@/lib/domain/care-catalog"
import { formatDate, formatDateTime } from "@/lib/domain/kpi"
import { can } from "@/lib/domain/scope"
import {
  CARE_ASSIGNMENT_STATUS_LABEL,
  type CareAssignment,
} from "@/lib/domain/types"

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

export function CareRequestReviewDialog({
  request,
  open,
  onOpenChange,
}: {
  request: CareAssignment
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { scope, careAssets, careAssignments } = useSession()
  const companyName = useCompanyName()
  const storeName = useStoreName()
  const [reason, setReason] = useState("")

  const canApprove = can(scope, "care.approve")
  const slot = getCareSlot(request.videoCode)
  const asset = careAssets.find((a) => a.id === request.careAssetId)

  /*
    申請の範囲から見て「今出ている動画」。範囲が店舗なら店舗視点、会社なら会社視点で
    引く。本部デフォルトを見せると、その店舗に実際に出ているものとずれることがある。
  */
  const currentAssignment = resolveAssignment(
    careAssignments.filter((a) => a.id !== request.id),
    request.videoCode,
    request.scope,
    new Date().toISOString()
  )
  const currentAsset = careAssets.find(
    (a) => a.id === currentAssignment?.careAssetId
  )

  const pending = request.status === "pending_approval"
  const rightsCleared = asset?.rightsCleared ?? false

  function close() {
    onOpenChange(false)
    setReason("")
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">{request.videoCode}</span>
            <Badge variant="outline">
              {CARE_ASSIGNMENT_STATUS_LABEL[request.status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {slot
              ? `${CARE_CATEGORY_LABEL[slot.category]} / ${slot.targetLabel} の差し替え申請です。`
              : "差し替え申請です。"}
            切り替わるのは care_asset_id だけで、video_code・pose_code は変わりません。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Fact
              label="適用範囲"
              value={careScopeLabel(request.scope, {
                company: companyName,
                store: storeName,
              })}
            />
            <Fact label="申請者" value={request.requestedBy} />
            <Fact label="申請日" value={formatDate(request.createdAt)} />
            <Fact
              label="公開期間"
              value={
                request.startAt
                  ? `${formatDateTime(request.startAt)}${
                      request.endAt ? ` 〜 ${formatDateTime(request.endAt)}` : " 〜"
                    }`
                  : "—"
              }
            />
            <Fact
              label="権利"
              value={
                rightsCleared ? (
                  "確認済"
                ) : (
                  <span className="text-amber-700">未確認</span>
                )
              }
            />
            {request.approvedBy ? (
              <Fact label="承認者" value={request.approvedBy} />
            ) : null}
          </dl>

          {request.reason ? (
            <div>
              <p className="text-xs text-muted-foreground">申請理由</p>
              <p className="text-sm">{request.reason}</p>
            </div>
          ) : null}

          {/* 🔴 置き換えの判断なので、今出ているものと並べる */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-xs font-medium">
                今この範囲に出ている動画
                {currentAsset ? "" : "（なし）"}
              </h3>
              {currentAsset ? (
                <>
                  <p className="text-sm">{currentAsset.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentAsset.provider} / {currentAsset.durationSeconds}秒
                  </p>
                  <CareVideoPreview asset={currentAsset} label="中身の確認" />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  この範囲にはまだ公開中の動画がありません。
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-medium">申請されている動画</h3>
              {asset ? (
                <>
                  <p className="text-sm">{asset.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.provider} / {asset.durationSeconds}秒
                  </p>
                  <CareVideoPreview asset={asset} label="中身の確認" />
                </>
              ) : (
                <p className="text-xs text-destructive">
                  申請された動画が見つかりません。
                </p>
              )}
            </div>
          </div>

          {pending && !rightsCleared ? (
            <p className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-amber-800">
              権利確認が未完了のため承認できません。提供元に権利の確認を依頼するか、
              却下してください。
            </p>
          ) : null}

          {pending && canApprove ? (
            <Input
              className="h-9"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="却下する場合の理由(申請元に伝わります)"
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            閉じる
          </Button>
          <Button
            variant="outline"
            disabled={!canApprove || !pending || !reason.trim()}
            title={
              !canApprove
                ? "承認・却下は本部のみが行えます"
                : !pending
                  ? "承認待ちの申請ではありません"
                  : !reason.trim()
                    ? "却下の理由を入力してください"
                    : undefined
            }
            onClick={() => {
              toast.info("却下しました", { description: reason.trim() })
              close()
            }}
          >
            却下
          </Button>
          <Button
            disabled={!canApprove || !pending || !rightsCleared}
            title={
              !canApprove
                ? "承認・却下は本部のみが行えます"
                : !pending
                  ? "承認待ちの申請ではありません"
                  : !rightsCleared
                    ? "権利確認が未完了のため承認できません"
                    : undefined
            }
            onClick={() => {
              toast.success("承認しました", {
                description: "有効日時に care_asset_id を切り替えます。",
              })
              close()
            }}
          >
            承認
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
