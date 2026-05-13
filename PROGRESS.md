# OrinnME 管理画面 - 6 日プロジェクト進度追蹤

> 起始日:Day 1 已完成
> 目標:下週一交付可點擊原型給雇主
> 工具:Claude Code + shadcn/ui + Vite + React 19

---

## 📊 整體進度

| Day | 主題 | 預估時間 | 狀態 | 完成日 |
|-----|------|---------|------|--------|
| 1 | 基礎環境設定 | 4-5 小時 | ✅ 完成 | _______ |
| 2 | Mock Data + Layout | 3-4 小時 | ✅ 完成 | 2026-05-13 |
| 3 | ① 運営 Dashboard | 3-4 小時 | ✅ 完成 | 2026-05-13 |
| 4 | ③ BtoB Dashboard | 3 小時 | ⬜ 待辦 | _______ |
| 5 | OEM 視角 + 警告色 | 2-3 小時 | ⬜ 待辦 | _______ |
| 6 | 部署 + 文件 | 2 小時 | ⬜ 待辦 | _______ |

**進度條**:▓▓▓░░░ 50% (3/6)

---

## ✅ Day 1:基礎環境設定 [完成]

**目標**:把所有工具、規範、套件都備好,讓後續開發暢通無阻。

### 完成項目
- [x] Vite + React 19 + TypeScript 專案
- [x] Tailwind CSS v4
- [x] shadcn/ui v3 init(Nova preset + Zinc 色票)
- [x] TypeScript paths 設定(@/* → src/*)
- [x] 18 個 shadcn 核心元件
  (button, card, input, select, badge, table, dropdown-menu,
  sheet, dialog, alert-dialog, tabs, separator, avatar,
  tooltip, skeleton, sonner, chart, sidebar)
- [x] React Router v7
- [x] Noto Sans JP 字體(已安裝未 @import)
- [x] React Hook Form + Zod + @hookform/resolvers
- [x] CLAUDE.md(OrinnME 強化版,含 self-check)
- [x] .claude/ 規範資料夾(mcp-usage、shadcn-usage、design-tokens、
  components-installed、patterns/{data-table,form-page,settings-page})
- [x] .mcp.json(shadcn MCP 設定)
- [x] .gitignore 含 .env 排除
- [x] Git init + 第一個 commit
- [x] PROGRESS.md(或類似進度文件)

### Day 1 學到的事
- shadcn v3 改成 preset 系統(Nova = 舊 New York)
- React 19 + Router v7 是最新版本
- Claude Code 會做事實檢查,規範要跟實況一致
- 收尾(commit、文件)比衝刺(新功能)更重要

---

## ✅ Day 2:Mock Data + Routing + Layout [完成]

**目標**:建立資料骨架與導航框架,讓後續做 Dashboard 時有資料、有 layout。

### 任務拆解

#### 2-1. Mock Data(估 1.5 小時)✅
在 `src/lib/mock-data/` 建立:

- [x] `companies.ts` — 5 間公司(admin/oem/b2b 三類)
- [x] `users.ts` — 30 假使用者,含 3-5 個主観 vs AI 落差大者(警告色測試用)
- [x] `analytics.ts` — 過去 30 天時間序列(DAU、再分析率、継續率、ケア実行率、改善率、分布)
- [x] `plans.ts` — 會員方案統計(Guest/Member/Premium)+ 升級/解約推移
- [x] `index.ts` — 統一 export
- [x] `types.ts`(超出原計畫):集中型別 + 落差判定 helper

##### 設計決策(Day 3 啟動前回填)
- **retentionRate 欄位獨立於 reanalysisRate**:對應規格書 2-1「継續率(リテンション)」指標,
  不可用「再分析率」代替(規格中是兩個獨立概念)。
  生成邏輯:平日(月〜金)0.82±0.05,週末(土日)0.70±0.04,clamp 0.65〜0.92。
- **プラン推移は「営収シグナル」として Premium 推移のみ追跡(Day 3 中決定)**:
  ビジネスモデル上、**Premium のみが課金プラン**(Guest / Member は無料)。
  そのため `PlanStats.daily` は営収に影響する 2 欄位のみ:
  - `newPremium`  = M→P + G→P(Premium 化したユーザー)
  - `lostPremium` = P→M + P→Guest(Premium から離脱したユーザー)
  G→M / M→Guest など Premium に絡まない遷移は集計から除外。
  検討経緯:当初 4 欄位の細分化、次に「全アップグレード vs 全解約」、
  最後にビジネス意図(営収判定)優先で Premium 限定の集計に確定。

#### 2-2. Routing(估 30 分鐘)✅
- [x] App.tsx 設定 BrowserRouter + Routes
- [x] 6 個路由(/、/dashboard、/users、/users/:id、/content、/status、/settings、404 → /dashboard)

#### 2-3. Admin Layout(估 1.5 小時)✅
- [x] 安裝 sidebar-07 block(連帶 breadcrumb + collapsible)
- [x] 改造 sidebar 為日文導航(5 項:ダッシュボード / ユーザー / コンテンツ分析 / ステータス / 設定)
- [x] CompanySwitcher 元件(URL 同步 ?company_id=X&type=Y,5 間公司含 type icon)
- [x] NavUser 客製日文化(アカウント / 通知設定 / ログアウト)
- [x] Layout 元件包住所有頁面(SidebarProvider + AppSidebar + Header + Outlet)
- [x] App.tsx 全部 route 包進 Layout,加 TooltipProvider + Toaster
- [x] 刪除不用的 team-switcher + nav-projects
- [x] NavMain 接 React Router Link + useLocation(動態 active state)
- [x] CLI 自動轉好 IconPlaceholder → lucide-react(完全沒手動處理)

#### 2-4. 字體接線(估 15 分鐘)✅
- [x] src/index.css @import Inter (400/500/600) + Noto Sans JP Variable
- [x] --font-sans fallback:'Geist Variable', 'Inter', 'Noto Sans JP Variable', system-ui, sans-serif

#### 2-5. 收尾(估 15 分鐘)✅
- [x] npx tsc --noEmit exit 0
- [x] npm run dev 啟動正常(Vite 1.2s ready,zero error)
- [x] CompanySwitcher URL 同步驗證(瀏覽器測試 by user)
- [x] 更新 .claude/components-installed.md(breadcrumb / collapsible / sidebar-07 / Layout / CompanySwitcher 等勾起來)
- [x] 更新 PROGRESS.md
- [x] Git commit

### Day 2 結束時你應該有
- 跑得起來的 admin 框架
- Sidebar 能點擊切換頁面(每頁先顯示頁名)
- Header 的 company switcher 切換時 URL 變化
- 假資料完整就緒

---

## ✅ Day 3:① 運営 Dashboard [完成]

**目標**:做出視覺豐富、資料豐富的完整 Dashboard,展示給雇主看的核心畫面。

### 任務拆解

#### 3-1. Stat Cards 區塊 ✅
- [x] `src/components/StatCard.tsx`:title + 大數字 + delta icon(↑/↓/→)+ description
- [x] Dashboard 頂部 4 個 KPI:今日の再分析率 / 今週の継続率 / 今日のケア実行率 / 主観とAI一致率
- [x] 前 3 個有 delta(vs 前週同曜日 / vs 前週);第 4 個一致率 snapshot 從 users.ts 即時算,**無 delta**(沒有歷史資料,不假造)
- [x] 響應式:`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

#### 3-2. 表情・疲労度分布圖表 ✅
- [x] `src/components/ChartCard.tsx`:通用圖表卡片包裝
- [x] 表情カテゴリ分布:5 類 stacked bar(過去 7 天)
- [x] 疲労ステージ分布:5 階 stacked bar(過去 7 天)
- [x] shadcn chart + Recharts;`--chart-1` ~ `--chart-5`;頂底 bar 圓角、中段直角

#### 3-3. プラン構成比 + 営収シグナル ✅
- [x] Pie chart:Guest/Member/Premium 構成比,donut style,中央顯示 30 名總數
- [x] **営収シグナル Line chart(Premium 推移)**:3 條線
  - Premium 会員数(trajectory 3→8)
  - Premium 新規(M→P + G→P)
  - Premium 離脱(P→M + P→Guest)
  - G→M / M→Guest 等不影響營收的遷移不顯示
- [x] 標題下方顯示「現在 Premium 会員数 8 名」
- [x] 設計決策已記錄於上方 設計決策 段落(Premium 為唯一課金 tier)

#### 3-4. 提供先別利用狀況 ✅
- [x] Card + Table 列出 4 家提供先(id=0 OrinnME運営本身排除)
- [x] 欄位:提供先 / 区分(OEM/BtoB Badge)/ DAU(7日平均)/ 継続率(7日)/ ケア実行率(本日)
- [x] 點擊列 → setSearchParams(`?company_id=X&type=Y`),sidebar CompanySwitcher 即時同步
- [x] Day 4 加 type 條件渲染後完成切換動線

#### 3-5. 響應式 + 收尾 ✅
- [x] Stat cards:1 (mobile) / 2 (md tablet) / 4 (lg desktop)
- [x] 圖表 sections:1 / 1 / 2(平板維持 1 col,2 chart 並列在 768px 太擠)
- [x] 提供先 Table:全寬,自然 responsive
- [x] 全文案日文(含 chart legend / tooltip 標籤)
- [x] npx tsc --noEmit exit 0
- [x] Git commit:"Day 3 完了: 運営 Dashboard"

### Day 3 結束時你應該有
- 第一個視覺完整、功能完整的頁面
- 4 種圖表類型都跑起來(stat、bar、pie、line)
- 切換到「OrinnME運営」視角時顯示這個 Dashboard

---

## ⬜ Day 4:③ BtoB Dashboard + 視覺差異化

**目標**:做出跟 ① 明顯不同的 b2b 版本,展示「我理解三套畫面差異」。

### 任務拆解

#### 4-1. 條件渲染架構(估 30 分鐘)
- [ ] DashboardPage 內部依 `type` 切換子元件:
  - type=admin → `<AdminDashboard />` (Day 3 做的)
  - type=oem → `<OEMDashboard />` (Day 5 做)
  - type=b2b → `<B2BDashboard />` (本日做)

#### 4-2. 隱私提示 Banner(估 15 分鐘)
- [ ] 安裝 alert 元件:`npx shadcn@latest add alert`
- [ ] 頁面最上方放 Alert:
  - Icon:Shield 或 Lock
  - 文字:「本画面は集計データのみを表示します。
    個人を特定できる情報は含まれません。」

#### 4-3. 集計專用 Stat Cards(估 30 分鐘)
- [ ] 4 個 stat card,但只有集計資訊:
  - 利用人数(120名 が利用中)
  - 全体コンディションスコア
  - ケア実行率
  - 平均改善率

#### 4-4. 集計圖表(估 1 小時)
- [ ] 表情分類分布(filter 後資料)
- [ ] 主観疲労分布(疲労 / 集中 / 部位三個 mini chart)
- [ ] 部位別コンディション(horizontal bar 或人體圖)

#### 4-5. 絕對不顯示的內容(確認)
- [ ] 無個人姓名
- [ ] 無個別 user list
- [ ] 無頭像
- [ ] 無行動歷史

#### 4-6. 收尾(估 30 分鐘)
- [ ] 切到「企業X」視角,確認顯示 b2b 版本
- [ ] 切到「OrinnME運営」,確認顯示 admin 版本
- [ ] 兩版本視覺差異明顯
- [ ] Git commit:"Day 4: BtoB Dashboard 完成"

### Day 4 結束時你應該有
- 切換視角時看到截然不同的 Dashboard
- 雇主一眼就能看出三套畫面的設計差異
- 「保護隱私」的設計理念清楚傳達

---

## ⬜ Day 5:② OEM 視角 + 警告色實作

**目標**:補完第三套畫面,實作雇主特別在意的「警告色」邏輯。

### 任務拆解

#### 5-1. OEM Dashboard(估 1 小時)
- [ ] 建立 `<OEMDashboard />` 元件
- [ ] 內容跟 AdminDashboard **幾乎一樣**,但:
  - 資料只 filter 自家 company_id
  - 移除「提供先別利用狀況」(自己只有一家)
  - 頂部加 badge:「店舗A の管理画面」之類
- [ ] 切到「店舗A」視角時顯示

#### 5-2. 要注目ユーザー區塊(估 1 小時)[重點]
- [ ] 在 AdminDashboard 加新區塊
- [ ] Table 列出「主観 vs AI 落差大」的使用者:
  - 計算邏輯:主観疲労等級與 AI 疲労等級差 >= 2 階段
  - 列底色:`bg-red-50`
  - 名前左側:`<AlertTriangle>` icon(text-destructive)
  - 欄位:名前、主観疲労、AI 疲労、差異、最終分析時刻
- [ ] 確認 mock-data/users.ts 有 3-5 個這種異常資料

#### 5-3. 細節調整(估 30 分鐘)
- [ ] 三個視角切換流暢
- [ ] 沒有殘留的「console.log」或 placeholder 文字
- [ ] 沒有顯眼的 layout bug
- [ ] 全部用日文文案

#### 5-4. 收尾(估 15 分鐘)
- [ ] Git commit:"Day 5: OEM 視角 + 警告色實作"

### Day 5 結束時你應該有
- 三套畫面(①②③)全部能切換顯示
- 警告色邏輯運作,異常資料明顯
- 整體完成度足夠展示給雇主

---

## ⬜ Day 6:部署 + 文件 [週日,交件前一天]

**目標**:把成果交付到雇主能輕鬆查看的形式。

### 任務拆解

#### 6-1. 部署到 Vercel(估 30 分鐘)
- [ ] 安裝 Vercel CLI(如果還沒):`npm i -g vercel`
- [ ] 在專案根目錄跑:`vercel`
- [ ] 跟著指示登入(用 GitHub 帳號)
- [ ] 完成部署,拿到 production URL
- [ ] 在手機、平板上各打開一次測試

#### 6-2. README 寫給雇主看的版本(估 30 分鐘)
- [ ] 建立 `DEMO.md` 或更新 README.md:
  - 部署 URL
  - 視角切換說明(怎麼切三個視角)
  - 本版本含哪些頁面/功能
  - **未完成項目清楚列出**(設定預期)
  - 想請雇主確認的問題清單
  - 技術棧簡介

#### 6-3. 自己跑一遍 user testing(估 30 分鐘)
- [ ] 用 production URL(不是 localhost)
- [ ] 模擬雇主視角,把每個功能點一遍
- [ ] 記錄 broken 的地方、奇怪的文案、視覺 bug
- [ ] 馬上修,重新 deploy

#### 6-4. 開會前最後檢查(估 15 分鐘)
- [ ] 確認下週一開會時間
- [ ] 準備好 demo 流程(先給 ①、再切 ②、最後切 ③)
- [ ] 把 Vercel URL 加到行事曆 / 備忘錄
- [ ] dev server 也跑起來,以便會議中即時修改

### Day 6 結束時你應該有
- 一個雇主可以從手機點開看的 URL
- 一份簡短專業的說明文件
- 充足的信心進入下週一會議

---

## 🗓️ 開會當天:下週一

### 開會前 1 小時
- [ ] 重新跑 npm run dev,確認本機環境也活著
- [ ] 開好 Claude Code,準備即時修改
- [ ] 準備好兩個瀏覽器分頁:Production URL + localhost

### 開會 demo 順序建議
1. 簡介背景:「依規格書,管理畫面有三套」
2. 展示視角切換:「我建立的架構支援這個切換」
3. 演示 ① 運営 Dashboard:「這是弊社內部用的全資料版」
4. 切到 ③ BtoB:「企業客戶看到的是這個,無個人資料」
5. 切到 ② OEM:「店家看到的是 ① 的 filter 版本」
6. 展示警告色:「規格特別提到的『主觀 vs AI 落差』邏輯」
7. 列出未完成項目,討論下一輪優先順序

### 開會時的心態
- 雇主有意見 → **當場改、即時看**(展示這個流程本身就贏)
- 雇主說「這裡不對」→ 不要辯護,先問「您期待的是?」
- 雇主說「太簡單了」→ 提醒這是 v0.1 原型,核心架構正確才重要

---

## 📋 每天結束 checklist

每天結束做這 3 件事,確保隔天無痛續接:

1. [ ] 更新 PROGRESS.md(把今天完成的勾起來)
2. [ ] 更新 .claude/components-installed.md(裝了新元件就勾)
3. [ ] Git commit(commit message 寫清楚做了什麼)

---

## 🚨 風險與緩衝

| 風險 | 緩衝策略 |
|------|---------|
| 某天進度落後 | Day 5 是「精修日」,可挪用緩衝 |
| Claude Code 卡關 | /clear 重開對話,讓它重讀 CLAUDE.md |
| 元件 API 不熟 | 用 shadcn MCP 即時查 |
| 視覺風格走偏 | 隨時對照 design-tokens.md |
| 雇主臨時加需求 | 列入「Day 7 以後」,不破壞下週一交付 |

---

## 💡 給未來自己的提醒

1. **規範與事實必須一致**:CLAUDE.md 寫的、package.json 裝的、實際 code 用的,三者要對得上
2. **收尾比衝刺重要**:每天結束花 15 分鐘做 commit 與文件更新
3. **MCP 不是裝飾**:寫 shadcn 元件前先用 MCP 查 API,不要靠記憶
4. **不確定就停下來問**:Claude Code 抓到不一致時,認真處理,不要急著繼續
5. **累了就休息**:疲倦時做的決定,明天會花更多時間修

---

最後更新:Day 3 完成日 (2026-05-13)
