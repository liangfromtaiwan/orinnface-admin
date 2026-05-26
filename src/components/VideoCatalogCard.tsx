import { useMemo, useState } from "react"
import { MoreHorizontalIcon, PlusIcon, VideoIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { VideoCategory } from "@/lib/mock-data/types"
import { allViewRecords, getVideoStats, videos } from "@/lib/mock-data/videos"

// ─────────────────────────────────────────────────────────────
// 表情カテゴリ(規格 v2 の 3 分類)に既存 5 カテゴリを mapping
// ─────────────────────────────────────────────────────────────

type CatalogCategory = "おだやか" | "ゆらぎ" | "張り"
const CATALOG_CATEGORIES: CatalogCategory[] = ["おだやか", "ゆらぎ", "張り"]

const CATEGORY_MAP: Record<VideoCategory, CatalogCategory> = {
  stretch: "張り",
  yoga: "張り",
  meditation: "おだやか",
  breathing: "おだやか",
  "eye-care": "ゆらぎ",
}

type Duration = 30 | 60
const DURATIONS: Duration[] = [30, 60]

type CatalogStatus = "public" | "hidden"

type CatalogVideo = {
  id: string
  title: string
  category: CatalogCategory
  durationSeconds: Duration
  status: CatalogStatus
  viewCount: number
  fileName?: string // 最後に差し替えたファイル名(mock 表示用)
}

// mock の 12 本 + viewCount を初期 catalog に変換
// 一部を「非公開」にしてバリエーションを出す(11 と 12)
const HIDDEN_DEFAULT_IDS = new Set([11, 12])

function buildInitialCatalog(): CatalogVideo[] {
  return videos.map((v) => {
    const stats = getVideoStats(v.id, allViewRecords)
    return {
      id: `v${v.id}`,
      title: v.title,
      category: CATEGORY_MAP[v.category],
      durationSeconds: (v.durationSeconds === 60 ? 60 : 30) as Duration,
      status: HIDDEN_DEFAULT_IDS.has(v.id) ? "hidden" : "public",
      viewCount: stats.viewCount,
    }
  })
}

// Badge variant 共通
type BadgeVariant = "default" | "secondary" | "outline" | "destructive"
function categoryBadgeVariant(c: CatalogCategory): BadgeVariant {
  if (c === "おだやか") return "secondary"
  if (c === "張り") return "default"
  return "outline"
}

// ─────────────────────────────────────────────────────────────
// VideoCatalogCard
// ─────────────────────────────────────────────────────────────

export function VideoCatalogCard() {
  const [catalog, setCatalog] = useState<CatalogVideo[]>(buildInitialCatalog)

  // 追加 Dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addTitle, setAddTitle] = useState("")
  const [addCategory, setAddCategory] = useState<CatalogCategory>("おだやか")
  const [addDuration, setAddDuration] = useState<Duration>(30)
  const [addStatus, setAddStatus] = useState<CatalogStatus>("public")
  const [addFileName, setAddFileName] = useState<string>("")

  function openAdd() {
    setAddTitle("")
    setAddCategory("おだやか")
    setAddDuration(30)
    setAddStatus("public")
    setAddFileName("")
    setAddOpen(true)
  }

  function handleAddFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("video/")) {
      toast.error("動画ファイルを選択してください")
      return
    }
    setAddFileName(file.name)
  }

  function handleAddSubmit() {
    if (!addTitle.trim()) {
      toast.error("タイトルを入力してください")
      return
    }
    const newVideo: CatalogVideo = {
      id: `v-${Date.now()}`,
      title: addTitle.trim(),
      category: addCategory,
      durationSeconds: addDuration,
      status: addStatus,
      viewCount: 0,
      fileName: addFileName || undefined,
    }
    setCatalog([newVideo, ...catalog])
    toast.success(`${newVideo.title} を追加しました`)
    setAddOpen(false)
  }

  // 編集 Dialog
  const [editTarget, setEditTarget] = useState<CatalogVideo | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editCategory, setEditCategory] = useState<CatalogCategory>("おだやか")
  const [editDuration, setEditDuration] = useState<Duration>(30)
  const [editStatus, setEditStatus] = useState<CatalogStatus>("public")
  // 編集 dialog で新しく選択された差し替えファイル名(空文字 = 未差し替え)
  const [editNewFileName, setEditNewFileName] = useState<string>("")

  function openEdit(v: CatalogVideo) {
    setEditTarget(v)
    setEditTitle(v.title)
    setEditCategory(v.category)
    setEditDuration(v.durationSeconds)
    setEditStatus(v.status)
    setEditNewFileName("")
  }

  function handleEditFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("video/")) {
      toast.error("動画ファイルを選択してください")
      return
    }
    setEditNewFileName(file.name)
  }

  function handleEditSubmit() {
    if (!editTarget) return
    if (!editTitle.trim()) {
      toast.error("タイトルを入力してください")
      return
    }
    setCatalog(
      catalog.map((v) =>
        v.id === editTarget.id
          ? {
              ...v,
              title: editTitle.trim(),
              category: editCategory,
              durationSeconds: editDuration,
              status: editStatus,
              // 差し替えファイルが選択された場合のみ fileName を更新
              fileName: editNewFileName || v.fileName,
            }
          : v
      )
    )
    toast.success(
      editNewFileName
        ? "動画情報とファイルを更新しました"
        : "動画情報を更新しました"
    )
    setEditTarget(null)
  }

  // 削除 AlertDialog
  const [deleteTarget, setDeleteTarget] = useState<CatalogVideo | null>(null)
  function handleDeleteConfirm() {
    if (!deleteTarget) return
    setCatalog(catalog.filter((v) => v.id !== deleteTarget.id))
    toast.success(`${deleteTarget.title} を削除しました`)
    setDeleteTarget(null)
  }

  // 公開/非公開トグル
  function handleToggleStatus(v: CatalogVideo) {
    const nextStatus: CatalogStatus = v.status === "public" ? "hidden" : "public"
    setCatalog(
      catalog.map((x) =>
        x.id === v.id ? { ...x, status: nextStatus } : x
      )
    )
    toast.success(
      nextStatus === "hidden"
        ? `${v.title} を非公開にしました`
        : `${v.title} を公開にしました`
    )
  }

  const totalViews = useMemo(
    () => catalog.reduce((s, v) => s + v.viewCount, 0),
    [catalog]
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>動画 catalog</CardTitle>
            <CardDescription>
              ケア動画の追加・編集・カテゴリ管理({catalog.length} 本、合計視聴 {totalViews} 件)
            </CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={(o) => (o ? openAdd() : setAddOpen(false))}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-1.5 size-4" />
                動画追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>動画を追加</DialogTitle>
                <DialogDescription>
                  新しいケア動画を catalog に追加します。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid gap-2">
                  <label htmlFor="add-title" className="text-sm font-medium">
                    タイトル
                  </label>
                  <Input
                    id="add-title"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder="例:首肩クイックストレッチ"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label htmlFor="add-category" className="text-sm font-medium">
                      カテゴリ
                    </label>
                    <Select
                      value={addCategory}
                      onValueChange={(v) =>
                        setAddCategory(v as CatalogCategory)
                      }
                    >
                      <SelectTrigger id="add-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATALOG_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="add-duration" className="text-sm font-medium">
                      尺
                    </label>
                    <Select
                      value={String(addDuration)}
                      onValueChange={(v) =>
                        setAddDuration(Number(v) as Duration)
                      }
                    >
                      <SelectTrigger id="add-duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATIONS.map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d}秒
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">動画ファイル</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button asChild variant="outline" size="sm">
                      <label className="cursor-pointer">
                        ファイルを選択
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={handleAddFile}
                        />
                      </label>
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {addFileName || "未選択"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    MP4 / WebM(mock のため実際にはアップロードされません)
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">公開ステータス</label>
                    <p className="text-xs text-muted-foreground">
                      ON:公開中 / OFF:非公開
                    </p>
                  </div>
                  <Switch
                    checked={addStatus === "public"}
                    onCheckedChange={(v) =>
                      setAddStatus(v ? "public" : "hidden")
                    }
                    aria-label="公開ステータス"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleAddSubmit}>追加</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {catalog.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            動画がありません。「動画追加」から追加してください。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">サムネイル</TableHead>
                  <TableHead>タイトル</TableHead>
                  <TableHead>カテゴリ</TableHead>
                  <TableHead>尺</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">視聴回数</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalog.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                        <VideoIcon className="size-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{v.title}</TableCell>
                    <TableCell>
                      <Badge variant={categoryBadgeVariant(v.category)}>
                        {v.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={v.durationSeconds === 30 ? "secondary" : "outline"}
                      >
                        {v.durationSeconds}秒
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={v.status === "public" ? "default" : "outline"}
                        className={
                          v.status === "hidden"
                            ? "text-muted-foreground"
                            : undefined
                        }
                      >
                        {v.status === "public" ? "公開中" : "非公開"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {v.viewCount}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`${v.title} のアクション`}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(v)}>
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(v)}>
                            {v.status === "public" ? "非公開にする" : "公開する"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(v)}
                          >
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* 編集 Dialog */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(o) => (!o ? setEditTarget(null) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>動画情報の編集</DialogTitle>
            <DialogDescription>
              タイトル / カテゴリ / 尺 / ファイル / ステータス を変更できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="edit-title" className="text-sm font-medium">
                タイトル
              </label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="edit-category" className="text-sm font-medium">
                  カテゴリ
                </label>
                <Select
                  value={editCategory}
                  onValueChange={(v) => setEditCategory(v as CatalogCategory)}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOG_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="edit-duration" className="text-sm font-medium">
                  尺
                </label>
                <Select
                  value={String(editDuration)}
                  onValueChange={(v) => setEditDuration(Number(v) as Duration)}
                >
                  <SelectTrigger id="edit-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}秒
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">動画ファイル</label>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" size="sm">
                  <label className="cursor-pointer">
                    ファイルを差し替え
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleEditFile}
                    />
                  </label>
                </Button>
                {editNewFileName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditNewFileName("")}
                  >
                    クリア
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {editNewFileName
                  ? `新ファイル:${editNewFileName}`
                  : editTarget?.fileName
                    ? `現ファイル:${editTarget.fileName}(差し替えなし)`
                    : "差し替えしない場合は現在のファイルが維持されます"}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">公開ステータス</label>
                <p className="text-xs text-muted-foreground">
                  ON:公開中 / OFF:非公開
                </p>
              </div>
              <Switch
                checked={editStatus === "public"}
                onCheckedChange={(v) => setEditStatus(v ? "public" : "hidden")}
                aria-label="公開ステータス"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              キャンセル
            </Button>
            <Button onClick={handleEditSubmit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除 AlertDialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => (!o ? setDeleteTarget(null) : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>動画を削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title}を catalog から削除します。視聴回数の集計データには影響しません。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
