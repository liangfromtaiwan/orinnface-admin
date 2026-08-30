# OrinnFACE 管理画面 - 設計實作指引

> ⚠️ **重要**:每次對話開始時,請先確認你讀到這份檔案,
> 並回報「已讀取 OrinnFACE CLAUDE.md」。
> 任何任務開始前,**必須先讀對應的 .claude/ 規範檔案**。

## 🔴 強制檢查清單(每個任務開始前必做)

接到任務後,**先回答以下問題再動手**:

1. □ 這個任務涉及哪些頁面類型?需要讀哪份 patterns/*.md?
2. □ 需要哪些 shadcn 元件?用 MCP 確認 API 了嗎?
3. □ components-installed.md 裡這些元件都裝了嗎?
4. □ 文案用日文嗎?規格書裡有對應的日文嗎?
5. □ 這個畫面屬於 ①②③ 哪一套?資料要 filter 嗎?

**沒回答完不要開始寫 code**。回答完後再動手,寫完跟我確認。

---

## 專案背景

OrinnFACE 是 AI 表情分析 + 疲勞度照護的健康類產品。
使用者拍照 → AI 分析表情和疲勞 → 推薦照護影片 → 再次分析看改善。

本專案是 OrinnFACE 的**管理後台**,共三套畫面:
- ① 運営管理画面(弊社 super admin 用)
- ② BtoC / OEM 管理画面(合作店家、KOL 用)
- ③ BtoB 企業管理画面(企業 HR 用,只看集計、無個人資料)

三套畫面共用大量元件,差異主要在資料過濾(company_id)與權限。

## 技術堆疊
- Vite + React 19 + TypeScript
- Tailwind CSS v4
- shadcn/ui v3(Nova preset,Geist 字體,最接近舊 New York 風格)
- React Router(因為有多頁面)
- Recharts(shadcn chart 元件,圖表多)
- React Hook Form + Zod
- Lucide React(icon)

## 設計風格定位

**雇主明確指定 3 個關鍵詞**:
1. 白ベース(white base)
2. シンプル(simple)
3. 模板感(MUI/AdminLTE 風格)

**雇主原話**:
> テンプレート(MUI・AdminLTE等)を活用し最短で実装。
> 重要な数字が埋もれず、パッと見て状況が把握できる「機能的な見やすさ」

具體規則:
- 背景:純白 / 極淺灰(`bg-background`、`bg-muted/50`)
- 文字密度:中等(SaaS 後台正常密度)
- 圓角:`rounded-md`(6px)為主
- Shadow:克制,只在 Card hover 用 `shadow-sm`
- 顏色:中性灰為主,強調色只在「警告」與「主要動作」
- **警告色**:紅色(主観 vs AI 分析有落差時用)

## 🔴 核心視覺規則(規格明確要求)

> 主観疲労度とAI疲労度に大きなズレがある場合 → 行を赤くする
> 警告アイコンを出して「何か起きている」と一目でわかるようにする

實作方式:
- 表格列當有資料異常 → `bg-red-50` 整列底色變淺紅
- 對應的數值欄位加 `<AlertTriangle>` icon(來自 lucide)
- 提示文字用 `text-destructive`

**任何涉及「主觀 vs AI」對比的畫面都要實作這個邏輯**。

## 三套畫面的差異(實作時必須遵守)

實作時用同一套元件,透過 props 控制差異:

### ① 運営管理畫面 (type=admin, company_id=0)
- 完整資料,看所有 company
- 可看個人詳細資料

### ② OEM 管理畫面 (type=oem)
- 只有自家 company 資料(filter by company_id)
- 可看自家客戶個人資料

### ③ BtoB 企業畫面 (type=b2b)
- **🔴 重要:只有集計資料,絕對不顯示個人資料**
- 沒有「ユーザー詳細」頁面
- 數據以「人數」呈現,不是「誰」
- 規格原話:「個人を特定できる情報は一切表示しない」

## KPI 與圖表規範

本專案圖表是核心,Dashboard 要顯示大量指標。

### 圖表類型對應
| 資料類型 | 圖表 |
|---------|------|
| 趨勢推移 | Line Chart |
| 分布率(5 分類) | Bar Chart(堆疊) |
| 構成比 | Pie Chart |
| 一致率、轉換率 | 大數字 + 對比 |

### 假資料規範

開發階段用假資料,放在 `src/lib/mock-data/`。

**列舉值必須符合規格**:
- 表情分類:`張り(強)`、`張り(弱)`、`おだやか`、`ゆらぎ(強)`、`ゆらぎ(弱)`
- 疲労:`軽やか`、`いつも通り`、`ややお疲れ`、`蓄積しています`、`踏ん張りどき`
- 主観疲労:`あまり疲れていない`、`少し疲れている`、`だいぶ疲れている`
- 主観集中:`集中しやすい`、`どちらともいえない`、`集中しづらい`
- 部位:`上半身`、`体幹部`、`下半身`、`なんとなく全体`、`特に気になるところはない`
- 會員方案:`Guest`、`Member`、`Premium`

## 文案規範

**UI 文字優先使用日文**,從規格書 copy-paste。

不確定的文案:
- 留 TODO 註解:`{/* TODO: 日本語確認必要 */}`
- 或用 placeholder:`ダミーテキスト`

字型(已安裝):
- 西文:Inter
- 日文:Noto Sans JP
- 在 index.css 設定 fallback

## 路由結構

```
/                     → 重定向到 /dashboard
/dashboard            → 依 type 顯示不同 Dashboard
/users                → ユーザー一覧 (b2b 時隱藏)
/users/:id            → ユーザー詳細 (b2b 時不可進入)
/content              → コンテンツ分析
/status               → ステータス
/settings             → 設定
```

視角切換:用 URL query string
- `?company_id=0&type=admin` → ① 運営
- `?company_id=1&type=oem` → ② OEM(店舗A)
- `?company_id=3&type=b2b` → ③ BtoB(企業X)

## 🔴 與 Claude Code 溝通的鐵則

每個任務必須遵守:

1. **開始前**:列出計畫,告訴使用者「我打算這樣做」
2. **執行中**:遇到不確定的事,停下來問,不要硬猜
3. **完成後**:列出做了什麼、用了哪些元件、有沒有偏離規範
4. **檔案更新**:裝新元件後**主動更新** `.claude/components-installed.md`
5. **MCP 優先**:使用 shadcn 元件前**必須**用 MCP 確認最新 API

## 規範引用

- shadcn MCP 使用 → @.claude/mcp-usage.md
- shadcn 元件守則 → @.claude/shadcn-usage.md
- 設計 token → @.claude/design-tokens.md
- 已裝元件清單 → @.claude/components-installed.md
- 列表頁範本 → @.claude/patterns/data-table.md
- 表單頁範本 → @.claude/patterns/form-page.md
- 設定頁範本 → @.claude/patterns/settings-page.md
