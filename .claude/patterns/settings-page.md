# Pattern: 設定頁

> 用於使用者偏好、組織設定、整合管理等場景。

## 標準結構

### 模式 A：單頁多區塊（設定項少於 10 個）
```
┌─────────────────────────────────────────────────┐
│  PageHeader                                      │
├─────────────────────────────────────────────────┤
│  Section 1 + 儲存按鈕                            │
│  Section 2 + 儲存按鈕                            │
│  Section 3 + 儲存按鈕                            │
│  危險區（Danger Zone）                           │
└─────────────────────────────────────────────────┘
```

### 模式 B：左側 nav + 右側內容（設定多）
```
┌─────────────────────────────────────────────────┐
│  PageHeader                                      │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  Nav         │   Section Content                │
│  - 個人資料   │                                  │
│  - 通知設定   │                                  │
│  - 整合       │                                  │
│  - 安全       │                                  │
│              │                                  │
└──────────────┴──────────────────────────────────┘
```

## 模式 A 範本（推薦從這個開始）

```tsx
// src/pages/AccountSettingsPage.tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

export function AccountSettingsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">帳號設定</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理您的個人資料、通知偏好與安全設定
        </p>
      </div>

      {/* 每個設定區塊獨立成 Card + 自己的儲存按鈕 */}
      <ProfileSection />
      <NotificationSection />
      <SecuritySection />
      <DangerZone />
    </div>
  )
}

// ─── 個人資料區塊 ───────────────────────────
const profileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
})

function ProfileSection() {
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "王小明", email: "user@example.com" },
  })

  return (
    <Card className="p-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(() => toast.success("已儲存"))}
          className="space-y-6"
        >
          <div>
            <h2 className="text-lg font-medium">個人資料</h2>
            <p className="text-sm text-muted-foreground mt-1">
              這些資訊會顯示在您的個人頁面
            </p>
          </div>

          <div className="grid gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓名</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>電子郵件</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormDescription>
                    變更後將寄送驗證信至新信箱
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button type="submit" size="sm">
              儲存變更
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  )
}

// ─── 通知設定區塊 ───────────────────────────
function NotificationSection() {
  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-medium">通知偏好</h2>
        <p className="text-sm text-muted-foreground mt-1">
          選擇您想要接收的通知類型
        </p>
      </div>

      <div className="space-y-4">
        <NotificationToggle
          label="系統更新"
          description="新功能發布、重要公告"
          defaultChecked
        />
        <NotificationToggle
          label="活動通知"
          description="團隊成員的操作通知"
          defaultChecked
        />
        <NotificationToggle
          label="行銷郵件"
          description="產品技巧、最佳實踐分享"
        />
      </div>
    </Card>
  )
}

function NotificationToggle({
  label,
  description,
  defaultChecked,
}: {
  label: string
  description: string
  defaultChecked?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  )
}

// ─── 安全設定區塊 ───────────────────────────
function SecuritySection() {
  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-medium">安全性</h2>
        <p className="text-sm text-muted-foreground mt-1">
          保護您的帳號安全
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <div className="font-medium text-sm">密碼</div>
            <div className="text-sm text-muted-foreground">
              上次更新於 30 天前
            </div>
          </div>
          <Button variant="outline" size="sm">
            變更密碼
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <div className="font-medium text-sm">兩步驟驗證</div>
            <div className="text-sm text-muted-foreground">
              使用 Authenticator app 增強帳號安全
            </div>
          </div>
          <Button variant="outline" size="sm">
            啟用
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── 危險區 ───────────────────────────
function DangerZone() {
  return (
    <Card className="p-6 border-destructive/50 space-y-6">
      <div>
        <h2 className="text-lg font-medium text-destructive">危險操作</h2>
        <p className="text-sm text-muted-foreground mt-1">
          這些操作無法復原,請謹慎使用
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="font-medium text-sm">刪除帳號</div>
          <div className="text-sm text-muted-foreground">
            永久刪除您的帳號及所有相關資料
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              刪除帳號
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除帳號嗎?</AlertDialogTitle>
              <AlertDialogDescription>
                此操作無法復原。您的所有資料、設定、歷史記錄都將被永久刪除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground">
                我了解,刪除帳號
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  )
}
```

## 關鍵設計決策

### 為什麼每個 Section 獨立儲存
- 使用者可能只想改一個設定
- 一個區塊的錯誤不會擋住其他區塊
- 心智負擔低（不用「我改了什麼?」）

### 為什麼「危險區」要視覺隔離
- 用 `border-destructive/50` 警告色邊框
- 標題用 `text-destructive`
- 確認彈窗用 AlertDialog（不能簡單按 ESC 關閉）
- 這是 GitHub、Vercel 的標準模式,使用者已習慣

### 為什麼通知設定不放在獨立 Card
- 切換 toggle 應該立即生效,不需要「儲存」按鈕
- 用 `onCheckedChange` 直接 API call
- 失敗時用 toast 提示並回滾

## 模式 B 觸發條件

當設定項超過這些情況時,改用左側 nav 模式:
- 區塊超過 5 個
- 每個區塊內容深度很大（多步驟、嵌套設定）
- 需要 URL 對應（`/settings/profile`、`/settings/billing`)

實作上用 `react-router` 的 nested route + `<Outlet />`,
左側 nav 用 `<NavLink>` 加上 active state。

## 避免的反模式

- ❌ 把所有設定塞在一個巨大表單,底部一個「儲存」按鈕
- ❌ 危險操作沒有二次確認(永遠用 AlertDialog)
- ❌ 用「狀態頁面 + 編輯按鈕」模式(現代 SaaS 都是 inline 編輯)
- ❌ 刪除帳號的確認彈窗用 Dialog 而非 AlertDialog
