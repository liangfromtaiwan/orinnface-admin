/**
 * care動画 (仕様書 v1.0 §7)
 *
 * 固定13枠、asset、差し替え申請、承認、公開、rollback。
 * 🔴 V1 は 13 枠だけ。slot 新設・14番目の枠・「はじめて向け」枠を追加しない。
 * 🚫 training_videos / facial_training / is_starter / release を実装名に使わない。
 * 🔴 差し替えは care_asset_id だけを切り替える。video_code / pose_code は不変。
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { CareAssetAddDialog, CareReplaceDialog } from "@/components/CareAssetDialog"
import { InfoHint } from "@/components/InfoHint"
import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  CARE_ASSET_SCOPE_LABEL,
  CARE_ASSET_USAGE_LABEL,
  CARE_CATEGORY_LABEL,
  CARE_VIDEO_SLOTS,
  careAssetUsage,
  decideCareReplacement,
  getCareSlot,
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

export default function CareVideosPage() {
  const { scope, careAssets, careAssignments } = useSession()
  const canApprove = can(scope, "care.approve")
  /*
    🔴 申請するのは契約企業・店舗で、本部は承認する側 (§7.1)。
       本部に申請を出させると自分で出して自分で承認する往復になるので、
       本部には「差し替え」を、それ以外には「差し替え申請」を出す。
  */
  const replacement = decideCareReplacement(scope)
  /** 登録済み動画の絞り込み。権利未確認だけを拾えると棚卸しに使える。 */
  const [assetFilter, setAssetFilter] = useState<
    "all" | "published" | "unused" | "rights_pending"
  >("all")

  const assetById = useMemo(
    () => new Map(careAssets.map((a) => [a.id, a])),
    [careAssets]
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
  }, [now, careAssignments])

  const requests = careAssignments.filter(
    (a) => a.status !== "active" || a.scope.companyId || a.scope.storeId
  )

  /** 表示順は枠の並び順に揃える(13 枠の表と読み比べられるように)。 */
  const sortedAssets = useMemo(() => {
    const order = new Map(CARE_VIDEO_SLOTS.map((s, i) => [s.videoCode, i]))
    return [...careAssets].sort(
      (a, b) =>
        (order.get(a.videoCode) ?? 99) - (order.get(b.videoCode) ?? 99) ||
        a.title.localeCompare(b.title)
    )
  }, [careAssets])

  const assetCounts = useMemo(
    () => ({
      all: sortedAssets.length,
      published: sortedAssets.filter(
        (a) => careAssetUsage(careAssignments, a.id).kind === "published"
      ).length,
      unused: sortedAssets.filter(
        (a) => careAssetUsage(careAssignments, a.id).kind === "unused"
      ).length,
      rightsPending: sortedAssets.filter((a) => !a.rightsCleared).length,
    }),
    [sortedAssets, careAssignments]
  )

  const listedAssets = useMemo(
    () =>
      sortedAssets.filter((a) => {
        if (assetFilter === "all") return true
        if (assetFilter === "rights_pending") return !a.rightsCleared
        return careAssetUsage(careAssignments, a.id).kind === assetFilter
      }),
    [sortedAssets, careAssignments, assetFilter]
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="care動画"
        description={`固定 ${CARE_VIDEO_SLOTS.length} 枠 / 登録済み動画 ${careAssets.length} 本。ユーザー向け機能名は「顔トレ」、内部総称は care video です。`}
        actions={
          replacement.kind === "denied" ? null : (
            <CareAssetAddDialog>
              <Button size="sm">動画を追加</Button>
            </CareAssetAddDialog>
          )
        }
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
                      {replacement.kind === "direct" ? (
                        <CareReplaceDialog
                          slot={slot}
                          currentAssetId={assignment?.careAssetId}
                        >
                          {/*
                            候補が無くてもダイアログ内から動画を上げられるので、
                            ここでは止めない。候補の有無はダイアログ側で案内する。
                          */}
                          <Button variant="outline" size="sm">
                            差し替え
                          </Button>
                        </CareReplaceDialog>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={replacement.kind === "denied"}
                          onClick={() =>
                            toast.info("差し替え申請", {
                              description: `${slot.videoCode} の care_asset_id のみを切り替えます。video_code / pose_code は変更しません。`,
                            })
                          }
                        >
                          差し替え申請
                        </Button>
                      )}
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

      {/*
        登録済みの動画はここでしか一覧できない。枠の表と差し替えダイアログは
        「その枠の今」しか出さないため、権利未確認の動画を探せる場所が無かった。
        §7.1 の「本部が提供者・内容・権利・承認状態・公開期間・対象 scope を
        確認する」はこの一覧が受け持つ。
      */}
      <Card className="py-0">
        <CardHeader className="flex-row items-center justify-between gap-2 pt-6">
          <CardTitle className="flex items-center gap-1.5 text-base">
            登録済み動画
            <InfoHint label="登録済み動画について">
              固定 13 枠に登録されている動画です。1 つの枠に複数の動画を登録でき、
              そのうち 1 本だけが公開されます。権利確認が済んでいない動画は
              公開できません。枠そのものは V1 では増やせません。
            </InfoHint>
          </CardTitle>
          <Select
            value={assetFilter}
            onValueChange={(v) => setAssetFilter(v as typeof assetFilter)}
          >
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて ({assetCounts.all})</SelectItem>
              <SelectItem value="published">
                公開中 ({assetCounts.published})
              </SelectItem>
              <SelectItem value="unused">未使用 ({assetCounts.unused})</SelectItem>
              <SelectItem value="rights_pending">
                権利未確認 ({assetCounts.rightsPending})
              </SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>タイトル</TableHead>
                <TableHead>提供者</TableHead>
                <TableHead>枠</TableHead>
                <TableHead className="text-right">尺</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>権利</TableHead>
                <TableHead>ファイル</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listedAssets.map((a) => {
                const usage = careAssetUsage(careAssignments, a.id)
                const slot = getCareSlot(a.videoCode)
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm font-medium">{a.title}</TableCell>
                    <TableCell className="text-sm">{a.provider}</TableCell>
                    <TableCell className="text-xs">
                      <span className="font-mono">{a.videoCode}</span>
                      {slot ? (
                        <span className="block text-muted-foreground">
                          {CARE_CATEGORY_LABEL[slot.category]} / {slot.targetLabel}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {a.durationSeconds}秒
                    </TableCell>
                    <TableCell className="text-xs">
                      {CARE_ASSET_USAGE_LABEL[usage.kind]}
                      {usage.kind === "published" ? (
                        <span className="block text-muted-foreground">
                          {CARE_ASSET_SCOPE_LABEL[usage.scope]}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {a.rightsCleared ? (
                        <span className="text-muted-foreground">確認済</span>
                      ) : (
                        <span className="text-amber-700">未確認</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                      {a.sourceFileName ?? "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {listedAssets.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              条件に合う動画はありません
            </p>
          ) : null}
        </div>
      </Card>

      <SpecNote>
        差し替えを申請するのは契約企業・店舗で、本部はそれを承認します。本部は自分が
        承認者なので、申請を挟まず本部デフォルトを直接差し替えます。動画は既存の枠に
        追加できますが、V1 で slot・pose・video_code を新設することはできません。差し替え時は care_asset_id だけを切り替え、元 asset・
        差し替え asset・申請者・承認者・理由・開始終了・取消・catalog version を履歴として
        保持します。会員権限は Guest = 推奨2件を lock 表示 + 登録 CTA(再生不可)、
        Member = 選定2動作の1分 care を JST 暦月10回、Premium = 1分・3分・リンパ・神経で
        商品上の月間上限なしです。
      </SpecNote>
    </div>
  )
}
