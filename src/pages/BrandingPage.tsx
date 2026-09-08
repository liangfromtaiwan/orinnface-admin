/**
 * ブランド設定 (吉田さん確定 2026-09-08)
 *
 * 契約企業ごとに ブランド表示名 / ロゴ / メインカラー を設定する。
 * 設定するのは運営本部(operator)。必要な操作は
 * 編集・プレビュー・反映・標準表示へ戻す の 4 つ。
 * 「反映」と「標準表示へ戻す」は店舗側の見え方が変わる操作なので確認を挟む。
 *
 * 🔴 設定は企業単位。配下店舗へ共通適用する(店舗ごとの上書きは持たない)。
 * 🔴 B2C 画面は常に orinnFACE。preview にも「変わらない」ことを出して
 *    設定側が誤解しないようにする。
 * 🔴 draft は反映するまで店舗に出ない。preview と実際の表示を混同させない。
 *
 * 保存は backend 未実装。state は画面内に閉じており、操作は toast で示す。
 */

import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { InfoHint } from "@/components/InfoHint"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSession } from "@/contexts/session-context"
import {
  STANDARD_BRANDING,
  contrastRatio,
  hasUnappliedDraft,
  isStandard,
  previewBranding,
  readableTextOn,
  validateBranding,
  type Branding,
  type CompanyBranding,
} from "@/lib/domain/branding"
import { formatDateTime } from "@/lib/domain/kpi"
import { can } from "@/lib/domain/scope"
import { companyBrandings as seedBrandings, stores as allStores } from "@/lib/mock/seed"
import type { Company } from "@/lib/domain/types"

export default function BrandingPage() {
  const { scope, companies } = useSession()
  const editable = can(scope, "branding.manage")

  // 契約企業のみ。本部(internal)は設定対象ではない。
  const partners = useMemo(
    () => companies.filter((c) => c.kind === "partner"),
    [companies]
  )
  const [entries, setEntries] = useState<CompanyBranding[]>(seedBrandings)
  const [companyId, setCompanyId] = useState(partners[0]?.id ?? "")

  const company = partners.find((c) => c.id === companyId)
  const entry = entries.find((e) => e.companyId === companyId)

  function update(next: (prev: CompanyBranding | undefined) => CompanyBranding | undefined) {
    setEntries((prev) => {
      const rest = prev.filter((e) => e.companyId !== companyId)
      const updated = next(prev.find((e) => e.companyId === companyId))
      return updated ? [...rest, updated] : rest
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="ブランド設定"
        description="契約企業ごとの表示名・ロゴ・メインカラーを設定します。設定は企業単位で、配下店舗へ共通適用されます。"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="h-9 w-64">
            <SelectValue placeholder="契約企業" />
          </SelectTrigger>
          <SelectContent>
            {partners.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <StateBadge entry={entry} />
        {entry?.appliedAt ? (
          <span className="text-xs text-muted-foreground">
            最終反映 {formatDateTime(entry.appliedAt)}
          </span>
        ) : null}
      </div>

      {company ? (
        <BrandingEditor
          company={company}
          entry={entry}
          readOnly={!editable}
          onChangeDraft={(draft) =>
            update((prev) => ({ ...(prev ?? { companyId }), companyId, draft }))
          }
          onApply={() =>
            update((prev) => {
              const applied = previewBranding(prev)
              return {
                ...(prev ?? { companyId }),
                companyId,
                applied,
                draft: undefined,
                appliedAt: new Date().toISOString(),
              }
            })
          }
          onDiscard={() =>
            update((prev) => (prev ? { ...prev, draft: undefined } : prev))
          }
          onResetToStandard={() =>
            update((prev) =>
              prev
                ? {
                    companyId,
                    applied: undefined,
                    draft: undefined,
                    appliedAt: new Date().toISOString(),
                  }
                : prev
            )
          }
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            契約企業がありません
          </CardContent>
        </Card>
      )}

      <SpecNote>
        設定するのは運営本部です。契約企業管理者・店舗管理者はこの画面を開けません。
        設定は企業単位で保存し、配下店舗すべてに同じ表示が適用されます
        (店舗ごとの上書きは持ちません)。B2C アプリは契約企業の設定を受けず、
        常に orinnFACE ブランドで表示します。
        反映と標準表示へ戻す操作は監査ログ(ブランド設定変更)に記録します。
      </SpecNote>
    </div>
  )
}

function StateBadge({ entry }: { entry?: CompanyBranding }) {
  if (hasUnappliedDraft(entry)) {
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-700">
        未反映の変更あり
      </Badge>
    )
  }
  if (isStandard(entry)) return <Badge variant="outline">標準表示</Badge>
  return <Badge>反映済み</Badge>
}

/* ------------------------------------------------------------------ *
 * 編集フォーム + プレビュー
 * ------------------------------------------------------------------ */

function BrandingEditor({
  company,
  entry,
  readOnly,
  onChangeDraft,
  onApply,
  onDiscard,
  onResetToStandard,
}: {
  company: Company
  entry?: CompanyBranding
  readOnly: boolean
  onChangeDraft: (draft: Branding) => void
  onApply: () => void
  onDiscard: () => void
  onResetToStandard: () => void
}) {
  const draft = previewBranding(entry)
  const issues = validateBranding(draft)
  const dirty = hasUnappliedDraft(entry)
  const [confirm, setConfirm] = useState<null | "apply" | "reset">(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const storeCount = allStores.filter((s) => s.companyId === company.id).length

  function set(patch: Partial<Branding>) {
    onChangeDraft({ ...draft, ...patch })
  }

  /** この画面では preview のみ。保存先は backend 実装時に差し替える。 */
  function pickLogo(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set({ logoUrl: String(reader.result) })
    reader.readAsDataURL(file)
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">編集</CardTitle>
            <CardDescription>
              {company.name} ・ 配下 {storeCount} 店舗に共通適用されます
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="ブランド表示名" issue={issueFor(issues, "displayName")}>
              <Input
                value={draft.displayName}
                disabled={readOnly}
                onChange={(e) => set({ displayName: e.target.value })}
                placeholder={STANDARD_BRANDING.displayName}
              />
            </Field>

            <Field label="ロゴ" issue={issueFor(issues, "logoUrl")}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-10 w-24 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                  {draft.logoUrl ? (
                    <img src={draft.logoUrl} alt="" className="max-h-8 max-w-20 object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">未設定</span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/svg+xml"
                  className="hidden"
                  onChange={(e) => pickLogo(e.target.files?.[0])}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => fileRef.current?.click()}
                >
                  画像を選択
                </Button>
                {draft.logoUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={readOnly}
                    onClick={() => set({ logoUrl: undefined })}
                  >
                    削除
                  </Button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                未設定の場合はブランド表示名の文字を出します。PNG / SVG。
                この画面では preview のみで、保存先は backend 実装時に接続します。
              </p>
            </Field>

            <Field label="メインカラー" issue={issueFor(issues, "mainColor")}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.mainColor}
                  disabled={readOnly}
                  onChange={(e) => set({ mainColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded-md border bg-transparent disabled:cursor-not-allowed"
                  aria-label="メインカラー"
                />
                <Input
                  value={draft.mainColor}
                  disabled={readOnly}
                  onChange={(e) => set({ mainColor: e.target.value })}
                  className="w-32 font-mono"
                />
                <span className="text-xs text-muted-foreground">
                  文字色 {readableTextOn(draft.mainColor)} ・ コントラスト{" "}
                  {contrastRatio(draft.mainColor, readableTextOn(draft.mainColor)).toFixed(1)}:1
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                ボタンの背景に使うため、載せる文字が読める色かを自動で判定して
                白文字・黒文字を切り替えます。
              </p>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base font-medium">
              プレビュー
              <InfoHint label="プレビューについて">
                <p className="font-medium text-foreground">プレビュー</p>
                <p className="mt-1">
                  編集中の内容で描いています。<b>反映するまで店舗側の表示は変わりません</b>。
                </p>
                <p className="mt-1">
                  B2C アプリは契約企業の設定を受けないため、常に orinnFACE で表示します。
                </p>
              </InfoHint>
            </CardTitle>
            <CardDescription>
              {dirty ? "編集中の内容（店舗にはまだ出ていません）" : "現在の表示"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SurfacePreview label="管理画面" branding={draft} />
            <SurfacePreview label="B2B 結果画面" branding={draft} />
            <SurfacePreview
              label="B2C アプリ"
              branding={STANDARD_BRANDING}
              note="契約企業の設定を受けません"
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={readOnly || !dirty || issues.length > 0}
          onClick={() => setConfirm("apply")}
        >
          反映する
        </Button>
        <Button variant="outline" disabled={readOnly || !dirty} onClick={onDiscard}>
          編集を破棄
        </Button>
        <Button
          variant="outline"
          disabled={readOnly || isStandard(entry)}
          onClick={() => setConfirm("reset")}
        >
          標準表示へ戻す
        </Button>
        {issues.length > 0 ? (
          <span className="text-xs text-destructive">
            入力に問題があるため反映できません
          </span>
        ) : null}
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "apply" ? "この内容で反映しますか" : "標準表示へ戻しますか"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "apply" ? (
                <>
                  {company.name} の配下 {storeCount} 店舗すべての表示がすぐに切り替わります。
                  B2C アプリの表示は変わりません。
                </>
              ) : (
                <>
                  {company.name} の設定を消して orinnFACE の標準表示に戻します。
                  配下 {storeCount} 店舗すべてに反映されます。
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (confirm === "apply") {
                  onApply()
                  toast.success(`${company.name} に反映しました`, {
                    description: `配下 ${storeCount} 店舗へ共通適用・監査ログに記録します`,
                  })
                } else {
                  onResetToStandard()
                  toast.success(`${company.name} を標準表示に戻しました`)
                }
                setConfirm(null)
              }}
            >
              {confirm === "apply" ? "反映する" : "標準表示へ戻す"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function issueFor(
  issues: ReturnType<typeof validateBranding>,
  field: "displayName" | "logoUrl" | "mainColor"
) {
  return issues.find((i) => i.field === field)?.message
}

function Field({
  label,
  issue,
  children,
}: {
  label: string
  issue?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      {children}
      {issue ? <p className="mt-1 text-xs text-destructive">{issue}</p> : null}
    </div>
  )
}

/** ヘッダーとボタンだけの簡易プレビュー。実画面の縮小ではない。 */
function SurfacePreview({
  label,
  branding,
  note,
}: {
  label: string
  branding: Branding
  note?: string
}) {
  const text = readableTextOn(branding.mainColor)
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
        <span>{label}</span>
        {note ? <span>{note}</span> : null}
      </div>
      <div
        className="flex items-center justify-between gap-2 px-3 py-2.5"
        style={{ backgroundColor: branding.mainColor }}
      >
        <span className="flex items-center gap-2 truncate" style={{ color: text }}>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="max-h-5 max-w-16 object-contain" />
          ) : null}
          <span className="truncate text-sm font-semibold">{branding.displayName}</span>
        </span>
        <span
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium"
          style={{ backgroundColor: text, color: branding.mainColor }}
        >
          分析をはじめる
        </span>
      </div>
    </div>
  )
}
