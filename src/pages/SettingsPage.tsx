import { useState } from "react"
import {
  BellIcon,
  Building2Icon,
  BuildingIcon,
  CreditCardIcon,
  StoreIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { MembersCard } from "@/components/MembersCard"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
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
import { Input } from "@/components/ui/input"

// ─────────────────────────────────────────────────────────────
// 視点別 mock データ(真實実装では JWT claim から取得)
// ─────────────────────────────────────────────────────────────

type AccountInitial = {
  name: string
  displayName: string
  email: string
}

function initialAccountFor(type: string, companyId: number): AccountInitial {
  if (type === "oem") {
    if (companyId === 2) {
      return {
        name: "Yumi",
        displayName: "Yumi",
        email: "yumi@orinnme-partner.jp",
      }
    }
    return {
      name: "山田 健太",
      displayName: "山田",
      email: "kenta@shop-a.jp",
    }
  }
  if (type === "b2b") {
    if (companyId === 4) {
      return {
        name: "佐藤 美穂",
        displayName: "佐藤",
        email: "miho.sato@kigyo-y.jp",
      }
    }
    return {
      name: "鈴木 一郎",
      displayName: "鈴木",
      email: "ichiro.suzuki@kigyo-x.jp",
    }
  }
  return {
    name: "田中 太郎",
    displayName: "田中",
    email: "tanaka@orinnme.jp",
  }
}

// ─────────────────────────────────────────────────────────────
// プロフィール Card
// ─────────────────────────────────────────────────────────────

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB

function ProfileCard({ initial }: { initial: AccountInitial }) {
  // 現在保存されている値(セッション内 mock 更新)
  const [name, setName] = useState(initial.name)
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [avatarUrl, setAvatarUrl] = useState<string>("")

  // Dialog 内の編集ドラフト
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(initial.name)
  const [draftDisplay, setDraftDisplay] = useState(initial.displayName)
  const [draftAvatar, setDraftAvatar] = useState<string>("")

  function openDialog() {
    // 現在保存値を drafts に再同期してから開く
    setDraftName(name)
    setDraftDisplay(displayName)
    setDraftAvatar(avatarUrl)
    setOpen(true)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // 同じファイルを再選択できるよう input をリセット
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください")
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("画像は 2MB 以下を選択してください")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setDraftAvatar(reader.result as string)
    }
    reader.onerror = () => {
      toast.error("画像の読み込みに失敗しました")
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit() {
    if (!draftName.trim()) {
      toast.error("姓名を入力してください")
      return
    }
    if (!draftDisplay.trim()) {
      toast.error("表示名を入力してください")
      return
    }
    setName(draftName.trim())
    setDisplayName(draftDisplay.trim())
    setAvatarUrl(draftAvatar)
    toast.success("保存しました")
    setOpen(false)
  }

  const fallbackChar = displayName.slice(0, 1) || "?"
  const draftFallback = draftDisplay.slice(0, 1) || "?"

  return (
    <Card>
      <CardHeader>
        <CardTitle>プロフィール</CardTitle>
        <CardDescription>
          管理画面に表示される基本情報
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="text-lg">
              {fallbackChar}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm text-muted-foreground">アバター画像</div>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">姓名</label>
          <Input value={name} disabled readOnly />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">表示名</label>
          <Input value={displayName} disabled readOnly />
        </div>
        <div className="flex justify-end">
          <Dialog
            open={open}
            onOpenChange={(o) => {
              if (o) openDialog()
              else setOpen(false)
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                変更
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>プロフィール変更</DialogTitle>
                <DialogDescription>
                  管理画面に表示される基本情報を変更します。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    アバター画像
                  </label>
                  <div className="flex items-center gap-4">
                    <Avatar className="size-16">
                      {draftAvatar && (
                        <AvatarImage src={draftAvatar} alt="preview" />
                      )}
                      <AvatarFallback className="text-lg">
                        {draftFallback}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <label className="cursor-pointer">
                          画像を選択
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarChange}
                          />
                        </label>
                      </Button>
                      {draftAvatar && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDraftAvatar("")}
                        >
                          削除
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG / JPEG、最大 2MB
                  </p>
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="profile-name"
                    className="text-sm font-medium"
                  >
                    姓名
                  </label>
                  <Input
                    id="profile-name"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="姓 名"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="profile-display"
                    className="text-sm font-medium"
                  >
                    表示名
                  </label>
                  <Input
                    id="profile-display"
                    value={draftDisplay}
                    onChange={(e) => setDraftDisplay(e.target.value)}
                    placeholder="サイドバー等に表示される名前"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSubmit}>保存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// メール変更 Card + Dialog
// ─────────────────────────────────────────────────────────────

function EmailCard({ initial }: { initial: AccountInitial }) {
  const [open, setOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")
  const mismatched =
    newEmail !== "" && confirmEmail !== "" && newEmail !== confirmEmail

  function handleSubmit() {
    if (!newEmail || newEmail !== confirmEmail) {
      toast.error("メールアドレスが一致しません")
      return
    }
    toast.success("確認メールを送信しました")
    setOpen(false)
    setNewEmail("")
    setConfirmEmail("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>メール変更</CardTitle>
        <CardDescription>
          現在のメールアドレスを変更します
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">現在のメール</label>
          <Input value={initial.email} disabled readOnly />
        </div>
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                変更
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>メール変更</DialogTitle>
                <DialogDescription>
                  変更には現メールへの確認メールが送信されます。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid gap-2">
                  <label
                    htmlFor="new-email"
                    className="text-sm font-medium"
                  >
                    新しいメールアドレス
                  </label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@example.jp"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="confirm-email"
                    className="text-sm font-medium"
                  >
                    確認用
                  </label>
                  <Input
                    id="confirm-email"
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder="同じメールアドレスを再入力"
                  />
                  {mismatched && (
                    <p className="text-xs text-destructive">
                      メールアドレスが一致しません
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  キャンセル
                </Button>
                <Button onClick={handleSubmit}>送信</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// パスワード変更 Card + Dialog
// ─────────────────────────────────────────────────────────────

function PasswordCard() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")

  function reset() {
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  function isValidNew(pw: string) {
    if (pw.length < 8) return false
    return /[a-zA-Z]/.test(pw) && /\d/.test(pw)
  }

  function handleSubmit() {
    if (!current) {
      toast.error("現在のパスワードを入力してください")
      return
    }
    if (!isValidNew(next)) {
      toast.error("新パスワードは 8 文字以上、英数字混在で入力してください")
      return
    }
    if (next !== confirm) {
      toast.error("新パスワードが一致しません")
      return
    }
    toast.success("パスワードを変更しました")
    setOpen(false)
    reset()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>パスワード変更</CardTitle>
        <CardDescription>
          ログイン用パスワードを変更します
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end">
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o)
              if (!o) reset()
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                変更
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>パスワード変更</DialogTitle>
                <DialogDescription>
                  8 文字以上、英数字混在で入力してください。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid gap-2">
                  <label
                    htmlFor="current-password"
                    className="text-sm font-medium"
                  >
                    現在のパスワード
                  </label>
                  <Input
                    id="current-password"
                    type="password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="new-password"
                    className="text-sm font-medium"
                  >
                    新パスワード
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="confirm-password"
                    className="text-sm font-medium"
                  >
                    確認用
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    reset()
                  }}
                >
                  キャンセル
                </Button>
                <Button onClick={handleSubmit}>変更</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// その他 placeholder section(v2 で実装予定)
// ─────────────────────────────────────────────────────────────

type SettingsSection = {
  icon: LucideIcon
  title: string
  description: string
}

const ADMIN_PLACEHOLDERS: SettingsSection[] = [
  {
    icon: Building2Icon,
    title: "提供先管理",
    description: "OEM / BtoB クライアントの追加・停止・プラン変更",
  },
  {
    icon: VideoIcon,
    title: "動画 catalog",
    description: "動画の追加・編集・カテゴリ管理",
  },
  {
    icon: BellIcon,
    title: "通知設定",
    description: "システム event 別の通知 ON / OFF",
  },
]

const OEM_PLACEHOLDERS: SettingsSection[] = [
  {
    icon: StoreIcon,
    title: "自社プロフィール",
    description: "店舗名 / ロゴ / 業態などの基本情報",
  },
  {
    icon: BellIcon,
    title: "通知設定",
    description: "自社ユーザーが要注意状態になった時の通知",
  },
  {
    icon: CreditCardIcon,
    title: "プラン / 請求",
    description: "契約プランの確認・変更、請求履歴",
  },
]

const B2B_PLACEHOLDERS: SettingsSection[] = [
  {
    icon: BuildingIcon,
    title: "自社プロフィール",
    description: "企業名 / ロゴ / 業態などの基本情報",
  },
  {
    icon: BellIcon,
    title: "通知設定",
    description: "集計値が閾値を超えた時のみ通知(個人特定情報は含まない)",
  },
  {
    icon: CreditCardIcon,
    title: "プラン / 請求",
    description: "契約プランの確認・変更、請求履歴",
  },
]

function placeholdersForType(type: string): SettingsSection[] {
  if (type === "oem") return OEM_PLACEHOLDERS
  if (type === "b2b") return B2B_PLACEHOLDERS
  return ADMIN_PLACEHOLDERS
}

// ─────────────────────────────────────────────────────────────
// SettingsPage
// ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"
  const companyId = Number(searchParams.get("company_id") ?? 0)
  const initial = initialAccountFor(type, companyId)
  const placeholders = placeholdersForType(type)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          アカウント情報の変更が可能です。その他の項目は v2 で順次実装予定。
        </p>
      </div>

      {/* アカウント section(全 3 視角共通の実装) */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">アカウント</h2>
        <div className="grid grid-cols-1 gap-4">
          <ProfileCard initial={initial} />
          <EmailCard initial={initial} />
          <PasswordCard />
        </div>
      </section>

      {/* メンバー管理 section(視点別の Role 階層) */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">メンバー管理</h2>
        <MembersCard type={type} companyId={companyId} />
      </section>

      {/* その他 placeholder */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-muted-foreground">
          その他の設定
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {placeholders.map((s) => {
            const Icon = s.icon
            return (
              <Card
                key={s.title}
                aria-disabled
                className="cursor-not-allowed opacity-70"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-muted p-2">
                        <Icon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          {s.title}
                        </CardTitle>
                        <CardDescription>{s.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      v2 で実装予定
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
