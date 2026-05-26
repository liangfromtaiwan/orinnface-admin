import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { CompanyProfileCard } from "@/components/CompanyProfileCard"
import { MembersCard } from "@/components/MembersCard"
import { NotificationCard } from "@/components/NotificationCard"
import { PlanCard } from "@/components/PlanCard"
import { ProvidersCard } from "@/components/ProvidersCard"
import { VideoCatalogCard } from "@/components/VideoCatalogCard"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
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
  // 「保存済」値(button の dirty 判定基準)
  const [savedName, setSavedName] = useState(initial.name)
  const [savedDisplayName, setSavedDisplayName] = useState(initial.displayName)
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string>("")

  // 現在編集中の値
  const [name, setName] = useState(initial.name)
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [avatarUrl, setAvatarUrl] = useState<string>("")

  const isDirty =
    name !== savedName ||
    displayName !== savedDisplayName ||
    avatarUrl !== savedAvatarUrl

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
      setAvatarUrl(reader.result as string)
    }
    reader.onerror = () => {
      toast.error("画像の読み込みに失敗しました")
    }
    reader.readAsDataURL(file)
  }

  function handleSave() {
    const trimmedName = name.trim()
    const trimmedDisplay = displayName.trim()
    if (!trimmedName) {
      toast.error("姓名を入力してください")
      return
    }
    if (!trimmedDisplay) {
      toast.error("表示名を入力してください")
      return
    }
    setName(trimmedName)
    setDisplayName(trimmedDisplay)
    setSavedName(trimmedName)
    setSavedDisplayName(trimmedDisplay)
    setSavedAvatarUrl(avatarUrl)
    toast.success("保存しました")
  }

  const fallbackChar = displayName.slice(0, 1) || "?"

  return (
    <Card>
      <CardHeader>
        <CardTitle>プロフィール</CardTitle>
        <CardDescription>
          管理画面に表示される基本情報
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* アバター */}
        <div className="grid gap-2">
          <label className="text-sm font-medium">アバター画像</label>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="text-lg">
                {fallbackChar}
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
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAvatarUrl("")}
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

        {/* 姓名 */}
        <div className="grid gap-2">
          <label htmlFor="profile-name" className="text-sm font-medium">
            姓名
          </label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="姓 名"
          />
        </div>

        {/* 表示名 */}
        <div className="grid gap-2">
          <label htmlFor="profile-display" className="text-sm font-medium">
            表示名
          </label>
          <Input
            id="profile-display"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="サイドバー等に表示される名前"
          />
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button onClick={handleSave} size="sm" disabled={!isDirty}>
            保存
          </Button>
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
// SettingsPage
// ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"
  const companyId = Number(searchParams.get("company_id") ?? 0)
  const initial = initialAccountFor(type, companyId)

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

      {/* 自社プロフィール section(OEM / BtoB のみ表示。admin は規格上不要) */}
      {(type === "oem" || type === "b2b") && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">自社プロフィール</h2>
          <CompanyProfileCard type={type} companyId={companyId} />
        </section>
      )}

      {/* 提供先管理 section(admin のみ表示) */}
      {type === "admin" && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">提供先管理</h2>
          <ProvidersCard />
        </section>
      )}

      {/* 動画 catalog section(admin のみ表示) */}
      {type === "admin" && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">動画 catalog</h2>
          <VideoCatalogCard />
        </section>
      )}

      {/* 通知設定 section(全 3 視角、内容が異なる) */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">通知設定</h2>
        <NotificationCard type={type} />
      </section>

      {/* プラン / 請求 section(OEM / BtoB のみ。admin は規格上不要) */}
      {(type === "oem" || type === "b2b") && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">プラン / 請求</h2>
          <PlanCard type={type} />
        </section>
      )}

    </div>
  )
}
