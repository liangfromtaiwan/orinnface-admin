import { useState } from "react"
import { EyeIcon, EyeOffIcon, LinkIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

// Google G ロゴ(公式カラー、SVG inline)
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-card px-2 text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // マジックリンク Dialog
  const [magicOpen, setMagicOpen] = useState(false)
  const [magicEmail, setMagicEmail] = useState("")

  function handleLogin() {
    toast.success("ログインしました")
    navigate("/dashboard?type=admin&company_id=0")
  }

  function handleGoogleLogin() {
    toast.success("Google アカウントでログインしました(mock)")
    navigate("/dashboard?type=admin&company_id=0")
  }

  function openMagicDialog() {
    setMagicEmail(email)
    setMagicOpen(true)
  }

  function handleMagicSubmit() {
    if (!magicEmail.trim()) {
      toast.error("メールアドレスを入力してください")
      return
    }
    toast.success(`${magicEmail.trim()} にマジックリンクを送信しました(mock)`)
    setMagicOpen(false)
  }

  function handleForgotPassword() {
    toast.info("パスワード再設定メールを送信予定(mock)")
  }

  function handleSignUp() {
    toast.info("新規登録ページへ遷移予定(mock)")
  }

  function handleFooterLink(label: string) {
    toast.info(`${label} ページへ遷移予定(mock)`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* タイトル */}
        <div className="text-center">
          <p className="text-base font-medium tracking-wide">OrinnFACE</p>
          <h1 className="mt-1 text-2xl font-semibold">ログイン</h1>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            {/* メールアドレス */}
            <div className="grid gap-2">
              <label htmlFor="login-email" className="text-sm font-medium">
                メールアドレス
              </label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
              />
            </div>

            {/* パスワード(show/hide 切替付き) */}
            <div className="grid gap-2">
              <label htmlFor="login-password" className="text-sm font-medium">
                パスワード
              </label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  autoComplete="current-password"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showPassword ? "パスワードを隠す" : "パスワードを表示"
                  }
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  パスワードをおわすれですか?
                </button>
              </div>
            </div>

            <Button onClick={handleLogin} className="w-full">
              ログイン
            </Button>

            <Divider label="または" />

            {/* Google SSO */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon className="mr-2 size-4" />
              Google でログインする
            </Button>

            {/* マジックリンク(Dialog を開く) */}
            <Button
              variant="outline"
              className="w-full"
              onClick={openMagicDialog}
            >
              <LinkIcon className="mr-2 size-4" />
              マジックリンクで登録する
            </Button>

            {/* 新規登録 link */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleSignUp}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                アカウントをお持ちでない方は新規登録
              </button>
            </div>
          </CardContent>
        </Card>

        {/* フッターリンク */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => handleFooterLink("利用規約")}
            className="hover:underline"
          >
            利用規約
          </button>
          <button
            type="button"
            onClick={() => handleFooterLink("プライバシーポリシー")}
            className="hover:underline"
          >
            プライバシーポリシー
          </button>
          <button
            type="button"
            onClick={() => handleFooterLink("特定商取引法に基づく表記")}
            className="hover:underline"
          >
            特定商取引法に基づく表記
          </button>
        </div>
      </div>

      {/* マジックリンク Dialog */}
      <Dialog open={magicOpen} onOpenChange={setMagicOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>マジックリンクで登録</DialogTitle>
            <DialogDescription>
              マジックリンクはメールに届く一時的な URL を使ってログインする方式です
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="magic-email" className="text-sm font-medium">
                メール
              </label>
              <Input
                id="magic-email"
                type="email"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
              />
            </div>
            <Button onClick={handleMagicSubmit} className="w-full">
              マジックリンクをメールに送る
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
