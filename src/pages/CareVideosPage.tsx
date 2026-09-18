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
import { CareRequestReviewDialog } from "@/components/CareRequestReviewDialog"
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
import {
  useCompanyName,
  useSession,
  useStoreName,
} from "@/contexts/session-context"
import {
  CARE_ASSET_USAGE_LABEL,
  CARE_CATEGORY_LABEL,
  CARE_VIDEO_SLOTS,
  careAssetUsage,
  careScopeLabel,
  decideCareReplacement,
  visibleCareRequests,
  getCareSlot,
  providerOf,
  resolveAssignment,
} from "@/lib/domain/care-catalog"
import { formatDate, formatDateTime } from "@/lib/domain/kpi"
import { stores as allStores } from "@/lib/mock/seed"
import { can } from "@/lib/domain/scope"
import {
  CARE_ASSIGNMENT_STATUS_LABEL,
  PLAN_LABEL,
  type CareAssignment,
} from "@/lib/domain/types"

export default function CareVideosPage() {
  const { scope, careAssets, careAssignments } = useSession()
  /* 🔴 適用範囲は「どの会社・どの店舗か」まで出す (careScopeLabel)。 */
  const companyName = useCompanyName()
  const storeName = useStoreName()
  const scopeNames = { company: companyName, store: storeName }
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
  /** 確認ダイアログを開いている差し替え申請。 */
  const [reviewing, setReviewing] = useState<string | null>(null)

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

  /*
    🔴 本部以外には**自分に効くものだけ**見せる。他社の申請が見えると、どこがどの
       動画を使っているかが漏れる。実 API では同じ条件を backend でも検証する。
  */
  const scopedAssignments = useMemo(
    () => visibleCareRequests(careAssignments, scope, allStores),
    [careAssignments, scope]
  )

  /**
   * 処理中の差し替え申請。終わったものは履歴へ送る。
   * 🔴 却下されたものは、本部の審査待ち一覧では終わった話なので履歴へ送るが、
   *    申請元には残す。却下されたことだけ分かって理由が分からないと、同じ申請が
   *    出し直される(却下理由は `decisionReason` に入る)。
   */
  const requests = scopedAssignments.filter(
    (a) =>
      (a.scope.companyId || a.scope.storeId) &&
      a.status !== "ended" &&
      (a.status !== "rejected" || !canApprove)
  )

  /**
   * 差し替えの履歴 (§7.1)。元 asset・差し替え asset・申請者・承認者・理由・
   * 開始終了・取消・catalog version を残す。本部が直接差し替えたものも含める
   * (申請を経ないだけで、履歴としては同じ差し替え)。
   */
  const history = useMemo(
    () =>
      [...scopedAssignments].sort((a, b) =>
        (b.decidedAt ?? b.startAt ?? b.createdAt).localeCompare(
          a.decidedAt ?? a.startAt ?? a.createdAt
        )
      ),
    [scopedAssignments]
  )

  const reviewingRequest = scopedAssignments.find((r) => r.id === reviewing)

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
            {canApprove ? "差し替え申請" : "自社の差し替え申請"}
            <InfoHint label="差し替え申請について">
              {canApprove ? (
                <p>
                  申請を出すのは契約企業・店舗で、本部が内容・権利・範囲を確認して承認
                  します。行を開くと動画の中身を見てから承認・却下できます。
                </p>
              ) : (
                <p>
                  自社から出した申請の状況です。承認するのは本部なので、この画面から
                  承認・却下はできません。却下された場合は理由がここに出ます。
                </p>
              )}
              <p className="mt-1">
                本部承認前の asset は顧客へ公開できません。重複する有効期間は publish 前に
                拒否します。差し替えは care_asset_id だけを切り替え、video_code と
                pose_code は変更しません。
              </p>
            </InfoHint>
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>video_code</TableHead>
                <TableHead>適用範囲</TableHead>
                {/*
                  🔴 申請者・権利・操作は審査のための列。審査できるのは本部だけなので
                     (§4.2)、企業・店舗には出さない。自分が出した申請の状況と、
                     却下されたときの理由だけを見せる。
                */}
                {canApprove ? <TableHead>申請者</TableHead> : null}
                <TableHead>状態</TableHead>
                <TableHead>期間</TableHead>
                {canApprove ? <TableHead>権利</TableHead> : null}
                {canApprove ? (
                  <TableHead className="text-right">操作</TableHead>
                ) : (
                  <TableHead>却下理由</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const asset = assetById.get(r.careAssetId)
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => setReviewing(r.id)}
                  >
                    <TableCell className="font-mono text-xs">{r.videoCode}</TableCell>
                    <TableCell className="text-sm">
                      {careScopeLabel(r.scope, scopeNames)}
                    </TableCell>
                    {canApprove ? (
                      <TableCell className="text-sm">{r.requestedBy}</TableCell>
                    ) : null}
                    <TableCell className="text-sm">
                      {CARE_ASSIGNMENT_STATUS_LABEL[r.status]}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {r.startAt ? formatDate(r.startAt) : "—"}
                      {r.endAt ? ` 〜 ${formatDate(r.endAt)}` : ""}
                    </TableCell>
                    {canApprove ? (
                      <TableCell className="text-xs">
                        {asset?.rightsCleared ? (
                          <span className="text-muted-foreground">確認済</span>
                        ) : (
                          <span className="text-amber-700">未確認</span>
                        )}
                      </TableCell>
                    ) : null}
                    {canApprove ? (
                      <TableCell className="text-right">
                        {/*
                          🔴 承認・却下は確認ダイアログの中だけ。§7.1 は「内容を確認して
                             approve」なので、一覧から中身を見ずに承認できるようにしない。
                        */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewing(r.id)}
                        >
                          内容を確認
                          {r.status === "pending_approval" ? "・承認" : ""}
                        </Button>
                      </TableCell>
                    ) : (
                      /* 却下されたことだけ分かって理由が分からないと、同じ申請を出し直す */
                      <TableCell className="max-w-56 text-xs text-muted-foreground">
                        {r.decisionReason ? (
                          <span className="block truncate" title={r.decisionReason}>
                            {r.decisionReason}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/*
        §7.1 の履歴保持。元 asset・差し替え asset・申請者・承認者・理由・開始終了・
        取消・catalog version を残す。rollback(公開の取り消し)の根拠になるので、
        却下・終了したものも消さずに並べる。本部が申請を経ずに直接差し替えたものも
        同じ履歴に入れる(経路が違うだけで、起きたことは同じ差し替え)。
      */}
      <Card className="py-0">
        <CardHeader className="flex-row items-center justify-between gap-2 pt-6">
          <CardTitle className="flex items-center gap-1.5 text-base">
            差し替え履歴
            <InfoHint label="差し替え履歴について">
              <p>
                元の動画・差し替え後の動画・申請者・承認者・理由・開始終了・catalog
                version を残します。公開中のものは行を開いて取り消せます(本部のみ)。
              </p>
              <p className="mt-1">
                取り消すと、その範囲は一段広い範囲の動画(会社 → 本部デフォルト)に
                戻ります。枠そのものは変わりません。
              </p>
            </InfoHint>
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>video_code</TableHead>
                <TableHead>適用範囲</TableHead>
                <TableHead>動画</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>期間</TableHead>
                <TableHead>申請者 / 承認者</TableHead>
                <TableHead>理由</TableHead>
                <TableHead>catalog</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((a) => {
                const asset = assetById.get(a.careAssetId)
                const previous = a.previousCareAssetId
                  ? assetById.get(a.previousCareAssetId)
                  : undefined
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer align-top"
                    onClick={() => setReviewing(a.id)}
                  >
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(a.decidedAt ?? a.startAt ?? a.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.videoCode}</TableCell>
                    <TableCell className="text-xs">
                      {careScopeLabel(a.scope, scopeNames)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {previous ? (
                        <span className="block text-muted-foreground line-through">
                          {previous.title}
                        </span>
                      ) : null}
                      <span className="block">{asset?.title ?? a.careAssetId}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {CARE_ASSIGNMENT_STATUS_LABEL[a.status]}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {a.startAt ? formatDate(a.startAt) : "—"}
                      {a.endAt ? ` 〜 ${formatDate(a.endAt)}` : ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="block">{a.requestedBy}</span>
                      <span className="block text-muted-foreground">
                        {a.approvedBy ?? "未承認"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-56 text-xs">
                      <span className="block truncate" title={a.reason}>
                        {a.reason}
                      </span>
                      {a.decisionReason ? (
                        <span
                          className="block truncate text-muted-foreground"
                          title={a.decisionReason}
                        >
                          {a.decisionReason}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {a.catalogVersion}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              差し替えの履歴はまだありません
            </p>
          ) : null}
        </div>
      </Card>

      {/*
        登録済みの動画はここでしか一覧できない。枠の表と差し替えダイアログは
        「その枠の今」しか出さないため、権利未確認の動画を探せる場所が無かった。
        §7.1 の「本部が提供者・内容・権利・承認状態・公開期間・対象 scope を
        確認する」はこの一覧が受け持つ。
        🔴 権利の棚卸しは本部の仕事なので**本部にだけ出す**。契約企業・店舗に
           在庫一覧は要らないうえ、`CareVideoAsset` に持ち主の情報が無いため
           他社が登録した動画の題名・提供者まで見えてしまう
           (持ち主の持ち方は docs/QUESTIONS_FOR_YOSHIDA.md #20 で確認中)。
      */}
      {canApprove ? (
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
                          {careScopeLabel(usage, scopeNames)}
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
      ) : null}

      <SpecNote>
        差し替えを申請するのは契約企業・店舗で、本部はそれを承認します。本部は自分が
        承認者なので、申請を挟まず本部デフォルトを直接差し替えます。動画は既存の枠に
        追加できますが、V1 で slot・pose・video_code を新設することはできません。差し替え時は care_asset_id だけを切り替え、元 asset・
        差し替え asset・申請者・承認者・理由・開始終了・取消・catalog version を履歴として
        保持します。会員権限は Guest = 推奨2件をロック表示 + 登録の案内(再生不可)、
        Member = 選定2動作の1分 care を JST 暦月10回、Premium = 1分・3分・リンパ・神経で
        商品上の月間上限なしです。
      </SpecNote>

      {reviewingRequest ? (
        <CareRequestReviewDialog
          request={reviewingRequest}
          open
          onOpenChange={(next) => {
            if (!next) setReviewing(null)
          }}
        />
      ) : null}
    </div>
  )
}
