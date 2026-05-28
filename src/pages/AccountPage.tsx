import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

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
import { useUserProfiles } from "@/contexts/UserProfilesContext"

// プロフィール / メール初期値は UserProfilesContext で管理。
// AccountPage は profileKey(`${type}:${companyId}`)を子に渡すのみ。

// ─────────────────────────────────────────────────────────────
// プロフィール Card
// ─────────────────────────────────────────────────────────────

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB

function ProfileCard({ profileKey }: { profileKey: string }) {
  const { getProfile, updateProfile } = useUserProfiles()
  const saved = getProfile(profileKey)

  // 現在編集中の値(saved は Context 由来、保存後に自動更新 → isDirty が false に)
  const [name, setName] = useState(saved.name)
  const [displayName, setDisplayName] = useState(saved.displayName)
  const [avatarUrl, setAvatarUrl] = useState<string>(saved.avatarUrl)

  const isDirty =
    name !== saved.name ||
    displayName !== saved.displayName ||
    avatarUrl !== saved.avatarUrl

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
    // Context 経由で更新 → Sidebar 等の他画面にも反映、saved も自動更新
    updateProfile(profileKey, {
      name: trimmedName,
      displayName: trimmedDisplay,
      avatarUrl,
    })
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

function EmailCard({ profileKey }: { profileKey: string }) {
  const { getProfile } = useUserProfiles()
  const saved = getProfile(profileKey)
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
          <Input value={saved.email} disabled readOnly />
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
// AccountPage
// ─────────────────────────────────────────────────────────────

export default function AccountPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"
  const companyId = Number(searchParams.get("company_id") ?? 0)
  const profileKey = `${type}:${companyId}`

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">アカウント</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          プロフィール / メール / パスワードの変更
        </p>
      </div>

      {/* key={profileKey} で視点切替時に確実に remount → 編集中の draft を捨てる */}
      <div className="grid grid-cols-1 gap-4">
        <ProfileCard key={`profile-${profileKey}`} profileKey={profileKey} />
        <EmailCard key={`email-${profileKey}`} profileKey={profileKey} />
        <PasswordCard />
      </div>
    </div>
  )
}
