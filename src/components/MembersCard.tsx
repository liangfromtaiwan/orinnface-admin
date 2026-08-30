import { useState } from "react"
import { MoreHorizontalIcon, UserPlusIcon } from "lucide-react"
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

export type Member = {
  id: string
  name: string
  email: string
  role: string
  lastLoginAt: string // YYYY-MM-DD HH:mm
}

// ─────────────────────────────────────────────────────────────
// 視点別の Role 階層 + mock メンバーリスト
// ─────────────────────────────────────────────────────────────

const ADMIN_ROLES = ["Owner", "Admin", "Viewer"] as const
const COMPANY_ROLES = ["管理者", "メンバー"] as const

const ADMIN_MEMBERS: Member[] = [
  { id: "a1", name: "田中 太郎", email: "tanaka@orinnface.jp", role: "Owner", lastLoginAt: "2026-05-26 09:14" },
  { id: "a2", name: "佐々木 健", email: "sasaki@orinnface.jp", role: "Admin", lastLoginAt: "2026-05-25 18:42" },
  { id: "a3", name: "中島 美咲", email: "nakajima@orinnface.jp", role: "Admin", lastLoginAt: "2026-05-25 11:30" },
  { id: "a4", name: "井上 翔", email: "inoue@orinnface.jp", role: "Viewer", lastLoginAt: "2026-05-23 16:05" },
  { id: "a5", name: "藤井 葵", email: "fujii@orinnface.jp", role: "Viewer", lastLoginAt: "2026-05-22 10:20" },
]

const SHOP_A_MEMBERS: Member[] = [
  { id: "s1", name: "山田 健太", email: "kenta@shop-a.jp", role: "管理者", lastLoginAt: "2026-05-26 08:30" },
  { id: "s2", name: "高橋 さくら", email: "sakura@shop-a.jp", role: "メンバー", lastLoginAt: "2026-05-25 17:00" },
  { id: "s3", name: "森田 拓哉", email: "takuya@shop-a.jp", role: "メンバー", lastLoginAt: "2026-05-24 14:15" },
]

const YUMI_MEMBERS: Member[] = [
  { id: "k1", name: "Yumi", email: "yumi@orinnface-partner.jp", role: "管理者", lastLoginAt: "2026-05-26 10:05" },
  { id: "k2", name: "PR マネージャー", email: "manager@yumi-pr.jp", role: "メンバー", lastLoginAt: "2026-05-25 19:20" },
]

const KIGYO_X_MEMBERS: Member[] = [
  { id: "x1", name: "鈴木 一郎", email: "ichiro.suzuki@kigyo-x.jp", role: "管理者", lastLoginAt: "2026-05-26 09:00" },
  { id: "x2", name: "田村 結菜", email: "yuna.tamura@kigyo-x.jp", role: "管理者", lastLoginAt: "2026-05-25 13:45" },
  { id: "x3", name: "渡辺 直樹", email: "naoki.watanabe@kigyo-x.jp", role: "メンバー", lastLoginAt: "2026-05-24 16:30" },
  { id: "x4", name: "小林 さやか", email: "sayaka.kobayashi@kigyo-x.jp", role: "メンバー", lastLoginAt: "2026-05-23 11:10" },
]

const KIGYO_Y_MEMBERS: Member[] = [
  { id: "y1", name: "佐藤 美穂", email: "miho.sato@kigyo-y.jp", role: "管理者", lastLoginAt: "2026-05-26 08:50" },
  { id: "y2", name: "斎藤 拓未", email: "takumi.saito@kigyo-y.jp", role: "メンバー", lastLoginAt: "2026-05-25 14:20" },
  { id: "y3", name: "中川 涼", email: "ryo.nakagawa@kigyo-y.jp", role: "メンバー", lastLoginAt: "2026-05-24 17:00" },
]

function initialMembersFor(type: string, companyId: number): Member[] {
  if (type === "oem") {
    if (companyId === 2) return [...YUMI_MEMBERS]
    return [...SHOP_A_MEMBERS]
  }
  if (type === "b2b") {
    if (companyId === 4) return [...KIGYO_Y_MEMBERS]
    return [...KIGYO_X_MEMBERS]
  }
  return [...ADMIN_MEMBERS]
}

function rolesFor(type: string): readonly string[] {
  if (type === "admin") return ADMIN_ROLES
  return COMPANY_ROLES
}

function defaultRoleFor(type: string): string {
  if (type === "admin") return "Viewer"
  return "メンバー"
}

// Role に応じた Badge スタイル
type BadgeVariant = "default" | "secondary" | "outline" | "destructive"
function roleBadgeVariant(role: string): BadgeVariant {
  if (role === "Owner" || role === "管理者") return "default"
  if (role === "Admin") return "secondary"
  return "outline" // Viewer / メンバー
}

// ─────────────────────────────────────────────────────────────
// Helper:メール形式の簡易チェック
// ─────────────────────────────────────────────────────────────
function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

// ─────────────────────────────────────────────────────────────
// MembersCard
// ─────────────────────────────────────────────────────────────

export function MembersCard({
  type,
  companyId,
}: {
  type: string
  companyId: number
}) {
  const [members, setMembers] = useState<Member[]>(() =>
    initialMembersFor(type, companyId)
  )
  const roles = rolesFor(type)
  const defaultRole = defaultRoleFor(type)

  // 招待 Dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>(defaultRole)

  function openInvite() {
    setInviteEmail("")
    setInviteRole(defaultRole)
    setInviteOpen(true)
  }

  function handleInviteSubmit() {
    if (!isValidEmail(inviteEmail)) {
      toast.error("有効なメールアドレスを入力してください")
      return
    }
    if (members.some((m) => m.email === inviteEmail.trim())) {
      toast.error("このメールアドレスは既に招待されています")
      return
    }
    const newMember: Member = {
      id: `inv-${Date.now()}`,
      name: inviteEmail.split("@")[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      lastLoginAt: "—",
    }
    setMembers([...members, newMember])
    toast.success(`${inviteEmail.trim()} に招待メールを送信しました`)
    setInviteOpen(false)
  }

  // 編集 Dialog
  const [editTarget, setEditTarget] = useState<Member | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editRole, setEditRole] = useState<string>(defaultRole)

  function openEdit(m: Member) {
    setEditTarget(m)
    setEditName(m.name)
    setEditEmail(m.email)
    setEditRole(m.role)
  }

  function handleEditSubmit() {
    if (!editTarget) return
    if (!editName.trim()) {
      toast.error("姓名を入力してください")
      return
    }
    if (!isValidEmail(editEmail)) {
      toast.error("有効なメールアドレスを入力してください")
      return
    }
    setMembers(
      members.map((m) =>
        m.id === editTarget.id
          ? {
              ...m,
              name: editName.trim(),
              email: editEmail.trim(),
              role: editRole,
            }
          : m
      )
    )
    toast.success("メンバー情報を更新しました")
    setEditTarget(null)
  }

  // 削除 AlertDialog
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    setMembers(members.filter((m) => m.id !== deleteTarget.id))
    toast.success(`${deleteTarget.name} を削除しました`)
    setDeleteTarget(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>メンバー管理</CardTitle>
            <CardDescription>
              この組織にアクセスできるメンバーの招待・権限管理
            </CardDescription>
          </div>
          <Dialog open={inviteOpen} onOpenChange={(o) => (o ? openInvite() : setInviteOpen(false))}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlusIcon className="mr-1.5 size-4" />
                メンバーを招待
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>メンバーを招待</DialogTitle>
                <DialogDescription>
                  招待メールが送信されます。受信者が承認すると一覧に追加されます。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid gap-2">
                  <label htmlFor="invite-email" className="text-sm font-medium">
                    メールアドレス
                  </label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="member@example.jp"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="invite-role" className="text-sm font-medium">
                    Role
                  </label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleInviteSubmit}>送信</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            メンバーがいません。「メンバーを招待」から追加してください。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>メール</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>最終ログイン</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(m.role)}>
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {m.lastLoginAt}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`${m.name} のアクション`}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(m)}>
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(m)}
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
            <DialogTitle>メンバー情報の編集</DialogTitle>
            <DialogDescription>
              姓名 / メール / Role を変更できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="edit-name" className="text-sm font-medium">
                姓名
              </label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-email" className="text-sm font-medium">
                メール
              </label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-role" className="text-sm font-medium">
                Role
              </label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <AlertDialogTitle>メンバーを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name}({deleteTarget?.email})はこの組織から削除されます。この操作は取り消せません。
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
