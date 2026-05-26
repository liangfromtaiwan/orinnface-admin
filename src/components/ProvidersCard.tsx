import { useState } from "react"
import { MoreHorizontalIcon, PlusIcon } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─────────────────────────────────────────────────────────────
// Type 定義 + 定数
// ─────────────────────────────────────────────────────────────

type ProviderType = "OEM" | "BtoB"
type ProviderStatus = "active" | "suspended"

type Provider = {
  id: string
  name: string
  type: ProviderType
  plan: string
  userCount: number
  status: ProviderStatus
  contactName: string
  contactEmail: string
}

const OEM_PLANS = ["ベーシック", "スタンダード", "プロフェッショナル"] as const
const B2B_PLANS = ["スタンダード", "エンタープライズ", "カスタム"] as const

function plansFor(type: ProviderType): readonly string[] {
  return type === "OEM" ? OEM_PLANS : B2B_PLANS
}

function defaultPlanFor(type: ProviderType): string {
  return type === "OEM" ? "ベーシック" : "スタンダード"
}

const INITIAL_PROVIDERS: Provider[] = [
  {
    id: "p1",
    name: "店舗A 美容サロン",
    type: "OEM",
    plan: "ベーシック",
    userCount: 8,
    status: "active",
    contactName: "山田 健太",
    contactEmail: "kenta@shop-a.jp",
  },
  {
    id: "p2",
    name: "Yumi(美容 KOL)",
    type: "OEM",
    plan: "ベーシック",
    userCount: 6,
    status: "active",
    contactName: "Yumi",
    contactEmail: "yumi@orinnme-partner.jp",
  },
  {
    id: "p3",
    name: "企業X 株式会社",
    type: "BtoB",
    plan: "エンタープライズ",
    userCount: 15,
    status: "active",
    contactName: "鈴木 一郎",
    contactEmail: "ichiro.suzuki@kigyo-x.jp",
  },
  {
    id: "p4",
    name: "企業Y 株式会社",
    type: "BtoB",
    plan: "スタンダード",
    userCount: 12,
    status: "suspended",
    contactName: "佐藤 美穂",
    contactEmail: "miho.sato@kigyo-y.jp",
  },
]

// ─────────────────────────────────────────────────────────────
// helper
// ─────────────────────────────────────────────────────────────

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

// ─────────────────────────────────────────────────────────────
// ProvidersCard
// ─────────────────────────────────────────────────────────────

export function ProvidersCard() {
  const [providers, setProviders] = useState<Provider[]>(INITIAL_PROVIDERS)

  // 新規追加 Dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addType, setAddType] = useState<ProviderType>("OEM")
  const [addPlan, setAddPlan] = useState<string>(defaultPlanFor("OEM"))
  const [addContactName, setAddContactName] = useState("")
  const [addContactEmail, setAddContactEmail] = useState("")

  function openAdd() {
    setAddName("")
    setAddType("OEM")
    setAddPlan(defaultPlanFor("OEM"))
    setAddContactName("")
    setAddContactEmail("")
    setAddOpen(true)
  }

  function handleAddTypeChange(t: ProviderType) {
    setAddType(t)
    setAddPlan(defaultPlanFor(t))
  }

  function handleAddSubmit() {
    if (!addName.trim()) {
      toast.error("会社名を入力してください")
      return
    }
    if (!addContactName.trim()) {
      toast.error("連絡担当者を入力してください")
      return
    }
    if (!isValidEmail(addContactEmail)) {
      toast.error("有効なメールアドレスを入力してください")
      return
    }
    const newProvider: Provider = {
      id: `p-${Date.now()}`,
      name: addName.trim(),
      type: addType,
      plan: addPlan,
      userCount: 0,
      status: "active",
      contactName: addContactName.trim(),
      contactEmail: addContactEmail.trim(),
    }
    setProviders([...providers, newProvider])
    toast.success(`${newProvider.name} を追加しました`)
    setAddOpen(false)
  }

  // 編集 Dialog
  const [editTarget, setEditTarget] = useState<Provider | null>(null)
  const [editName, setEditName] = useState("")
  const [editType, setEditType] = useState<ProviderType>("OEM")
  const [editPlan, setEditPlan] = useState<string>("")
  const [editContactName, setEditContactName] = useState("")
  const [editContactEmail, setEditContactEmail] = useState("")

  function openEdit(p: Provider) {
    setEditTarget(p)
    setEditName(p.name)
    setEditType(p.type)
    setEditPlan(p.plan)
    setEditContactName(p.contactName)
    setEditContactEmail(p.contactEmail)
  }

  function handleEditTypeChange(t: ProviderType) {
    setEditType(t)
    // type 変更時はプランを既定にリセット
    if (!plansFor(t).includes(editPlan)) {
      setEditPlan(defaultPlanFor(t))
    }
  }

  function handleEditSubmit() {
    if (!editTarget) return
    if (!editName.trim()) {
      toast.error("会社名を入力してください")
      return
    }
    if (!editContactName.trim()) {
      toast.error("連絡担当者を入力してください")
      return
    }
    if (!isValidEmail(editContactEmail)) {
      toast.error("有効なメールアドレスを入力してください")
      return
    }
    setProviders(
      providers.map((p) =>
        p.id === editTarget.id
          ? {
              ...p,
              name: editName.trim(),
              type: editType,
              plan: editPlan,
              contactName: editContactName.trim(),
              contactEmail: editContactEmail.trim(),
            }
          : p
      )
    )
    toast.success("提供先情報を更新しました")
    setEditTarget(null)
  }

  // 停止 / 再開(確認なし、即座にトグル)
  function handleToggleStatus(p: Provider) {
    const nextStatus: ProviderStatus =
      p.status === "active" ? "suspended" : "active"
    setProviders(
      providers.map((x) =>
        x.id === p.id ? { ...x, status: nextStatus } : x
      )
    )
    toast.success(
      nextStatus === "suspended"
        ? `${p.name} を停止しました`
        : `${p.name} を再開しました`
    )
  }

  // 削除 AlertDialog
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null)
  function handleDeleteConfirm() {
    if (!deleteTarget) return
    setProviders(providers.filter((p) => p.id !== deleteTarget.id))
    toast.success(`${deleteTarget.name} を削除しました`)
    setDeleteTarget(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>提供先管理</CardTitle>
            <CardDescription>
              OEM / BtoB クライアントの追加・停止・プラン変更
            </CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={(o) => (o ? openAdd() : setAddOpen(false))}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-1.5 size-4" />
                新規追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>提供先を新規追加</DialogTitle>
                <DialogDescription>
                  クライアント企業 / 店舗を契約に追加します。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid gap-2">
                  <label htmlFor="add-name" className="text-sm font-medium">
                    会社名
                  </label>
                  <Input
                    id="add-name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="例:〇〇 株式会社"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label htmlFor="add-type" className="text-sm font-medium">
                      タイプ
                    </label>
                    <Select
                      value={addType}
                      onValueChange={(v) =>
                        handleAddTypeChange(v as ProviderType)
                      }
                    >
                      <SelectTrigger id="add-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OEM">OEM</SelectItem>
                        <SelectItem value="BtoB">BtoB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="add-plan" className="text-sm font-medium">
                      プラン
                    </label>
                    <Select value={addPlan} onValueChange={setAddPlan}>
                      <SelectTrigger id="add-plan">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {plansFor(addType).map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="add-contact-name"
                    className="text-sm font-medium"
                  >
                    連絡担当者(姓名)
                  </label>
                  <Input
                    id="add-contact-name"
                    value={addContactName}
                    onChange={(e) => setAddContactName(e.target.value)}
                    placeholder="例:山田 太郎"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="add-contact-email"
                    className="text-sm font-medium"
                  >
                    連絡担当者メール
                  </label>
                  <Input
                    id="add-contact-email"
                    type="email"
                    value={addContactEmail}
                    onChange={(e) => setAddContactEmail(e.target.value)}
                    placeholder="contact@example.jp"
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
        {providers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            提供先がいません。「新規追加」から追加してください。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>会社名</TableHead>
                  <TableHead>タイプ</TableHead>
                  <TableHead>プラン</TableHead>
                  <TableHead className="text-right">ユーザー数</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant={p.type === "OEM" ? "secondary" : "outline"}>
                        {p.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{p.plan}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.userCount}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.status === "active" ? "default" : "outline"}
                        className={
                          p.status === "suspended"
                            ? "text-muted-foreground"
                            : undefined
                        }
                      >
                        {p.status === "active" ? "稼働中" : "停止中"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`${p.name} のアクション`}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(p)}
                          >
                            {p.status === "active" ? "停止" : "再開"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(p)}
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
            <DialogTitle>提供先情報の編集</DialogTitle>
            <DialogDescription>
              会社名 / タイプ / プラン / 連絡担当者 を変更できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="edit-name" className="text-sm font-medium">
                会社名
              </label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="edit-type" className="text-sm font-medium">
                  タイプ
                </label>
                <Select
                  value={editType}
                  onValueChange={(v) => handleEditTypeChange(v as ProviderType)}
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OEM">OEM</SelectItem>
                    <SelectItem value="BtoB">BtoB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="edit-plan" className="text-sm font-medium">
                  プラン
                </label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger id="edit-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plansFor(editType).map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-contact-name" className="text-sm font-medium">
                連絡担当者(姓名)
              </label>
              <Input
                id="edit-contact-name"
                value={editContactName}
                onChange={(e) => setEditContactName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-contact-email" className="text-sm font-medium">
                連絡担当者メール
              </label>
              <Input
                id="edit-contact-email"
                type="email"
                value={editContactEmail}
                onChange={(e) => setEditContactEmail(e.target.value)}
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
            <AlertDialogTitle>提供先を削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name}({deleteTarget?.type})を契約から削除します。この操作は取り消せません。
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
