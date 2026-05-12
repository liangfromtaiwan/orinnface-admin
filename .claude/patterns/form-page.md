# Pattern: 表單頁

> 用於建立、編輯資料的頁面。

## 標準結構

```
┌─────────────────────────────────────────────────┐
│  PageHeader（標題 + 取消/返回按鈕）                │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐  │
│  │  FormSection 1（基本資訊）                  │  │
│  │  - 標題 + 說明                              │  │
│  │  - 欄位群組                                 │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  FormSection 2（權限設定）                  │  │
│  └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│  Footer（取消 + 儲存按鈕，固定底部 or 內嵌）        │
└─────────────────────────────────────────────────┘
```

## 必要元件

```bash
npx shadcn@latest add form input label select textarea \
  checkbox radio-group switch button card separator sonner
```

外加：
```bash
npm install react-hook-form @hookform/resolvers zod
```

## 完整範本

```tsx
// src/pages/CreateUserPage.tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

const schema = z.object({
  name: z.string().min(2, "姓名至少需要 2 個字"),
  email: z.string().email("請輸入有效的電子郵件"),
  role: z.enum(["admin", "member", "viewer"], {
    required_error: "請選擇角色",
  }),
  bio: z.string().max(200, "簡介不可超過 200 字").optional(),
  notifications: z.boolean().default(true),
})

type FormValues = z.infer<typeof schema>

export function CreateUserPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      bio: "",
      notifications: true,
    },
  })

  async function onSubmit(values: FormValues) {
    try {
      // await api.createUser(values)
      toast.success("使用者已建立")
    } catch (error) {
      toast.error("建立失敗，請稍後再試")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              新增使用者
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              建立新的使用者帳號並設定權限
            </p>
          </div>
        </div>

        {/* Section 1: 基本資訊 */}
        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium">基本資訊</h2>
            <p className="text-sm text-muted-foreground mt-1">
              使用者的個人資訊，將顯示在使用者個人頁面
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
                    <Input placeholder="王小明" {...field} />
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
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    系統會寄送邀請信至此信箱
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>個人簡介</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="簡單介紹自己..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Card>

        {/* Section 2: 權限設定 */}
        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium">權限與通知</h2>
            <p className="text-sm text-muted-foreground mt-1">
              設定此使用者的存取權限
            </p>
          </div>

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>角色</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇角色" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="admin">管理員（完整權限）</SelectItem>
                    <SelectItem value="member">成員（讀寫權限）</SelectItem>
                    <SelectItem value="viewer">檢視者（唯讀）</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notifications"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>電子郵件通知</FormLabel>
                  <FormDescription>
                    接收系統重要更新與活動通知
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </Card>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline">
            取消
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "建立中..." : "建立使用者"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
```

## 關鍵設計決策

### 為什麼用 Card 分區塊
- 視覺上明確區分不同類型的資訊（基本/權限/通知）
- 留白型風格的關鍵：每張卡片獨立呼吸
- 長表單不會看起來壓迫

### 為什麼錯誤訊息用 FormMessage 而不是 toast
- 表單驗證錯誤是「欄位層級」問題，應該顯示在欄位旁
- toast 應該保留給「全域、暫時性」訊息（儲存成功、網路錯誤）
- 同時顯示多個錯誤時，toast 會疊在一起難讀

### 為什麼用 Switch 而不是 Checkbox
- Switch 用於「立即生效的開關」（設定）
- Checkbox 用於「需要按儲存才生效的選項」（表單欄位）
- 這個 case 是設定類型的選項，所以用 Switch

## 表單長度的建議

| 長度 | 處理方式 |
|------|----------|
| < 5 欄位 | 用 Dialog，不需要獨立頁 |
| 5-15 欄位 | 單頁 + 多個 Card section |
| 15+ 欄位 | 多步驟精靈（Stepper） |
| 跨多個概念 | Sheet 滑出 + Tabs 分類 |

## 避免的反模式

- ❌ 必填欄位用紅色星號但沒在 Zod schema 標記
- ❌ 一個 Card 塞 20 個欄位（要分區塊）
- ❌ 提交按鈕在頂部（使用者看完表單下方才會找按鈕）
- ❌ 沒有 loading 狀態（提交中要 disable 按鈕）
- ❌ 取消按鈕用紅色（取消不是危險操作，destructive 留給「刪除」）
