import { useState } from "react"
import { ShieldIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function handleLogin() {
    // 認証なし(mock)。デモ用に admin 視点へ遷移
    toast.success("ログインしました")
    navigate("/dashboard?type=admin&company_id=0")
  }

  function handleMagicLink() {
    if (!email.trim()) {
      toast.error("メールアドレスを入力してください")
      return
    }
    toast.success(`${email.trim()} にマジックリンクを送信予定(mock)`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldIcon className="size-6" />
          </div>
          <CardTitle>OrinnME 管理画面</CardTitle>
          <CardDescription>サインインしてください</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label htmlFor="login-email" className="text-sm font-medium">
              メールアドレス
            </label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@orinnme.jp"
              autoComplete="email"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="login-password" className="text-sm font-medium">
              パスワード
            </label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button onClick={handleLogin} className="w-full">
            ログイン
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                または
              </span>
            </div>
          </div>

          <Button
            onClick={handleMagicLink}
            variant="outline"
            size="sm"
            className="w-full"
          >
            マジックリンクで送信
          </Button>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-center text-xs text-muted-foreground">
            v2 で本格的な認証を実装予定(現在は placeholder)
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
