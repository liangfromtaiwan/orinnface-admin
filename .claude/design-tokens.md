# 設計 Token 系統

## 核心原則
**禁止硬編碼**：不要寫 `#3B82F6`、`16px`、`gap: 24px`。
**必須使用 token**：透過 Tailwind class 或 CSS variable。

這是為了讓 Figma Variables 和 code 能單向同步（從 code 到 Figma）。

## 顏色系統

### 語意化色票（用這些，不要用具體色名）
```
bg-background        頁面底色
bg-card              卡片底色（比 background 略亮/暗）
bg-popover           浮層底色
bg-muted             次要區塊底色（如 disabled state）
bg-accent            hover/active 互動底色
bg-primary           主要動作色（CTA 按鈕）
bg-secondary         次要動作色
bg-destructive       危險動作色（刪除、警告）

text-foreground      主要文字
text-muted-foreground  次要文字、說明文字
text-primary         主要色文字（連結、強調）
text-destructive     危險文字

border               預設邊框色
border-input         表單欄位邊框
ring                 focus ring 色
```

### 用法範例
```tsx
// ✅ 正確
<div className="bg-card border rounded-lg p-6">
  <h3 className="text-foreground font-medium">標題</h3>
  <p className="text-muted-foreground text-sm mt-1">說明文字</p>
</div>

// ❌ 錯誤
<div className="bg-white border border-gray-200 rounded-lg p-6">
  <h3 className="text-gray-900 font-medium">標題</h3>
  <p className="text-gray-500 text-sm mt-1">說明文字</p>
</div>
```

### 何時可以用具體色
- 圖表 data series 顏色（資料視覺化需要區分）
- 狀態 badge（成功綠、警告黃、錯誤紅、資訊藍）
- 但即使這些也應該抽成 CSS variable，例如 `--chart-1` 到 `--chart-5`

## 間距系統

### 用 4 的倍數（Tailwind 預設）
```
gap-1 → 4px    元件內最小間距
gap-2 → 8px    icon 與文字、緊湊元件
gap-3 → 12px   表單欄位內部
gap-4 → 16px   一般元件間距（最常用）
gap-6 → 24px   區塊內部間距
gap-8 → 32px   大區塊之間
gap-12 → 48px  頁面 section 之間
gap-16 → 64px  巨大留白（landing page 才用）
```

### 舒適留白型的關鍵
本專案風格偏留白，**間距比一般 SaaS 大一級**：
- 卡片內 padding：`p-6` 而非 `p-4`
- 頁面區塊間：`gap-8` 而非 `gap-6`
- 表單欄位間：`gap-6` 而非 `gap-4`
- 行高優先選 `leading-relaxed`、`leading-loose`

## 圓角系統

```
rounded-sm   → 2px   標籤、小 badge
rounded      → 4px   罕用
rounded-md   → 6px   按鈕、輸入框（最常用）
rounded-lg   → 8px   卡片、modal
rounded-xl   → 12px  特殊區塊
rounded-full        頭像、icon button、徽章
```

**本專案規則**：
- 按鈕、輸入框：`rounded-md`
- 卡片、Dialog、Sheet：`rounded-lg`
- 圖片、頭像：`rounded-full` 或 `rounded-lg`

## 字級系統

```
text-xs    → 12px   標籤、輔助說明、表格內次要資訊
text-sm    → 14px   表格內容、表單 label、按鈕文字（最常用於後台）
text-base  → 16px   一般段落文字
text-lg    → 18px   卡片標題
text-xl    → 20px   區塊標題
text-2xl   → 24px   頁面主標題
text-3xl   → 30px   特殊場合（dashboard 重點數字）
```

**字重**：
- 一般文字：預設（`font-normal`）
- 強調：`font-medium`（不要跳到 `font-semibold` 除非是標題）
- 標題：`font-semibold`
- 不要用 `font-bold`（後台介面太重）

**字距**：
- 大標題加 `tracking-tight` 看起來更精緻
- 全大寫的小字加 `tracking-wide` 易讀

## Shadow 系統

舒適留白型**克制使用 shadow**：
```
shadow-sm    → 卡片預設陰影（這就夠了）
shadow       → hover state 加重
shadow-md    → Popover、Dropdown
shadow-lg    → Dialog、Sheet
```

避免：
- `shadow-2xl`、誇張陰影
- 多重陰影堆疊
- 彩色陰影

## Motion 系統

**動畫節制**：本專案不追求華麗動畫，重點是「順暢」。

```css
transition-colors duration-150    /* hover 變色 */
transition-all duration-200       /* 一般狀態切換 */
transition-transform duration-200 /* 開合動畫 */
```

**禁用**：
- spring、bounce 效果
- 超過 300ms 的動畫
- 自動播放的裝飾動畫

**例外**：
- Dialog、Sheet 開合用 shadcn 預設的 fade + slide（已內建）
- Skeleton loading 的 pulse 動畫（已內建）

## Dark Mode

所有顏色已透過 CSS variable 處理，**寫元件時不用特別考慮 dark mode**。
只要遵守上面的語意化色票，dark mode 會自動跑。

例外情境需要手動處理：
```tsx
<div className="bg-white dark:bg-zinc-900">  {/* ❌ 不要這樣寫 */}
<div className="bg-background">              {/* ✅ 用語意化 */}
```

## 字體選擇

**舒適留白型**推薦：
- **顯示字體**（標題）：Geist Sans 或 Inter
- **內文字體**：Geist Sans
- **等寬字體**（code）：Geist Mono 或 JetBrains Mono

設定方式（`index.css`）：
```css
:root {
  --font-sans: "Geist Sans", system-ui, sans-serif;
  --font-mono: "Geist Mono", "Menlo", monospace;
}
```

```js
// tailwind.config 或 CSS variable
fontFamily: {
  sans: ['var(--font-sans)'],
  mono: ['var(--font-mono)'],
}
```
