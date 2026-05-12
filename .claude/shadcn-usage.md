# shadcn/ui 使用守則

## 核心觀念
shadcn 不是傳統 npm 套件，而是**把元件原始碼複製進你的專案**。
這代表：
- 元件在 `src/components/ui/`，你可以自由修改
- 升級 shadcn 不會覆蓋你的客製
- 但也代表「裝了什麼」要自己追蹤（見 components-installed.md）

## 安裝元件的正確方式

### 永遠用官方 CLI
```bash
npx shadcn@latest add [component-name]
```

### 不要這樣做（常見錯誤）
- ❌ `npm install shadcn-ui`（這個 package 不存在）
- ❌ 從別人的 repo 複製貼上元件原始碼
- ❌ 自己手寫一個 Button 然後說「這是 shadcn 風格」
- ❌ 直接 import from "@shadcn/ui"（shadcn 沒有這個 npm scope）

## 元件選擇對照表

### Modal vs Dialog vs Sheet vs Drawer
| 情境 | 用哪個 |
|------|--------|
| 重要訊息、需要使用者確認的對話 | `Dialog` |
| 破壞性操作的二次確認 | `AlertDialog` |
| 表單編輯、側邊滑出的工作面板 | `Sheet`（桌面） |
| 行動裝置的底部滑出 | `Drawer`（vaul） |
| 簡短提示、非阻斷 | `Toast`（sonner） |

### 選擇器類元件
| 情境 | 用哪個 |
|------|--------|
| 選項固定且 < 10 個 | `Select` |
| 選項多需要搜尋 | `Combobox`（Command + Popover） |
| 多選 | `MultiSelect`（自組 Command + Badge） |
| 樹狀或階層 | 自組（shadcn 沒原生） |
| 日期 | `Calendar` + `Popover` |

### 表單元件
- **所有表單必須**用 `Form` 元件（react-hook-form 整合版）
- 欄位驗證錯誤顯示在欄位下方（`FormMessage`）
- 不要用 toast 顯示欄位錯誤
- 提交失敗才用 toast（系統層級錯誤）

## 程式碼風格規範

### className 拼接
```tsx
// ✅ 正確：用 cn() 工具
import { cn } from "@/lib/utils"

<div className={cn(
  "rounded-md border p-4",
  isActive && "bg-accent",
  className
)} />

// ❌ 錯誤：字串拼接或三元運算硬塞
<div className={`rounded-md border p-4 ${isActive ? 'bg-accent' : ''} ${className}`} />
```

### 元件命名
- shadcn 原生元件：保持原本檔名（`button.tsx`、`dialog.tsx`）
- 自組複合元件：放在 `src/components/` 而非 `src/components/ui/`
- 自組元件用 PascalCase 檔名（`UserTable.tsx`、`SettingsCard.tsx`）

### 元件擴充原則
- 想新增 variant：改 `src/components/ui/` 裡的 cva config
- 想新增 prop：擴充原元件 props interface
- 不要包一層 wrapper component 然後改名

## 常見情境的標準寫法

### 情境 1：表格行的操作選單
```tsx
// 用 DropdownMenu，不要用 Select 或自己刻
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem>編輯</DropdownMenuItem>
    <DropdownMenuItem>複製</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-destructive">
      刪除
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 情境 2：頁面標題列
```tsx
<div className="flex items-center justify-between border-b pb-6">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight">使用者管理</h1>
    <p className="text-sm text-muted-foreground mt-1">
      管理所有使用者的權限與狀態
    </p>
  </div>
  <Button>新增使用者</Button>
</div>
```

### 情境 3：空狀態
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="rounded-full bg-muted p-4 mb-4">
    <Inbox className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-medium">還沒有資料</h3>
  <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
    開始建立第一筆資料來填滿這個畫面
  </p>
  <Button>新增資料</Button>
</div>
```

## 何時該問我而不是自己決定
- 需要安裝新元件時，先告訴我元件名稱與用途
- 設計沒涵蓋的互動模式（例如多步驟精靈、複雜的篩選 UI）
- 元件 API 不夠用要客製時
- 不確定該用哪個元件時
