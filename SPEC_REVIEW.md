# SPEC_REVIEW.md — 規格落地状況核對

> 雇主が規格書を再確認するに先立ち、こちら側でも v1/v2 仕様書と実装の照合を行う。
> 各項目は「規格章節 / 実装ファイル / 状態(✅⚠️❌)」の 3 列で記載。

## 概要

| 項目 | 内容 |
|------|------|
| 核対日 | 2026-05-18 |
| 対象 commit | `b4065c1`(プラン別の分析・動画閲覧仕様を実装) |
| v1 仕様書 | 管理画面の構成と KPI(2026/3 最終更新) |
| v2 仕様書 | サービス全体の更新(管理画面への影響あり、2026/3 最終更新) |
| 文言管理機能(規格 3-2 / 4-3) | 雇主指示により全削除 ✅ |
| Production URL | https://orinnme-admin.vercel.app |

**凡例**:
- ✅ 規格通り実装済み
- ⚠️ 雇主確認待ち / v1.0 範囲外候補
- ❌ 規格と実装が不一致(要修正)
- 🅿️ Parked(取消)

---

## v1 仕様書 章節別対照

### 0. 全体構成

| 規格項目 | 状態 | 実装ファイル / 備考 |
|---------|------|---------------------|
| ① 運営管理画面(type=admin) | ✅ | `AdminDashboard.tsx` + 全頁面 |
| ② OEM 管理画面(type=oem) | ✅ | `OEMDashboard.tsx` + 自社 filter |
| ③ BtoB 企業管理画面(type=b2b) | ✅ | `B2BDashboard.tsx` + 個人情報非表示 |
| 視点切替(URL query) | ✅ | `?company_id=X&type=Y`、`CompanySwitcher.tsx` |
| サイドバー導航(日本語) | ✅ | `app-sidebar.tsx` + `nav-main.tsx` |

### 1. データ構造

| 規格項目 | 状態 | 実装ファイル / 備考 |
|---------|------|---------------------|
| Company(運営/OEM/BtoB 分類) | ✅ | `mock-data/companies.ts`、5 社(運営 1 + OEM 2 + BtoB 2) |
| User(30 名) | ✅ | `mock-data/users.ts` |
| Expression 5 分類 | ✅ | 張り(強/弱)、おだやか、ゆらぎ(強/弱) |
| Fatigue 5 分類(AI) | ✅ | 軽やか〜踏ん張りどき |
| SubjectiveFatigue 3 分類 | ✅ | あまり〜だいぶ疲れている |
| SubjectiveFocus 3 分類 | ✅ | 集中しやすい〜集中しづらい |
| BodyPart 5 分類 | ✅ | 上半身〜特に気になるところはない |
| Plan(Guest/Member/Premium) | ✅ | `types.ts` |
| ActivityRecord(分析履歴) | ✅ | `mock-data/users.ts` の `activityLog` |
| **Premium のみ fatigue 両方保有** | ✅ | `types.ts:84-89` で optional 化、`users.ts:128-138` で plan-aware |

### 2. KPI 設計

#### 2-1. 利用実績 KPI

| 規格項目 | 状態 | 実装位置 |
|---------|------|---------|
| DAU | ✅ | `analytics.ts:DailyAnalytics.dau`、AdminDashboard / OEMDashboard 表示 |
| 再分析率 | ✅ | `reanalysisRate` |
| 継続率(リテンション) | ✅ | `retentionRate`(7 日内再訪)。再分析率と独立(規格 2-1 厳守) |
| ケア実行率 | ✅ | `careExecutionRate` |
| 改善率 | ✅ | `improvementRate`(前週比 delta も実装) |

#### 2-2. 表情分析 KPI

| 規格項目 | 状態 | 実装位置 |
|---------|------|---------|
| 表情カテゴリ分布(5 分類) | ✅ | `expressionDist`、AdminDashboard / OEMDashboard / B2BDashboard |
| 表情推移(30 日) | ✅ | UserDetailPage「コンディション推移」グラフ第 1 line |

#### 2-3. 疲労判定 KPI(Premium 限定機能)

| 規格項目 | 状態 | 実装位置 |
|---------|------|---------|
| AI 疲労 5 段階分布 | ✅ | `fatigueDist`、各 Dashboard |
| 主観 vs AI 落差検出(規格 3-1 警告色) | ✅ | `recordHasGap()` で行赤化、`hasFatigueGap()` で人物 flag |
| 落差が 2 段階以上の警告 | ✅ | `types.ts:179-187`、UsersPage 行赤化、UserDetailPage 表行赤化 |
| **Premium 限定**(規格 v2 反映) | ✅ | `b4065c1` で実装、Guest / Member は fatigue 非表示 |
| **全体コンディションスコア(BtoB)** | ⚠️ | `B2BDashboard.tsx:66-75`、規格定義無し → 雇主確認中(DEMO.md 規格質問 #2) |

#### 2-4. ケア動画 KPI

| 規格項目 | 状態 | 実装位置 |
|---------|------|---------|
| 動画総本数 12 本(規格 v2) | ✅ | `videos.ts`、commit `b4065c1` で 15→12 本 |
| 動画尺 30/60 秒のみ(規格 v2) | ✅ | 120 秒動画を全削除 |
| 視聴回数 | ✅ | `getVideoStats()` |
| 平均完遂率(全体) | ✅ | ContentPage StatCard |
| ケア後 24h 再分析率 | ✅ | `reanalyzedWithin24h`、ContentPage 表示 |
| 動画尺別完遂率(Bar Chart) | ✅ | ContentPage「動画尺別 完遂率」、空 bucket 自動非表示 |
| カテゴリ別視聴分布 | ✅ | `getCategoryStats()` |
| **動画個別の視聴 ranking** | ✅ | ContentPage 表(視聴回数順) |

#### 2-5. 課金推移 KPI(プラン推移)

| 規格項目 | 状態 | 実装位置 |
|---------|------|---------|
| Premium 加入(M→P + G→P) | ✅ | `plan-history.ts:newPremium` |
| Premium 離脱(P→M + P→Guest) | ✅ | `plan-history.ts:lostPremium` |
| プラン構成推移(Area Chart) | ✅ | StatusPage |
| 解約率(churn rate) | ✅ | `calculateChurnRate()` |
| プラン変更ログ(降順 + Badge) | ✅ | StatusPage 表 |
| **G→M(無料登録)追跡** | ⚠️ | 部分実装(`classifyChange()` で `reactivate` 扱い、独立 KPI 無し)。規格質問 #5(DEMO.md)で雇主確認中 |

### 3. 管理画面 UI 構成

| 規格項目 | 状態 | 実装位置 |
|---------|------|---------|
| 3-1. 警告色(主観 vs AI 落差) | ✅ | `bg-red-50` 行底色 + `AlertTriangle` icon + `text-destructive` 文字 |
| 3-1. 警告適用範囲 | ✅ | UserDetailPage 全行動履歴 + UsersPage 一覧、Premium のみ |
| 3-2. 文言管理機能 | 🅿️ | **規格 v2 で廃止、雇主指示で削除** |
| 3-3. 三套画面の差異(filter / 権限) | ✅ | URL query、`type` を全画面で参照 |
| 3-3. BtoB の個人情報非開示 | ✅ | UsersPage / UserDetailPage で `type=b2b` → `<Navigate to="/dashboard" />` |

### 4. 実装要件

| 規格項目 | 状態 | 実装位置 |
|---------|------|---------|
| 4-1. マルチテナント(company_id) | ✅ | URL query + filter helper(`getUsersByCompany` 等) |
| 4-2. FE のみ実装(API 後付) | ✅ | mock-data 体制 + `docs/API_CONTRACT.md` 引き継ぎ書 |
| 4-3. 文言管理 | 🅿️ | **取消** |
| 4-4. 将来の本番接続 | ✅ | `API_CONTRACT.md` で 12 endpoint 提案済み(JWT、permission matrix 含む) |
| 4-x. 個人情報保護(BtoB) | ✅ | 集計データのみ、Alert で明示 |

---

## v2 仕様書による管理画面への影響

### 影響大 — ✅ 実装完了

これらは `b4065c1` で本日反映済み。

| 規格 v2 項目 | 影響範囲 | 状態 |
|--------------|---------|------|
| 動画構成変更(18 本 10s/30s/60s → 12 本 30s/60s) | `mock-data/videos.ts`、ContentPage Bar Chart | ✅ 12 本に削減、30/60s のみ。Bar Chart は空 bucket 非表示の既存ロジックで自動 2 bucket 化 |
| 疲労度表示の Premium 限定 | `types.ts` の optional 化、UserDetailPage、警告色判定 | ✅ Guest / Member は疲労関連を非表示。コンディション推移は表情 1 line のみ |
| Guest 動画閲覧不可 | `mock-data/users.ts` activityLog 生成、`mock-data/videos.ts` 視聴 mock | ✅ Guest の `careVideoTitle` / 視聴記録 0 件 |
| Member 動画制限(30 秒・月 10 回) | 同上 | ✅ Member の `carePool` は 30s のみ、視聴件数 5-10 件 |

#### ✅ 残存 mismatch 解消済

| 該当箇所 | 内容 | 修正 |
|---------|------|------|
| `src/pages/ContentPage.tsx:92` | StatCard description が `"5 カテゴリ × 3 尺(30/60/120秒)"` のまま | ✅ `"5 カテゴリ × 2 尺(30/60秒)"` に修正(2026-05-18) |

### 影響中 — ✅ 2026-05-18 雇主確認済 / ⚠️ 残り確認待ち

| 規格 v2 項目 | 影響範囲 | 現状 | 状態 |
|--------------|---------|------|------|
| 初回ユーザー情報(性別・生年月日) | UserDetailPage 頂部の使用者情報区 | User 型に gender / birthDate 追加待ち | ✅ **雇主確認実施**(細節は設計師決定)。BtoB では非表示、未入力は「未登録」表示。TODO.md A 参照 |
| Premium CTA 効果分析 | ContentPage、Day 7 / ケア後 / Day 30 の点击率 + 升級転換率 | 0 実装 | ✅ **雇主確認実施**(細節は設計師決定)。運営/OEM のみ表示、BtoB 非表示。TODO.md B 参照 |
| 価格変更(¥980 → ¥780) | ステータス画面など | **管理画面に価格表示は一切無し**(grep 結果 0 件) | ⚠️ 表示しないことで合意か?将来「課金額シミュレーション」のような機能を追加する場合は反映必要 |
| G→M 純増(無料登録ファネル) | プラン推移 KPI | **部分実装**:`classifyChange()` で G→M は `reactivate` 扱い、独立 KPI 無し | ⚠️ 規格質問 #5(DEMO.md)で確認中。独立 KPI が必要か |
| 全体コンディションスコアの定義 | B2BDashboard | AI 疲労 5 段階の Premium 限定算術平均 | ⚠️ 規格質問 #2(DEMO.md)で確認中。複合スコアにするか? |

### 影響なし — 管理画面に直接関係しない v2 変更

| 規格 v2 項目 | 理由 |
|--------------|------|
| 認証方式変更(マジックリンク + SNS) | エンドユーザー側、管理画面は別認証 |
| アンケート順序変更 | エンドユーザーのフロー、管理画面 UI には影響なし |
| マイページぼかし | エンドユーザー側 UI |
| ケア動画プレイヤー UI | エンドユーザー側 UI |

---

## 取消された項目 🅿️

### 文言管理機能(規格 v1 の 3-2 / 4-3)

- v2 仕様書にも「廃止の方針」と明記
- 雇主からも直接「取消」指示
- UI から削除済み(/settings ページは現在 Placeholder のみ)
- mock-data からも該当データなし

**コード確認**:`grep "文言"` 結果 0 件。

### 関連の派生取消

| 関連項目 | 状態 |
|---------|------|
| `/settings` 文言編集画面 | `SettingsPage.tsx` は `<Placeholder title="設定" />`、文言関連は実装せず |

---

## 今後の作業優先順位(雇主確認後)

### 【最優先】会議で確認 → 即修正

1. **全体コンディションスコアの定義**(DEMO.md 質問 #2)
   - 算術平均で OK → 現状維持
   - 複合スコア → `B2BDashboard.tsx:66-75` を書き直し
   - 不要 → KPI 削除して別指標に差し替え

2. **ContentPage.tsx:92** description テキスト修正(規格表記との不一致、コード変更だが微修正)

### 【週末までに確認】

3. 初回ユーザー情報(性別・年代等)を管理画面に必要か(v1.0/v2.0)
4. Premium CTA 関連 KPI が必要か
5. G→M 純増の追跡が必要か(DEMO.md #5)

### 【完成済 ✅】

- 3 套画面の構造と権限制御
- 警告色、視点切替、個人情報保護
- mock-data 30 ユーザー / 12 動画 / 30 日分析履歴 / プラン変更ログ
- プラン別の分析・動画閲覧仕様(`b4065c1`)
- 引き継ぎ書(`docs/API_CONTRACT.md`)
- 会議資料(`DEMO.md`、`MEETING.md`、`QUESTIONS_FOR_MEETING.md`)

---

## 集計

各章節内の対照表エントリ(行)を集計したもの。同一項目が複数章節に出る場合は重複カウント。

| 凡例 | 件数 | 内訳 |
|------|------|------|
| ✅ 実装済 | 55 | b4065c1 までの実装分 + 2026-05-18 雇主確認 2 件 + ContentPage.tsx:92 description 修正 |
| ⚠️ 確認待ち | 3(distinct topic) | (a) 全体コンディションスコア定義 (b) G→M 独立 KPI (c) 価格表示 |
| ❌ Mismatch | 0 | 2026-05-18 全解消 |
| 🅿️ 取消 | 2 | 文言管理 3-2 と 4-3(実体は同一機能) |
