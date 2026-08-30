# OrinnFACE 管理画面 API 契約書(初版)

> **位置づけ**:現行 frontend が `src/lib/mock-data/` から直接読み込んでいる
> データを「将来 backend が提供すべき形」として整理したドキュメント。
> 真實 backend 構築時の reference / contract として使用してください。
>
> **起草日**:2026-05-20
> **対象**:管理画面 frontend(`/Users/liang/Documents/orinnface-admin/`)
> **規格根拠**:`SPEC_REVIEW.md` / `DESIGN_DECISIONS.md`

---

## 0. 概要

OrinnFACE 管理画面は 3 種類の視点(admin / oem / b2b)を 1 つのコードベースで提供します。
現在は frontend で mock data を直接 import していますが、本番では下記の REST endpoint
群を backend が提供する想定です。

### scope 軸

| type | 想定ユーザー | 見える範囲 | 個人情報 |
|------|------------|----------|---------|
| `admin` | OrinnFACE 運営 | 全 company × 全 user | フル取得可 |
| `oem` | OEM 店舗・KOL | 自社 company のみ | 自社 user のフル取得可 |
| `b2b` | 企業 HR | 自社 company のみ | **個人情報一切なし、集計のみ** |

### Base URL(想定)

```
GET https://api.orinnface.jp/admin/v1/...
```

### 認証(想定)

- JWT Bearer token
- token claim に `company_id` / `role`(= `admin|oem|b2b`)
- **backend は frontend が渡す `company_id` を信頼せず、JWT claim と cross-check 必須**

---

## 1. 共通レスポンスルール

### 1.1 成功レスポンス

すべて JSON。トップレベル形:

```json
{
  "data": <payload>,
  "meta": {
    "scope": { "companyId": 0, "type": "admin" },
    "generatedAt": "2026-05-20T01:23:45Z"
  }
}
```

`meta.scope` は backend が JWT から決定した実際のスコープを返す
(frontend が間違って投げた場合の debug 用)。

### 1.2 エラーレスポンス

```json
{
  "error": {
    "code": "FORBIDDEN_SCOPE",
    "message": "BtoB クライアントは個別ユーザー情報を閲覧できません"
  }
}
```

#### 主要エラーコード

| code | HTTP | 発生条件 |
|------|------|---------|
| `UNAUTHORIZED` | 401 | token 無効・期限切れ |
| `FORBIDDEN_SCOPE` | 403 | 自社 company 外へのアクセス試行 |
| `FORBIDDEN_PII` | 403 | b2b が個人情報 endpoint を呼んだ |
| `NOT_FOUND` | 404 | リソース不存在 |
| `INVALID_PARAMS` | 400 | クエリ不正 |

### 1.3 日時形式

すべて ISO 8601(`YYYY-MM-DDTHH:mm:ssZ`、UTC)。
日付のみは `YYYY-MM-DD`。

### 1.4 数値の正規化

- 比率(CVR / 完遂率 / クリック率等):**0-1 の float**(例 `0.186`、frontend で `%` 表記に変換)
- 件数:`integer`
- 金額(将来):`integer`(円、小数禁止)

---

## 2. データ型(TypeScript reference)

実装は `src/lib/mock-data/types.ts` を正本とします。下記は本ドキュメント用の抜粋。

### 2.1 共通 enum

```ts
type CompanyType = "admin" | "oem" | "b2b"
type Plan = "Guest" | "Member" | "Premium"
type Gender = "女性" | "男性" | "回答しない"

type Expression =
  | "張り(強)" | "張り(弱)" | "おだやか"
  | "ゆらぎ(強)" | "ゆらぎ(弱)"

type Fatigue =
  | "軽やか" | "いつも通り" | "ややお疲れ"
  | "蓄積しています" | "踏ん張りどき"
```

### 2.2 Company

```ts
type Company = {
  id: number
  name: string
  type: CompanyType
  subType: "operator" | "shop" | "influencer" | "company"
  createdAt: string  // YYYY-MM-DD
}
```

### 2.3 User

```ts
type User = {
  id: number
  name: string
  companyId: number
  plan: Plan
  gender?: Gender         // Member / Premium のみ。Guest は undefined
  birthDate?: string      // YYYY-MM-DD、同上
  expression: Expression
  fatigueAi?: Fatigue          // Premium のみ
  subjectiveFatigue?: SubjectiveFatigue  // 同上
  subjectiveFocus: SubjectiveFocus
  bodyPart: BodyPart
  lastAnalysisAt: string
  activityLog: ActivityRecord[]
}
```

### 2.4 CTAEvent

```ts
type CTAType = "guest_to_member" | "free_to_premium"
type CTATiming =
  | "after_survey" | "before_care" | "daily_limit"
  | "video_care_7_to_10" | "monthly_limit" | "day_30"

type CTAEvent = {
  id: string
  userId: number
  ctaType: CTAType
  ctaTiming: CTATiming
  triggeredAt: string
  clicked: boolean
  converted: boolean
  convertedAt?: string
}
```

---

## 3. Endpoints

### 3.1 Companies

#### `GET /companies`

**用途**:CompanySwitcher の選択肢取得

**Query**:なし

**Response**:`Company[]`

**Scope**:
- `admin` → 全 company を返す
- `oem` / `b2b` → **自社 + (オプション)親会社のみ**(現 mock は全件返す、本番は要制限)

**現 mock 対応**:`companies` const

---

#### `GET /companies/:id`

**Path**:`id` = company.id

**Response**:`Company`

**Scope**:自社以外は 403

**現 mock 対応**:`getCompany(id)`

---

### 3.2 Users

#### `GET /users`

**用途**:ユーザー一覧

**Query**:
- `company_id`(必須):filter scope(`admin` 時のみ 0 を許容 = 全社)
- `q`(任意):name 部分一致(半角・全角空白除去後で比較)

**Response**:`User[]`

**Scope**:
- `admin` + `company_id=0` → 全 user
- `admin` + `company_id=N` → company N の user
- `oem` → 自社 user のみ
- `b2b` → **403 FORBIDDEN_PII**

**現 mock 対応**:`users`(全件)/ `getUsersByCompany(id)`

---

#### `GET /users/:id`

**Path**:`id` = user.id

**Response**:`User`(`activityLog` 含む)

**Scope**:
- `admin` → 全 user 閲覧可
- `oem` → 自社 user のみ。他社 user → 403
- `b2b` → **403 FORBIDDEN_PII**

**現 mock 対応**:`getUserById(id)`

---

### 3.3 Analytics(Dashboard 用)

#### `GET /analytics/daily`

**用途**:Dashboard の DAU / 再分析率 / 継続率 / ケア実施率 / 表情分布 / 疲労分布 推移

**Query**:
- `company_id`:0 = 全社、N = 該当 company
- `days`(任意、default 30):何日分か

**Response**:`DailyAnalytics[]`

```ts
type DailyAnalytics = {
  date: string                    // YYYY-MM-DD
  dau: number
  reanalysisRate: number          // 0-1
  retentionRate: number           // 7 日内再訪率
  careExecutionRate: number       // ケア完遂率
  improvementRate: number         // ケア後改善率
  expressionDist: Record<Expression, number>
  fatigueDist: Record<Fatigue, number>
}
```

**Scope**:`admin` / `oem` / `b2b` 全て可。但し `b2b` は **個人情報を含まない集計のみ**(本 endpoint は元々集計、問題なし)

**現 mock 対応**:`getAnalytics(companyId)`

---

### 3.4 Plan Stats

#### `GET /plans/stats`

**用途**:Dashboard のプラン構成 + 日次 Premium 増減

**Query**:`company_id`

**Response**:`PlanStats`

```ts
type PlanStats = {
  current: { Guest: number; Member: number; Premium: number }
  daily: { date: string; newPremium: number; lostPremium: number }[]
}
```

**Scope**:3 視点全て可

**現 mock 対応**:`getPlanStats(companyId)`

---

#### `GET /plans/history`

**用途**:ステータス頁の「プラン変更ログ」 + 推移チャート

**Query**:
- `company_id`
- `days`(default 30)

**Response**:

```ts
{
  events: PlanChangeEvent[]            // 個別ログ
  timeSeries: PlanTimeSeriesRow[]      // 日次の Guest/Member/Premium 人数
  churnRate: number                    // Premium 解約率 0-1
  netPremiumChange: number             // Premium 純増
}

type PlanChangeEvent = {
  userId: number
  changedAt: string
  fromPlan: Plan
  toPlan: Plan
}

type PlanTimeSeriesRow = {
  date: string
  Guest: number
  Member: number
  Premium: number
}
```

**Scope**:
- `admin` / `oem` → 可
- `b2b` → **403**(個別の userId が含まれるため。集計のみが必要なら別 endpoint 化)

**現 mock 対応**:
- `getPlanChangeEventsByCompany(companyId)`
- `buildPlanTimeSeries(scopeUserIds)`
- `calculateChurnRate(scopeUserIds)`
- `calculateNetPremiumChange(scopeUserIds)`

---

### 3.5 Videos & Content

#### `GET /videos`

**用途**:動画 catalog 取得

**Query**:なし

**Response**:`Video[]`

```ts
type Video = {
  id: number
  title: string
  durationSeconds: number
  category: VideoCategory
  recommendedFor?: Fatigue[]
}
```

**現 mock 対応**:`videos`

---

#### `GET /videos/:id`

**Response**:`Video`

**現 mock 対応**:`getVideoById(id)`

---

#### `GET /content/stats`

**用途**:ContentPage 用、動画別・尺別の利用統計

**Query**:`company_id`

**Response**:

```ts
{
  videoStats: VideoStats[]             // 個別動画統計
  bucketStats: DurationBucketStats[]   // 尺バケット別
  categoryStats: CategoryStats[]       // カテゴリ別
}

type VideoStats = {
  videoId: number
  viewCount: number
  completionRate: number    // 0-1
  reanalysisRate: number    // 完遂者中 24h 内再分析率
}

type DurationBucketStats = {
  bucket: { key: string; label: string; minSeconds: number; maxSeconds: number }
  videoCount: number
  viewCount: number
  completionRate: number
  reanalysisRate: number
}
```

**Scope**:3 視点全て可(集計のみ)

**現 mock 対応**:
- `getAllVideoStats(records)`
- `groupVideosByDurationBucket(records)`
- `getCategoryStats(records)`

**前提**:scope に対応した `VideoViewRecord[]` を別途 backend で内部結合

---

### 3.6 CTA Events

#### `GET /cta/stats`

**用途**:`/cta-analysis` ページ用、CTA 漏斗 KPI

**Query**:
- `company_id`
- `days`(default 30)

**Response**:

```ts
{
  byType: {
    guest_to_member: CTAStats
    free_to_premium: CTAStats
  }
  byTiming: Array<{
    timing: CTATiming
    stats: CTAStats
  }>
}

type CTAStats = {
  triggered: number
  clicked: number
  converted: number
  cvr: number       // converted / triggered, 0-1
}
```

**Scope**:
- `admin` / `oem` → 可
- `b2b` → **403 FORBIDDEN_PII**(個別転換は商業意義なし)

**現 mock 対応**:
- `getCTAStats(events, ctaType)`
- `getCTAStatsByTiming(events)`

---

#### `GET /cta/events`(オプション)

個別 event を取得したい時用。デバッグ・分析エクスポート想定。

**Query**:
- `company_id`
- `since` / `until`(任意、日付範囲)
- `cta_type`(任意)

**Response**:`CTAEvent[]`

**Scope**:`admin` のみを推奨(個別 user 行動データ)

---

## 4. 三套画面の出し分けまとめ

| Endpoint | admin | oem | b2b |
|----------|-------|-----|-----|
| `/companies` | ✅ 全件 | ✅ 自社のみ | ✅ 自社のみ |
| `/users` | ✅ | ✅ 自社のみ | ❌ **403** |
| `/users/:id` | ✅ | ✅ 自社のみ | ❌ **403** |
| `/analytics/daily` | ✅ | ✅ 自社 | ✅ 自社 |
| `/plans/stats` | ✅ | ✅ 自社 | ✅ 自社 |
| `/plans/history` | ✅ | ✅ 自社 | ❌ **403**(userId 含むため) |
| `/videos` | ✅ | ✅ | ✅ |
| `/content/stats` | ✅ | ✅ 自社 | ✅ 自社 |
| `/cta/stats` | ✅ | ✅ 自社 | ❌ **403** |
| `/cta/events` | ✅ | ⚠️ 推奨非公開 | ❌ |

---

## 5. 工程師接手注意事項

### 5.1 mock data からの移行手順(推奨)

1. **types.ts はそのまま残す**(frontend と backend で型を共有)
   - 検討:`/types/` パッケージとして monorepo 化、OpenAPI 自動生成
2. **mock のヘルパー関数を fetch wrapper に置換**:
   - 例:`getUsersByCompany(id)` → `fetch('/users?company_id=' + id).then(r => r.json())`
   - 既存 helper の signature を保ったまま実装を fetch に変える
3. **scope ガードを backend に移す**:
   - 現 frontend の `if (type === 'b2b') redirect` は保険、本番は backend 403 が正
   - frontend redirect は UX のため残す

### 5.2 セキュリティ

- ❗ **JWT claim の `company_id` を信頼源とする**(frontend から渡る `company_id` は debug のみ)
- ❗ `b2b` 視点で `/users` / `/users/:id` / `/cta/*` / `/plans/history` は 403
- ❗ `oem` 視点で他社 `company_id` を渡されたら 403(silent denial 不可、明示的に弾く)
- ❗ `b2b` 視点の API レスポンスから `userId` / `name` / `gender` / `birthDate` を fields filter(漏らさない)

### 5.3 性能

- `/users`(リスト)はページネーション要(現 mock は全件返却、本番は `?page=&limit=` 推奨)
- `/cta/events` は時系列で量が膨らむため `since`/`until` 必須化
- Dashboard 系(`/analytics/daily`)は 1 日 1 回バッチで pre-aggregate 推奨

### 5.4 mock data 量(参考)

| データ | 現状 mock 件数 |
|--------|--------------|
| Company | 5 |
| User | 30(店舗A 8 / Yumi 6 / 企業X 8 / 企業Y 8) |
| Video | 12 |
| ViewRecord | User の `activityLog` から派生(数十〜数百) |
| PlanChangeEvent | 30 日で 7 件 |
| CTAEvent | 30 日で 285 件 |

### 5.5 本ドキュメントのメンテ方針

- 新 endpoint 追加時はこのファイルにエントリ追記
- 既存 endpoint の response 形変更は **breaking change** として明示マーク
- 規格 (`SPEC_REVIEW.md`) / 設計判断 (`DESIGN_DECISIONS.md`) と相互参照

---

## 6. 未確定事項 / 工程師に判断を委ねる項目

- **ページネーション戦略**:cursor based / page-number based の選択
- **キャッシュ戦略**:`/analytics/daily` を pre-aggregate するか、リクエスト時に動的計算するか
- **CTA event の保存形式**:event sourcing(全件保持) vs 日次集計テーブル
- **`/plans/history` の集計版を b2b 用に作るか**:現在は b2b は完全非表示にしているが、雇主から「集計だけ見せて」要望が出れば検討
- **動画カテゴリの動的化**(`DESIGN_DECISIONS.md` 判斷 1 参照):mock は 5 カテゴリだが本番は company_id 別に catalog table

---

> 持續更新中。新規 endpoint / 既存 endpoint の breaking change は本ファイルに反映。
