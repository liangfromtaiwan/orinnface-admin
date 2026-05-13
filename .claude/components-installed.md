# 已安裝的 shadcn 元件 (OrinnME 專案)

> **重要**:每次執行 `npx shadcn@latest add [name]` 之後,
> 請手動或請 Claude Code 更新這份清單。
> 這份清單是 Claude Code 判斷「能否使用某個元件」的依據。

## 專案 shadcn 設定
- shadcn 版本:v3
- Preset:Nova(Geist 字體,最接近舊 New York)
- Base color:Zinc(手動覆蓋預設的 neutral)
- CSS variables:Yes

## 元件清單(依字母排序)

### Layout & 容器
- [ ] `aspect-ratio`
- [x] `card` ✅ Day 1
- [x] `collapsible` ✅ Day 2(sidebar-07 帶入)
- [ ] `resizable`
- [ ] `scroll-area`
- [x] `separator` ✅ Day 1
- [x] `sheet` ✅ Day 1
- [x] `sidebar` ✅ Day 1
- [x] `tabs` ✅ Day 1

### 表單元件
- [x] `button` ✅ Day 1
- [ ] `checkbox`
- [ ] `form`           ← 之後做表單頁時需要
- [x] `input` ✅ Day 1
- [ ] `input-otp`
- [ ] `label`          ← form 安裝時會帶
- [ ] `radio-group`
- [x] `select` ✅ Day 1
- [ ] `slider`
- [ ] `switch`
- [ ] `textarea`
- [ ] `toggle`
- [ ] `toggle-group`

### 資料展示
- [x] `avatar` ✅ Day 1
- [x] `badge` ✅ Day 1
- [x] `chart` ✅ Day 1 (Recharts 整合,Dashboard 必備)
- [ ] `progress`
- [x] `skeleton` ✅ Day 1
- [x] `table` ✅ Day 1
- [x] `tooltip` ✅ Day 1

### 浮層 & 互動
- [x] `alert` ✅ Day 4(b2b dashboard 隱私 banner)
- [x] `alert-dialog` ✅ Day 1
- [x] `breadcrumb` ✅ Day 2(sidebar-07 帶入,目前 Layout 還沒用)
- [ ] `command`
- [ ] `context-menu`
- [x] `dialog` ✅ Day 1
- [ ] `drawer`
- [x] `dropdown-menu` ✅ Day 1
- [ ] `hover-card`
- [ ] `menubar`
- [ ] `navigation-menu`
- [ ] `pagination`
- [ ] `popover`
- [x] `sonner` ✅ Day 1

### 日期 & 時間
- [ ] `calendar`
- [ ] `date-picker`

### Blocks(整套頁面範本)
- [ ] `dashboard-01`   ← Day 3 可能會用
- [x] `sidebar-07` ✅ Day 2(已客製為日文導航 + CompanySwitcher)

## 額外安裝的套件

- [x] `react-router-dom@7` ✅ Day 1(注意是 v7,不是 v6)
- [x] `@fontsource/inter` ✅ Day 1
- [x] `@fontsource-variable/noto-sans-jp` ✅ Day 1(尚未在 index.css @import)
- [x] `react-hook-form@7` ✅ Day 1
- [x] `zod@4` ✅ Day 1
- [x] `@hookform/resolvers@5` ✅ Day 1

## 客製元件清單

> 放在 `src/components/`(不是 `src/components/ui/`)

- [x] `Layout` ✅ Day 2 - SidebarProvider + AppSidebar + Header + Outlet 包裝
- [x] `app-sidebar` ✅ Day 2 - 主 Sidebar 組裝(來自 sidebar-07 客製)
- [x] `nav-main` ✅ Day 2 - 主導航,接 React Router NavLink + 動態 active
- [x] `nav-user` ✅ Day 2 - Sidebar Footer 使用者選單(日文化)
- [x] `CompanySwitcher` ✅ Day 2 - 視角切換,URL 同步 `?company_id=X&type=Y`
- [x] `StatCard` ✅ Day 3 - KPI 卡(title + big number + delta arrow + description)
- [x] `ChartCard` ✅ Day 3 - 圖表卡片包裝(title + description + content)
- [x] `AdminDashboard` ✅ Day 3 - ① 運営視角 dashboard 組合
- [x] `B2BDashboard` ✅ Day 4 - ③ BtoB 集計專用 dashboard(隱私 banner + 集計圖)
- [ ] `PageHeader` - 頁面標題列
- [ ] `EmptyState` - 空狀態顯示

## 維護指引

當 Claude Code 幫忙安裝新元件後:
1. 在上面對應元件前打勾 `[x]`,並標註 Day 幾安裝
2. 如果是客製元件,加到「客製元件清單」
3. commit 這份檔案
