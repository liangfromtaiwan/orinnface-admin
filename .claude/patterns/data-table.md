# Pattern: 資料表頁

> SaaS 後台最常見的頁面類型。所有列表頁都應該遵循這個結構。

## 標準結構

```
┌─────────────────────────────────────────────────┐
│  PageHeader（標題 + 描述 + 主要動作）              │
├─────────────────────────────────────────────────┤
│  FilterBar（搜尋 + 篩選 + 檢視切換 + 批次操作)     │
├─────────────────────────────────────────────────┤
│                                                 │
│  DataTable（內容）                               │
│                                                 │
├─────────────────────────────────────────────────┤
│  Pagination（分頁器 + 每頁筆數）                  │
└─────────────────────────────────────────────────┘
```

## 必要元件

```bash
npx shadcn@latest add table button input select \
  dropdown-menu checkbox badge skeleton
```

外加：
```bash
npm install @tanstack/react-table
```

## 完整範本

```tsx
// src/pages/UsersPage.tsx
import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Search, SlidersHorizontal, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/DataTable"

type User = {
  id: string
  name: string
  email: string
  role: "admin" | "member" | "viewer"
  status: "active" | "invited" | "disabled"
  lastActiveAt: string
}

const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "姓名",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "email",
    header: "電子郵件",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("email")}</span>
    ),
  },
  {
    accessorKey: "role",
    header: "角色",
    cell: ({ row }) => {
      const role = row.getValue("role") as User["role"]
      const labels = { admin: "管理員", member: "成員", viewer: "檢視者" }
      return <Badge variant="secondary">{labels[role]}</Badge>
    },
  },
  {
    accessorKey: "status",
    header: "狀態",
    cell: ({ row }) => {
      const status = row.getValue("status") as User["status"]
      const config = {
        active: { label: "啟用中", variant: "default" as const },
        invited: { label: "已邀請", variant: "outline" as const },
        disabled: { label: "已停用", variant: "secondary" as const },
      }
      const { label, variant } = config[status]
      return <Badge variant={variant}>{label}</Badge>
    },
  },
  {
    accessorKey: "lastActiveAt",
    header: "最後活動",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.getValue("lastActiveAt")}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>編輯</DropdownMenuItem>
          <DropdownMenuItem>重設密碼</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            停用帳號
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export function UsersPage() {
  const [search, setSearch] = useState("")

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            使用者管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理組織內所有使用者的權限與狀態
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          邀請使用者
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋姓名或信箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          篩選
        </Button>
      </div>

      {/* Data Table */}
      <DataTable columns={columns} data={mockUsers} />
    </div>
  )
}
```

## 關鍵設計決策

### 為什麼用 TanStack Table 而不是 shadcn 的 `<Table>` 直接寫
- 排序、篩選、分頁邏輯複雜，TanStack 處理得乾淨
- shadcn 的 `<Table>` 只是樣式層，TanStack 處理邏輯，兩者互補
- 官方 shadcn 文件就是這個組合

### 為什麼搜尋框放左邊、其他篩選放右邊
- 視覺層級：搜尋是最常用的操作
- 留白集中在中間，視覺更舒服
- Linear、Vercel 都是這個模式

### 為什麼操作選單用 DropdownMenu 而不是直接列按鈕
- 一列只有一個 `more` 按鈕，視覺乾淨
- 操作選項變多不會破版
- 危險操作（刪除）放在最下面 + 紅色，避免誤觸

## 常見變體

### 變體 1：有篩選 chips
搜尋框下方加一排可移除的篩選條件，適合複雜篩選情境。

### 變體 2：批次操作
最左邊加 checkbox column，選取後上方出現「已選 N 筆」工具列，
顯示批次操作按鈕（批次刪除、批次匯出）。

### 變體 3：可展開列
row 可以展開顯示詳細資訊，避免跳轉到詳情頁。
適合資料簡單但偶爾需要看細節的情境。

## 避免的反模式

- ❌ 把所有篩選都做成下拉選單塞滿頂部（用 popover 收納）
- ❌ 每列右邊放 3 個以上獨立按鈕（用 DropdownMenu）
- ❌ 沒有 empty state（必須處理「沒有資料」和「搜尋無結果」兩種）
- ❌ 沒有 loading skeleton（資料載入時不要顯示空白表格）
- ❌ 分頁器只有「上一頁/下一頁」（要顯示總筆數和頁碼）
