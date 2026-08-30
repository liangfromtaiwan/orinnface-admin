# OrinnFACE 管理画面 — API Contract

> Mock data から real backend への移行ガイド。
> 全 mock function に対応する API endpoint 提案、認証 / 権限 / マルチテナント / BtoB 個資保護を含む。
> 最終更新:2026-05-17 (Day 9)

## 目次

1. [前提与命名規約](#前提与命名規約)
2. [認証 & 認可](#認証--認可)
3. [マルチテナント設計](#マルチテナント設計)
4. [BtoB 個資保護(規格 3-2)](#btob-個資保護規格-3-2)
5. [Endpoints](#endpoints)
   - [Tenant / Companies](#1-tenant--companies)
   - [Users](#2-users)
   - [Analytics(Daily KPIs + 分布)](#3-analyticsdaily-kpis--分布)
   - [Plans(現スナップショット + 営収シグナル)](#4-plans現スナップショット--営収シグナル)
   - [Plan History(変更イベント)](#5-plan-history変更イベント)
   - [Videos & Content](#6-videos--content)
6. [権限マトリックス](#権限マトリックス)
7. [パフォーマンス考慮](#パフォーマンス考慮)
8. [前端不需要改但後端要做的事](#前端不需要改但後端要做的事)

---

## 前提与命名規約

- **Base URL**:`https://api.orinnface.com/v1`(本番)/ `http://localhost:3001/v1`(開発)
- **Content-Type**:すべて `application/json`
- **日付**:ISO 8601、UTC(`2026-05-13T09:12:00Z`)
- **ID**:数値 ID 推奨(現 mock は number、UUID への移行も可)
- **ページング**:必要箇所のみ `?page=1&limit=50` 形式
- **エラー形式**:
  ```json
  { "error": { "code": "FORBIDDEN", "message": "...", "details": {...} } }
  ```

---

## 認証 & 認可

### 推奨方式:**JWT(Bearer Token)**

- ヘッダー:`Authorization: Bearer <jwt>`
- JWT payload 必須 claims:
  ```typescript
  {
    sub: string,           // user id
    company_id: number,    // 所属企業 id(0 = OrinnFACE 運営)
    role: "admin" | "oem" | "b2b",   // CompanyType と一致
    scopes: string[],      // "read:users" 等
    iat: number, exp: number
  }
  ```

### Role definitions

| role | 説明 | 例 |
|------|------|-----|
| **admin** | OrinnFACE 運営内部、全テナント横断アクセス可 | OrinnFACE 社員 |
| **oem** | OEM 提供先(店舗・KOL 等)、自社データのみ | 店舗A 担当者 |
| **b2b** | BtoB 企業 HR、自社集計のみ(個人情報非開示) | 企業X 人事 |

### Scopes 提案

| scope | 含む操作 |
|-------|---------|
| `read:companies` | 提供先一覧、提供先詳細 |
| `read:users` | ユーザー一覧、ユーザー詳細(b2b は付与しない)|
| `read:analytics` | Daily KPI、分布(全 role 必須)|
| `read:plans` | Plan 現スナップショット、営収シグナル |
| `read:plan-events` | Plan 変更個別イベント(b2b は付与しない)|
| `read:videos` | 動画 catalog、視聴統計 |

### Token 取得

実装は別途。OAuth2 + GitHub/Google SSO 推奨。

---

## マルチテナント設計

### **`company_id` の決定源**

| 役割 | company_id の出所 | 切替可能性 |
|------|------------------|-----------|
| admin | JWT claim(常に 0)+ クエリ `?company_id=X`(任意切替) | ✓ |
| oem | JWT claim(自社 id 固定) | ✗ |
| b2b | JWT claim(自社 id 固定) | ✗ |

**critical**:**oem / b2b は JWT 上の `company_id` を信頼ソースとする**。
URL クエリ `?company_id=` を渡された場合:
- admin は受け入れる(view-as 機能)
- **oem / b2b は無視 + 警告 log + 強制的に JWT の company_id を採用**(または 403 を返す)

### 跨公司読取防止

すべての DB query に `WHERE company_id = $1` を強制(query builder で middleware 化推奨):

```typescript
// 必ず JWT から取得
const effectiveCompanyId = req.user.role === "admin"
  ? (Number(req.query.company_id) || 0)  // admin だけ任意切替可
  : req.user.company_id                   // oem / b2b は固定
```

### Mock との対応

mock では URL `?company_id=X&type=Y` だけで切替可能(認証無し)。
本番では URL の company_id は admin role 専用、その他 role は JWT を絶対視。

---

## BtoB 個資保護(規格 3-2)

「個人を特定できる情報は一切表示しない」を**バックエンド側で強制**する必要あり。
**フロントの sidebar 隠し / redirect は UX のみ**、API レベルでも禁止すること。

### b2b role が呼べない endpoint(403 Forbidden)

| Endpoint | 理由 |
|----------|------|
| `GET /api/users` | 個別ユーザーリスト |
| `GET /api/users/:id` | 個別ユーザー詳細 |
| `GET /api/users/:id/activity` | 個別行動履歴 |
| `GET /api/plan-events` | 個別 plan 変更ログ |

### b2b role が呼べる endpoint(自社のみ)

- `GET /api/analytics/daily` — 全社集計 → 自社のみ filter
- `GET /api/plans/composition` — 自社全体の Guest:Member:Premium
- `GET /api/videos/stats` — 自社員工の集計視聴データ
- `GET /api/companies/me` — 自社情報

### 403 vs 空配列の判断

| Endpoint | 403 を返す | 空配列を返す |
|----------|-----------|------------|
| 個別資料系(`/users/:id`)| ✓ | ✗ |
| リスト系で b2b 不可(`/users`)| ✓ | ✗ |
| 集計系(`/analytics/daily`)| ✗ | ✓ (filter 後 0 件なら空) |

**理由**:403 は「権限不足を明示」、空配列は「該当データ無し」の意味。
混同するとフロントエラーハンドリングが複雑化。

---

## Endpoints

---

### 1. Tenant / Companies

#### `GET /api/companies`

**Mock 位置**:`src/lib/mock-data/companies.ts` の `companies` array
**呼び出し処**:`AdminDashboard.tsx`、`CompanySwitcher.tsx`
**用途**:CompanySwitcher dropdown 表示用、admin が view-as するための提供先一覧

**Parameters**:なし(admin は全件、oem/b2b は自社のみ)

**Response**:
```typescript
{
  companies: Array<{
    id: number,
    name: string,
    type: "admin" | "oem" | "b2b",
    subType: "operator" | "shop" | "influencer" | "company",
    createdAt: string  // ISO date
  }>
}
```

**Authentication**:必須、`read:companies` scope
**権限**:
- admin: 全 5 社返す
- oem / b2b: 自社 1 件のみ返す(CompanySwitcher に他社を表示させない)

---

#### `GET /api/companies/:id`

**Mock 位置**:`companies.ts` の `getCompany(id)`
**呼び出し処**:`B2BDashboard.tsx`、`OEMDashboard.tsx`、`StatusPage.tsx`、`ContentPage.tsx`、`UserDetailPage.tsx`、`UsersPage.tsx`
**用途**:ヘッダー表示等で company name / type / subType を取得

**Response**:単一 Company オブジェクト

**Authentication**:必須
**権限**:
- admin: 全社可
- oem / b2b: `id === JWT.company_id` のみ、他は 403

---

### 2. Users

#### `GET /api/users`

**Mock 位置**:`users.ts` の `users` array、`getUsersByCompany(companyId)`
**呼び出し処**:`UsersPage.tsx`、`AdminDashboard.tsx`、`StatusPage.tsx`、`B2BDashboard.tsx`、`OEMDashboard.tsx`
**用途**:一覧表示、KPI 計算の denominator

**Parameters**:
- `company_id?: number` — admin のみ任意切替、oem は JWT 固定、b2b は **403**
- `with_activity?: boolean` — `true` で activityLog も含める(default false、性能のため)

**Response**:
```typescript
{
  users: Array<{
    id: number,
    name: string,
    companyId: number,
    plan: "Guest" | "Member" | "Premium",
    expression: Expression,     // 5 種
    fatigueAi: Fatigue,         // 5 段
    subjectiveFatigue: SubjectiveFatigue,  // 3 段
    subjectiveFocus: SubjectiveFocus,      // 3 段
    bodyPart: BodyPart,         // 5 部位
    lastAnalysisAt: string,     // ISO
    // with_activity=true 時のみ
    activityLog?: ActivityRecord[]
  }>,
  total: number
}
```

**Authentication**:必須、`read:users` scope
**権限**:
- admin: 全件 or company filter
- oem: 自社のみ(JWT 強制 filter)
- b2b: **403 Forbidden**

**注意**:
- `with_activity=true` は1 ユーザーあたり 6-8 records 追加、リスト 30 人で 240+ records → 大規模時 N+1 注意

---

#### `GET /api/users/:id`

**Mock 位置**:`users.ts` の `getUserById(id)`
**呼び出し処**:`UserDetailPage.tsx`
**用途**:ユーザー詳細頁、activityLog 含む

**Response**:
```typescript
{
  user: {
    ...User fields,
    activityLog: ActivityRecord[]
  }
}
```

**ActivityRecord 構造**:
```typescript
{
  analyzedAt: string,          // ISO
  expression: Expression,
  fatigueAi: Fatigue,
  subjectiveFatigue: SubjectiveFatigue,
  subjectiveFocus?: SubjectiveFocus,
  bodyPart?: BodyPart,
  careVideoTitle?: string,
  careCompleted?: boolean
}
```

**Authentication**:必須、`read:users` scope
**権限**:
- admin: 全 user 可
- oem: `user.companyId === JWT.company_id` のみ、他は 403
- b2b: **403 Forbidden**

---

### 3. Analytics(Daily KPIs + 分布)

#### `GET /api/analytics/daily`

**Mock 位置**:`analytics.ts` の `getAnalytics(companyId)`、`globalAnalytics`
**呼び出し処**:`AdminDashboard.tsx`、`OEMDashboard.tsx`、`B2BDashboard.tsx`、`StatusPage.tsx`(providerRows 計算)
**用途**:Dashboard 4 KPI、表情 / 疲労 7 日分布、提供先別利用状況

**Parameters**:
- `company_id?: number` — admin のみ、未指定なら全社集計
- `days?: number` — default 30、最大 90

**Response**:
```typescript
{
  series: Array<{
    date: string,         // "2026-05-13"
    dau: number,
    reanalysisRate: number,        // 0-1
    retentionRate: number,         // 0-1(規格 2-1 継続率)
    careExecutionRate: number,     // 0-1
    improvementRate: number,       // 0-1
    expressionDist: Record<Expression, number>,    // 各カテゴリの人数
    fatigueDist: Record<Fatigue, number>           // 各段階の人数
  }>
}
```

**Authentication**:必須、`read:analytics` scope
**権限**:
- admin: 任意 company_id(0 = 全社集計)
- oem: JWT.company_id 強制
- b2b: JWT.company_id 強制

**注意**:
- 30 日分の time series は frontend で集計するより BE が daily snapshot table から SELECT 推奨
- expression / fatigueDist は別 table の COUNT GROUP BY 結果、real-time なら slow → daily batch + cache 推奨

---

### 4. Plans(現スナップショット + 営収シグナル)

#### `GET /api/plans/composition`

**Mock 位置**:`plans.ts` の `getPlanStats(companyId)`、`globalPlans`
**呼び出し処**:`AdminDashboard.tsx`、`OEMDashboard.tsx`
**用途**:プラン構成 Pie chart、営収シグナル Line chart

**Parameters**:
- `company_id?: number` — admin のみ
- `days?: number` — default 30(daily series 用)

**Response**:
```typescript
{
  current: {            // 現スナップショット
    Guest: number,
    Member: number,
    Premium: number
  },
  daily: Array<{        // 過去 N 日の営収シグナル
    date: string,
    newPremium: number,    // M→P + G→P
    lostPremium: number    // P→M + P→Guest
  }>
}
```

**Authentication**:必須、`read:plans` scope
**権限**:全 role、自社 / 全社の filter は role に応じて適用

**ビジネス重要**:Premium が唯一の課金プラン。G→M / M→G は営収に影響しないため `newPremium / lostPremium` には含めない([project_business_model.md](../.claude/projects/.../project_business_model.md))。

---

### 5. Plan History(変更イベント)

#### `GET /api/plan-events`

**Mock 位置**:`plan-history.ts` の `allPlanChangeEvents`、`getPlanChangeEventsByCompany(companyId)`
**呼び出し処**:`StatusPage.tsx`
**用途**:プラン変更ログ Table、KPI 種別 breakdown

**Parameters**:
- `company_id?: number` — admin のみ
- `from?: string` — ISO date、default 30 日前
- `to?: string` — ISO date、default 今日
- `page?: number`、`limit?: number` — pagination(必要時)

**Response**:
```typescript
{
  events: Array<{
    userId: number,
    changedAt: string,
    fromPlan: Plan,
    toPlan: Plan
  }>,
  total: number
}
```

**Authentication**:必須、`read:plan-events` scope
**権限**:
- admin: 全件 or company filter
- oem: 自社のみ
- b2b: **403 Forbidden**(個別 user の plan 変更履歴は個人情報)

**注意**:`fromPlan`/`toPlan` から `ChangeKind` 判定はフロント側 `classifyChange()` で実施。BE で `kind` field を追加すれば再計算不要。

---

#### `GET /api/plan-time-series`

**Mock 位置**:`plan-history.ts` の `buildPlanTimeSeries(scope, days)`
**呼び出し処**:`StatusPage.tsx`
**用途**:プラン構成 推移 Area chart(Guest/Member/Premium × 30 日)

**Parameters**:
- `company_id?: number` — admin のみ
- `days?: number` — default 30

**Response**:
```typescript
{
  series: Array<{
    date: string,
    Guest: number,
    Member: number,
    Premium: number
  }>
}
```

**Authentication**:必須、`read:plans` scope
**権限**:
- admin / oem: 通常通り
- b2b: **OK**(集計のみ、個人情報無し)

**実装ヒント**:
- 各 user の plan 変更 events を逆算して各日の plan を求める
- 効率のため event sourcing で daily snapshot を materialize 推奨

---

#### `GET /api/plan-kpi`

**Mock 位置**:`plan-history.ts` の `calculateChurnRate()`、`calculateNetPremiumChange()`
**呼び出し処**:`StatusPage.tsx`
**用途**:KPI cards(churn 率、純増、種別 breakdown)

**Parameters**:`company_id?`、`days?` — `/plan-events` と同じ

**Response**:
```typescript
{
  churnRate: number,             // 0-1
  churnEventCount: number,
  initialPremiumCount: number,
  currentPremiumCount: number,
  netPremiumChange: number,
  eventsByKind: {
    upgrade: number,
    reactivate: number,
    downgrade: number,
    cancel: number
  }
}
```

**権限**:b2b OK(集計のみ)

---

### 6. Videos & Content

#### `GET /api/videos`

**Mock 位置**:`videos.ts` の `videos` array、`getVideoById(id)`
**呼び出し処**:`ContentPage.tsx`(catalog 表示)
**用途**:動画 catalog 取得

**Parameters**:なし(全 catalog、catalog 自体は tenant 非依存)

**Response**:
```typescript
{
  videos: Array<{
    id: number,
    title: string,
    durationSeconds: number,
    category: "stretch" | "meditation" | "yoga" | "breathing" | "eye-care",
    recommendedFor?: Fatigue[]
  }>
}
```

**Authentication**:必須、`read:videos` scope
**権限**:全 role、catalog は共有

**注意**:catalog は OrinnFACE 中央管理、tenant 別ではない。

---

#### `GET /api/videos/stats`

**Mock 位置**:`videos.ts` の `getVideoStats()`、`getAllVideoStats()`、`groupVideosByDurationBucket()`、`getViewsByCompany()`
**呼び出し処**:`ContentPage.tsx`
**用途**:Content 4 KPI、ランキング Table、動画尺別完遂率 Chart

**Parameters**:
- `company_id?: number` — admin のみ
- `from?: string`、`to?: string` — ISO date、default 過去 30 日
- `group_by?: "video" | "duration_bucket" | "category"` — 集計粒度(default `video`)

**Response**(group_by="video"):
```typescript
{
  totalViewCount: number,
  completionRate: number,
  reanalysisRate: number,
  videos: Array<{
    videoId: number,
    viewCount: number,
    completionRate: number,    // 0-1
    reanalysisRate: number     // 0-1、完遂者中 24h 内再分析率
  }>
}
```

**Response**(group_by="duration_bucket"):
```typescript
{
  buckets: Array<{
    bucketKey: string,         // "0-30s" 等
    bucketLabel: string,       // "30秒以下"
    videoCount: number,        // catalog の動画数
    viewCount: number,
    completionRate: number,
    reanalysisRate: number
  }>
}
```

**Authentication**:必須、`read:videos` scope
**権限**:
- admin / oem: 自社 filter
- b2b: 自社員工の集計のみ(規格 3-2 OK、個別動画視聴記録は出さない)

**注意**:
- `completionRate` と `reanalysisRate` は完遂判定ロジック(視聴時間 / 動画長 >= 90% 等)を要規定
- `reanalyzedWithin24h` 判定はサーバー側 stored procedure or analytics job 推奨

---

#### `GET /api/videos/views`

**Mock 位置**:`videos.ts` の `allViewRecords`、`getViewsForScope()`、`getViewsByCompany()`
**呼び出し処**:`ContentPage.tsx`(間接、stats 計算用)
**用途**:個別視聴ログ(主に統計計算のソース)

**Parameters**:`company_id?`、`from?`、`to?`、`user_id?`(admin / oem 自社のみ)

**Response**:
```typescript
{
  views: Array<{
    userId: number,
    videoId: number,
    watchedAt: string,
    completed: boolean,
    reanalyzedWithin24h: boolean
  }>,
  total: number
}
```

**Authentication**:必須、`read:videos` scope
**権限**:
- admin / oem: 自社 filter
- b2b: **403 Forbidden**(userId が個人情報)

**運用注意**:このエンドポイントは個別記録なので b2b には絶対出さない。集計が必要なら `/videos/stats` を使う。

---

## 権限マトリックス

| Endpoint | admin | oem | b2b |
|----------|-------|-----|-----|
| `GET /companies` | 全件 | 自社 1 件 | 自社 1 件 |
| `GET /companies/:id` | 全可 | 自社のみ | 自社のみ |
| `GET /users` | 全件 or filter | 自社のみ | **403** |
| `GET /users/:id` | 全可 | 自社のみ | **403** |
| `GET /analytics/daily` | 全件 or filter | 自社のみ | 自社のみ(集計)|
| `GET /plans/composition` | 全件 or filter | 自社のみ | 自社のみ |
| `GET /plan-events` | 全件 or filter | 自社のみ | **403** |
| `GET /plan-time-series` | 全件 or filter | 自社のみ | 自社のみ(集計)|
| `GET /plan-kpi` | 全件 or filter | 自社のみ | 自社のみ(集計)|
| `GET /videos` | 全可(catalog 共有)| 同 | 同 |
| `GET /videos/stats` | 全件 or filter | 自社のみ | 自社のみ(集計)|
| `GET /videos/views` | 全件 or filter | 自社のみ | **403** |

---

## パフォーマンス考慮

### 重そうな endpoint

| Endpoint | ボトルネック予測 | 対策 |
|----------|----------------|-----|
| `GET /analytics/daily?days=30` | 30 日 × 表情 5 種 + 疲労 5 段の COUNT JOIN | **daily batch でマテリアライズ** |
| `GET /plan-time-series?days=30` | 各日各 user の plan 状態を event 逆算 | **daily snapshot table** |
| `GET /videos/stats` | 視聴 record の集計(完遂率 / 再分析率)| **動画別 daily aggregate cache** |
| `GET /users?with_activity=true` | activityLog の N+1 | join + limit、または別 endpoint で paginate |

### Caching 戦略

- **L1**(BE memory cache)はリクエスト粒度では効きにくい(JWT 違う = key 違う)
- **L2**(Redis):`company_id + endpoint + params` をキーに、`/analytics/daily`・`/plan-time-series`・`/videos/stats` を 5-15 分 TTL で cache
- **L3**(CDN):`/videos`(catalog)は public、長 TTL OK
- **Daily 集計はバッチ job(深夜実行)** で事前マテリアライズ、API はその結果を返す

### Pagination

- 現 mock データは 30 user / 200+ activity records / 400+ video views と少量
- 本番では user 数 1000+ になれば必須
- `?page=1&limit=50` + `total` 返却で標準化推奨
- 該当 endpoint:`/users`、`/users/:id/activity`(activityLog 別出し)、`/plan-events`、`/videos/views`

---

## 前端不需要改但後端要做的事

### A. Audit log(規制対応)

- **誰が、いつ、どの endpoint を、どの company_id 範囲で叩いたか**を別 table に記録
- 特に `read:users` 系は個人情報アクセスなので必須
- 7 年保管(GDPR / 個人情報保護法準拠)
- 専用テーブル:`audit_log(user_id, endpoint, params, ip, ua, at)`

### B. Rate limiting

- per JWT:60 requests / minute(通常 API)
- per JWT:5 requests / minute(`/users` 全件取得等の重 endpoint)
- 429 Too Many Requests で `Retry-After` header

### C. Webhook(将来検討)

- Plan 変更時:Slack / メール通知
- チャーン発生時:営業 / CS 部門に alert
- 規格 3-1 警告色 trigger 時:管理者にプッシュ通知?

### D. Data validation

- BE で全 input validate(Zod / Joi 等)
- 特に `company_id`、`type` は enum 厳格化、不正値は 400
- Date range は `to - from <= 365` 制限(過去全期間取得を防止)

### E. CORS

- 本番:`https://orinnface-admin.vercel.app`(production)、`http://localhost:5173`(dev)
- credentials: include(JWT cookie 採用時)

### F. CSRF

- JWT を Authorization header で送る場合は CSRF 不要
- Cookie 認証採用時は CSRF token 必須

### G. Soft delete

- User / Company の物理削除はしない、`deleted_at` column で soft delete
- API は `WHERE deleted_at IS NULL` を強制

### H. Database constraints

- `user.company_id` → FK to `companies(id)`、ON DELETE RESTRICT
- `activity_record.user_id` → FK to `users(id)`、ON DELETE CASCADE
- `plan_change_event.user_id` → FK to `users(id)`、ON DELETE CASCADE
- `video_view_record.user_id` + `video_id` → FK、ON DELETE CASCADE

### I. Mock data 引き継ぎ用 seed scripts

実 DB 立てる際、現 mock data から seed script を生成:
- 30 users(5 Premium / 10 Member / 15 Guest)
- 4 companies(c1-c4)
- 200+ activity records
- 400+ video view records
- 7 plan change events
- 15 videos catalog

mock 生成ロジック(seeded random)はそのまま seeding script に転用可、特に demo / staging 環境で再現性確保。

---

## 規格 4-4「将来対応」3 項目(参考)

NEXT_STEPS.md 参照。本ドキュメントは v0.1 → v1.0 移行用、4-4 項目は別途。
