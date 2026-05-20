# OrinnME 管理画面 — 画面一覧

> 工程師接手時の「画面マップ」として参照してください。
> 各画面の URL、3 視点での表示差異、使用 component、依存する mock data を網羅。
>
> **起草日**:2026-05-20
> **対象**:`/Users/liang/Documents/orinnme-admin/`
> **routing 定義**:`src/App.tsx`
> **関連ドキュメント**:`API_CONTRACT.md` / `DESIGN_DECISIONS.md` / `SPEC_REVIEW.md`

---

## 1. 全画面サマリー

| # | Path | 画面名 | admin | oem | b2b | 主要機能 | 担当ファイル |
|---|------|--------|:-----:|:---:|:---:|---------|------------|
| 1 | `/` | ルートリダイレクト | ➜ | ➜ | ➜ | `/dashboard` へ redirect | `src/App.tsx` |
| 2 | `/dashboard` | ダッシュボード | ✅ | ✅ | ✅ | 視点別 KPI + チャート + 提供先一覧 | `DashboardPage.tsx` |
| 3 | `/users` | ユーザー一覧 | ✅ | ✅ | ❌ | 一覧 + 名前検索(空白無視) | `UsersPage.tsx` |
| 4 | `/users/:id` | ユーザー詳細 | ✅ | ⚠️ | ❌ | 個人情報 + 推移チャート + 行動履歴 | `UserDetailPage.tsx` |
| 5 | `/content` | コンテンツ分析 | ✅ | ✅ | ✅ | 動画別 / 尺別 / カテゴリ別 統計 | `ContentPage.tsx` |
| 6 | `/status` | ステータス | ✅ | ✅ | ❌ | プラン構成推移 + 変更ログ | `StatusPage.tsx` |
| 7 | `/cta-analysis` | CTA 効果分析 | ✅ | ✅ | ❌ | 漏斗 KPI + Timing 別 Table | `CTAAnalysisPage.tsx` |
| 8 | `/settings` | 設定 | ✅ | ✅ | ✅ | (現在 Placeholder のみ) | `SettingsPage.tsx` |
| 9 | `/*` | 未定義パス | ➜ | ➜ | ➜ | `/dashboard` へ redirect | `src/App.tsx` |

**凡例**:
- ✅ = 表示可能
- ❌ = アクセス時 `/dashboard` へ redirect
- ⚠️ = 条件付き(自社ユーザーのみ。他社 user 指定時は `/users` へ redirect)
- ➜ = リダイレクトのみ

---

## 2. 各画面詳細

### 2.1 `/` — ルートリダイレクト

- **担当ファイル**:`src/App.tsx`
- **挙動**:`<Navigate to="/dashboard" replace />` で `/dashboard` に遷移
- **3 視点共通**:同じ挙動

---

### 2.2 `/dashboard` — ダッシュボード

- **担当ファイル**:`src/pages/DashboardPage.tsx`(視点振り分けのみ)
- **視点別 component**:
  - `admin` → `<AdminDashboard />`(`src/components/AdminDashboard.tsx`)
  - `oem` → `<OEMDashboard />`(`src/components/OEMDashboard.tsx`)
  - `b2b` → `<B2BDashboard />`(`src/components/B2BDashboard.tsx`)
- **表示内容**:

| 視点 | 内容 |
|------|------|
| admin | 全社集計 KPI(DAU / 再分析率 / 継続率 / ケア実施率)+ 全社推移チャート + 提供先一覧 Table |
| oem | 自社のみの KPI + 推移チャート + プラン構成 Pie + プラン推移 |
| b2b | 集計のみ KPI(個人情報非表示) + Privacy banner(Alert) + 集計チャート |

- **依存 mock data**:
  - `getAnalytics(companyId)` / `globalAnalytics`
  - `getPlanStats(companyId)` / `globalPlans`
  - `companies` / `getCompany(id)`
  - `getUsersByCompany(id)` / `users`
- **使用 UI component**:`StatCard` / `ChartCard` / `Card` / `Badge` / `Alert`(b2b のみ) / shadcn Table

---

### 2.3 `/users` — ユーザー一覧

- **担当ファイル**:`src/pages/UsersPage.tsx`
- **3 視点の挙動**:

| 視点 | 挙動 |
|------|------|
| admin | 全 30 user 表示(全社) |
| oem | 自社 user のみ表示(`u.companyId === companyId` で filter) |
| b2b | `/dashboard` へ redirect(個人情報非表示原則) |

- **機能**:
  - 検索ボックス:名前部分一致(**半角・全角空白を無視**して比較)
  - 「主観 vs AI 落差あり」user 数バッジ表示
  - 行クリック → `/users/:id?...`(現視点クエリ引き継ぎ)
- **依存 mock data**:`users` / `getCompany(id)` / `hasFatigueGap(user)`
- **使用 UI component**:shadcn Table / Input / Badge / Card

---

### 2.4 `/users/:id` — ユーザー詳細

- **担当ファイル**:`src/pages/UserDetailPage.tsx`
- **3 視点の挙動**:

| 視点 | 挙動 |
|------|------|
| admin | 全 user 閲覧可 |
| oem | 自社 user のみ閲覧可。他社 user 指定時 → `/users` へ redirect |
| b2b | `/dashboard` へ redirect |

- **表示内容**:
  - 上部:Avatar + 名前 + 会社名 + プラン + 性別 + **年齢(生年月日から計算)**
    - 注意:**完全な生年月日は表示しない**(`DESIGN_DECISIONS.md` 判斷 9 参照)
    - Guest user は性別 / 生年月日 が undefined のため sub-info 非レンダリング
  - 基本情報カード:プラン / 最新表情 / 最新 AI 疲労 / 最終分析
  - コンディション推移チャート(Premium のみ 3 line、Member 以下は表情のみ)
  - 全行動履歴 Table(警告色:主観 vs AI 落差 ≥ 2 で行を赤く)
- **依存 mock data**:
  - `getUserById(id)` / `getCompany(id)`
  - `ActivityRecord` 型
- **使用 UI component**:`Card` / `Avatar` / shadcn Table / `ChartContainer`(LineChart 重ね合わせ)

---

### 2.5 `/content` — コンテンツ分析

- **担当ファイル**:`src/pages/ContentPage.tsx`
- **3 視点の挙動**:

| 視点 | 表示 |
|------|------|
| admin | タイトル「全提供先における動画利用状況」+ 全 view 集計 |
| oem | タイトルに自社名表示(例:「Yumi(美容 KOL)」)+ 自社 view のみ |
| b2b | b2b 専用注記表示 + 集計値のみ(個人情報含まず) |

- **表示内容**:
  - KPI:総視聴数 / 完遂率 / 24h 内再分析率 等
  - 尺バケット別 Bar Chart(30 秒以下 / 30 秒〜1 分 / 1〜2 分 / ...)
  - カテゴリ別統計(ストレッチ / 瞑想 / ヨガ / 呼吸 / アイケア)
  - 動画別 Table(視聴数 + 完遂率 + 再分析率)
- **依存 mock data**:
  - `allViewRecords`(admin)/ `getViewsByCompany(id)`(oem / b2b)
  - `getAllVideoStats(records)` / `groupVideosByDurationBucket(records)` / `getCategoryStats(records)`
  - `videos` / `VIDEO_CATEGORY_LABEL` / `getCompany(id)`
- **使用 UI component**:`StatCard` / `ChartCard`(BarChart) / `Card` / shadcn Table / `Badge`

---

### 2.6 `/status` — ステータス

- **担当ファイル**:`src/pages/StatusPage.tsx`
- **3 視点の挙動**:

| 視点 | 挙動 |
|------|------|
| admin | 全社プラン変更履歴 + 推移 |
| oem | 自社 user のプラン変更履歴 + 推移 |
| b2b | `/dashboard` へ redirect(userId を含むため個人情報扱い) |

- **表示内容**:
  - KPI:Premium 純増 / 解約率(Churn) / 期間内変更件数
  - プラン構成 30 日推移 Area Chart(Guest / Member / Premium 積み上げ)
  - プラン変更ログ Table(日時 + ユーザー + プラン遷移 + 種別 Badge)
- **依存 mock data**:
  - `allPlanChangeEvents`(admin)/ `getPlanChangeEventsByCompany(id)`(oem)
  - `buildPlanTimeSeries(scopeUserIds, 30)`
  - `calculateChurnRate(scopeUserIds)` / `calculateNetPremiumChange(scopeUserIds)`
  - `classifyChange(event)` / `CHANGE_KIND_LABEL`
  - `users` / `getCompany(id)`
- **使用 UI component**:`StatCard` / `ChartCard`(AreaChart) / `Card` / shadcn Table / `Badge`

---

### 2.7 `/cta-analysis` — CTA 効果分析

- **担当ファイル**:`src/pages/CTAAnalysisPage.tsx`
- **3 視点の挙動**:

| 視点 | 挙動 |
|------|------|
| admin | 全社の CTA event を集計 |
| oem | 自社 user の CTA event のみ集計 |
| b2b | `/dashboard` へ redirect(個別転換は商業意義なし) |

- **表示内容**:
  - KPI Card 2 つ:
    - 無料登録 CVR(Guest → Member)
    - Premium 課金 CVR(Free → Premium)
  - Timing 別 Table 2 セクション:
    - 無料登録 CTA(3 timing:アンケート終了後 / ケア開始前 / 1日上限到達)
    - Premium 課金 CTA(3 timing:ケア動画 7-10 回 毎回 / 月上限到達 / Day30 累積)
- **依存 mock data**:
  - `allCTAEvents`(admin)/ `getCTAEventsByCompany(id)`(oem)
  - `getCTAStats(events, ctaType)` / `getCTAStatsByTiming(events)`
  - `CTA_TIMINGS` / `CTA_TIMING_LABEL` / `CTA_TIMING_TO_TYPE`
- **使用 UI component**:`StatCard` / `Card` / shadcn Table
- **関連ドキュメント**:`DESIGN_DECISIONS.md` 判斷 7 / 判斷 8

---

### 2.8 `/settings` — 設定

- **担当ファイル**:`src/pages/SettingsPage.tsx`
- **現状**:`<Placeholder title="設定" />` のみ表示
- **3 視点共通**:全視点でアクセス可、内容は Placeholder
- **将来想定**:アカウント設定 / 通知設定 / 連携設定 等(`patterns/settings-page.md` 参照)

---

### 2.9 `/*` — 未定義パス

- **担当ファイル**:`src/App.tsx`
- **挙動**:`<Navigate to="/dashboard" replace />` で `/dashboard` に遷移

---

## 3. Sidebar 構成

**担当ファイル**:`src/components/app-sidebar.tsx`

| # | 項目 | アイコン | admin | oem | b2b | リンク先 |
|---|------|--------|:-----:|:---:|:---:|---------|
| 1 | ダッシュボード | `LayoutDashboardIcon` | ✅ | ✅ | ✅ | `/dashboard` |
| 2 | ユーザー | `UsersIcon` | ✅ | ✅ | ❌ | `/users` |
| 3 | コンテンツ分析 | `VideoIcon` | ✅ | ✅ | ✅ | `/content` |
| 4 | ステータス | `ActivityIcon` | ✅ | ✅ | ❌ | `/status` |
| 5 | CTA 分析 | `MousePointerClickIcon` | ✅ | ✅ | ❌ | `/cta-analysis` |
| 6 | 設定 | `Settings2Icon` | ✅ | ✅ | ✅ | `/settings` |

**Sidebar 隠匿ロジック**(`app-sidebar.tsx`):

```ts
type NavItem = {
  title: string
  url: string
  icon: React.ReactNode
  hiddenFor?: CompanyType[]  // 該当視点で非表示
}

const visibleNavItems = navItems.filter(
  (item) => !item.hiddenFor?.includes(type)
)
```

- `hiddenFor: ["b2b"]` を付けた項目は b2b 視点で sidebar から消える
- 上記 1〜6 のうち、2 / 4 / 5 が `hiddenFor: ["b2b"]` 指定

---

## 4. URL Pattern

### 4.1 基本構造

```
[base]/[path]?company_id=[N]&type=[admin|oem|b2b]
```

- `base`:開発時 `http://localhost:5173`、本番 Vercel デプロイ URL
- `path`:上記 1〜9 のいずれか
- `company_id`:数値(0 = 運営、1 = 店舗A、2 = Yumi、3 = 企業X、4 = 企業Y)
- `type`:視点指定(省略時は `admin` 扱い)

### 4.2 視点切り替え

`CompanySwitcher`(`src/components/CompanySwitcher.tsx`)で URL の `?company_id=N&type=Y` を書き換える方式。
- Path はそのまま(例:`/dashboard` から `/dashboard` へ、クエリのみ変化)
- React Router の `setSearchParams` を使用

### 4.3 視点判定の標準パターン

各ページの先頭で:

```tsx
const [searchParams] = useSearchParams()
const type = searchParams.get("type") ?? "admin"
const companyId = Number(searchParams.get("company_id") ?? 0)

if (type === "b2b") return <Navigate to="/dashboard" replace />
```

---

## 5. 工程師接手注意事項

### 5.1 視点判定の責任分担

| 層 | 担当 | 例 |
|---|------|------|
| **Sidebar 層** | `app-sidebar.tsx` の `hiddenFor` | 項目をそもそも見せない |
| **URL 層** | 各ページ先頭の `if (type === "b2b") redirect` | URL 直打ち防御 |
| **データ層** | 各ページの mock 関数呼び出し時の filter | scope 不一致なら別データ |
| **backend 層**(未実装) | API で 403 を返す | 真の権限制御 |

**重要**:現状 frontend の防御は UX のため。本番では backend で必ず権限チェック(`API_CONTRACT.md` 5.2 セクション参照)。

### 5.2 BtoB redirect の実装箇所

下記 4 箇所で `if (type === "b2b") return <Navigate to="/dashboard" replace />`:

1. `src/pages/UsersPage.tsx:33`
2. `src/pages/UserDetailPage.tsx:141`
3. `src/pages/StatusPage.tsx:72`
4. `src/pages/CTAAnalysisPage.tsx:108`(現在の行番号、変動可能性あり)

新規 page を追加する際、b2b に見せない場合は同様の redirect を追加。

### 5.3 OEM 視点の他社 user アクセス防御

`UserDetailPage.tsx:166-169`:

```tsx
if (type === "oem") {
  const companyId = Number(searchParams.get("company_id") ?? 0)
  if (user.companyId !== companyId) return <Navigate to="/users" replace />
}
```

→ `/users/:id` で OEM 視点が他社 user を指定した場合、自社ユーザー一覧へ戻す。

### 5.4 視点切り替え時のクエリ引き継ぎ

ページ内で `<Link>` を貼る際は現在のクエリを引き継ぐ。例(`UserDetailPage.tsx:146-147`):

```tsx
const qs = searchParams.toString()
const usersHref = qs ? `/users?${qs}` : "/users"
```

→ ユーザー詳細から「ユーザー一覧に戻る」リンクで視点情報を保持。

### 5.5 真實 backend 移行時のチェックリスト

- [ ] 各ページの mock data import を `fetch()` 呼び出しに置換
- [ ] frontend の `type` / `company_id` は debug 用、backend は JWT claim を信頼源とする
- [ ] b2b 視点で `/users` / `/users/:id` / `/cta/*` / `/plans/history` は 403 を返す
- [ ] oem 視点で他社 `company_id` を渡されたら 403(silent denial 不可)
- [ ] b2b レスポンスから `userId` / `name` / `gender` / `birthDate` を完全除去(fields filter)
- [ ] 詳細は `API_CONTRACT.md` 参照

### 5.6 共通カスタム component の所在

| Component | 用途 | ファイル |
|-----------|------|---------|
| `Layout` | 全画面の SidebarProvider + Header ラッパ | `src/components/Layout.tsx` |
| `AppSidebar` | サイドバー本体 | `src/components/app-sidebar.tsx` |
| `CompanySwitcher` | 視点切り替えセレクタ | `src/components/CompanySwitcher.tsx` |
| `StatCard` | KPI 大数字カード | `src/components/StatCard.tsx` |
| `ChartCard` | チャート用カードラッパ | `src/components/ChartCard.tsx` |
| `AdminDashboard` | 運営視点ダッシュボード | `src/components/AdminDashboard.tsx` |
| `OEMDashboard` | OEM 視点ダッシュボード | `src/components/OEMDashboard.tsx` |
| `B2BDashboard` | BtoB 視点ダッシュボード(集計のみ) | `src/components/B2BDashboard.tsx` |
| `NavMain` | サイドバー主ナビゲーション | `src/components/nav-main.tsx` |
| `NavUser` | サイドバーフッターユーザー表示 | `src/components/nav-user.tsx` |

### 5.7 新規画面追加時の手順

1. `src/pages/NewPage.tsx` を作成
2. `src/App.tsx` の `<Routes>` 内に `<Route path="/new" element={<NewPage />} />` 追加
3. b2b に見せない場合は `if (type === "b2b") return <Navigate to="/dashboard" replace />` を追加
4. Sidebar に出す場合は `src/components/app-sidebar.tsx` の `navItems` に追加(必要なら `hiddenFor` 指定)
5. 本ドキュメント(SCREENS_INVENTORY.md)の各セクションに追記

---

> 持續更新中。新規画面 / Sidebar 項目追加時は本ファイルに反映。
