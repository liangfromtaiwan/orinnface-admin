# OrinnFACE 管理画面 — 實作指引

> 正本規格:**orinnFACE 管理画面仕様書 v1.0**(2026-08-18 發行 / FitWayWorld株式会社 / 前版 v0.9.3)
> 本檔是給 Claude Code 的實作指引,**規格判斷一律以 v1.0 正本為準**。
> 正本 PDF: `docs/spec/orinnFACE_管理画面仕様書_v1.0.pdf` / 文字抽出版(grep 用): `docs/ADMIN_SPEC_v1.0.md`

## 🔴 每個任務開始前必做

1. □ 這個任務屬於哪個畫面群?(ダッシュボード / 会社・店舗 / 顧客 / 分析 / care動画 / 推奨設定 / 画像・保持 / 監査)
2. □ 涉及哪些 role?scope 判定寫了嗎?(**不能只靠前端隱藏**)
3. □ 用到的數值是不是「使用者畫面同一個 metric_code」?有沒有偷造管理畫面專用分數?
4. □ 有沒有踩到「禁止用語 / 禁止表現」清單?
5. □ 需要的 shadcn 元件裝了嗎?(`.claude/components-installed.md`)

沒回答完不要開始寫 code。

---

## 0. 正本境界(不要自己發明)

| 領域 | 正本 | 本 repo 的立場 |
|---|---|---|
| 管理画面の画面・操作 | **管理画面仕様書 v1.0** | 實作・驗收正本 |
| DB 物理構造 | DB設計書 v1.9 | 不自行新增列名 |
| API 名稱・schema | API設計書 v1.3 | 畫面操作對應到 API |
| Backend・IAM・job | インフラ/Backend v1.7 | 認證、監査、保持 job 正本 |
| AI 分析値 | AI分析 v1.6 | 管理畫面不另造分數 |
| 正式推奨・care | AI推奨 v1.2 | 用 Backend 推奨 + 固定13枠 |
| 使用者 UI | Figma `4NiQEpytzfygBpGhhpcXDa` **node-id=13-2 / 99-2 只有這兩個** | `node-id=0-1` 是測試用,**完全排除** |

**變更管理**:確定值不可默默覆寫。基準値・推奨方針・care 公開一律 `draft → 承認 → 有効化` 發版,**過去 snapshot 不可修改**。

## 1. 系統構成

| Project | 角色 |
|---|---|
| orinnface-frontend | B2C / 顧客向け画面 |
| orinnface-backend | 一般 API、分析編排、權限、正式推奨 |
| **orinnface-admin-frontend** | **← 本 repo**。本部・契約企業管理者・店舗管理者・店舗スタッフ向け |
| orinnface-admin-backend | 管理 API、監査、集計、care 差し替え、基準値運用 |
| orinnface-ai | 影像→分析值的內部服務。不碰顧客資訊/動画/權限 |

- 管理畫面與一般使用者畫面**分開部署**。DB 的 identity / analytics 邏輯分離。
- 管理畫面**不可直連 AI**,一律走 管理API / Backend。
- 畫面顯示統一用「**店舗**」。內部 code 的 `partner` 不可出現在使用者可見文字。

## 2. Role・權限

| role_code | 顯示 | 範圍 | 2FA |
|---|---|---|---|
| `operator` | 本部 | 全会社・全店舗橫斷。高風險操作與監査 | **必須** |
| `company_admin` | 契約企業管理者 | 所屬企業與其配下全店舗 | **必須** |
| `store_admin` | 店舗管理者 | 被授予 store_membership 的一或多個店舗 | **必須** |
| `store_staff` | 店舗スタッフ | 所屬店舗 + active 連携的顧客 | 任意 / 初期 OFF |
| `customer` | 顧客 | 只有本人資料。**不是管理畫面使用者** | 任意 / 初期 OFF |

- role **不可直寫進 accounts 單一欄位**,用 `organization_memberships` / `store_memberships` 帶 scope 管理。
- 單店舗契約也要在內部建 company + store。之後改成多店舗橫斷時,只加 `company_admin`,**不重建** account / 顧客 / 分析履歴 / 同意 / 保存期限。
- 只管部分店舗的人 → 給多個 `store_admin` membership。**不新增固定的エリア管理者 role**。
- **前端隱藏不算權限控制**。每次 API query 都要驗 membership + store_data_link + 對象 scope。
- 即使是 `operator`,生画像也**不在一般列表顯示**。要另開「理由輸入 + 監査 + 5分 token」的操作。

## 3. 店舗連携與資料範圍

| 項目 | V1 規則 | V2 以後 |
|---|---|---|
| 有効店舗 | 每位登録顧客 **active 最多 1 店舗** | 允許多店舗 active |
| 来店履歴 | 累積在 `store_visits`。**與閲覧權限分離** | 同 |
| 閲覧權限 | active `store_data_link` **且** スタッフ membership,兩者都要 | 每個 link 各自同樣判定 |
| 連携解除 | 店舗即時不可閲覧。本人的分析・care 履歴保留 | 同 |
| 保存期限 | 連携・解除・閲覧**都不更新期限** | 同 |

> 🔴 **B2B 沒有 Guest 方案**。登録前叫「**未登録顧客の仮データ**」或「**未連携分析**」,不可與 B2C Guest 混用。

## 4. 畫面構成(operator 完整版)

| 選單 | 主要內容 |
|---|---|
| ダッシュボード | 全社 KPI、期間/会社/店舗 filter、**母数・欠測必顯示** |
| 会社・店舗 | 契約狀態、店舗、membership、利用狀況。V1 契約建立是手動運用 |
| 顧客 | 權限範圍內顧客、active 店舗、分析履歴、care 実施、保持狀態 |
| 分析 | 與使用者側同樣的 neutral / 5動作 / 姿勢指標、品質、version、推移 |
| care動画 | 固定13枠、asset、差し替え申請、承認、公開、rollback |
| 推奨設定 | 基準値 set、policy、preview、承認、有効化、rollback |
| 画像・保持 | 理由付き一時閲覧、期限、通知、削除 state、失敗重試 |
| 監査 | 權限變更、画像閲覧、export、care 差し替え、基準値變更、削除 |

- `company_admin`:企業內全店舗橫斷 KPI/顧客/スタッフ/分析/care。可提差し替え申請,**不可新設 slot・pose・video_code**。本部承認前的 asset 不可公開。生画像顯示標準 OFF。
- `store_admin`:同上但限自己 membership 的店舗;**不可自動擴權到整個企業**。
- `store_staff`:只搜尋/檢視所屬店舗的 active 連携顧客。做 B2B 撮影、確認本人同意、分析実行、結果表示、staff note、handoff link 發行。
  - 🔴 **「スタッフ代替顧客勾選必須同意」不可做成標準流程。**

## 5. 顧客・分析結果

### 顧客一覧欄位
顧客識別(最小必要,**analytics 不得混入 PII**)/ active 店舗與連携狀態 / 最新分析(`completed_at`、face・posture、品質、有無結果)/ 継続(初回・前回・最新適格分析日時、分析回數、離脱風險)/ care(推奨表示、再生開始、完了、直近実施、月次回數)/ 保持(retention policy、期限、通知・削除 state — 僅有權限者)

### 分析詳細
| 領域 | 值 | 注意 |
|---|---|---|
| neutral | 無表情 **6 指標**、同年代比較、`average_version` | **不可與 5動作可動域混在一起** |
| 5動作 | `smile` / `pucker` / `jaw_open` / `eye_open` / `brow_furrow` 的可動域、左右差・偏位、代償・過緊張 | metric 定義與使用者側相同 |
| 姿勢 | **B2B 限定**。正面 4、側面 4。左右側面結果分開顯示 | B2C 不出。V1 使用者畫面是左側面 |
| 比較 | 同分析種別的初回比・前回比・任意 2 件比較,含當時值 | 是 Backend/Frontend 責任,**不是 AI** |
| 推奨 | `rank`, `pose`, `score`, `baseline`, `deviation`, `video_code`, `version` | **只用 Backend 正式 run** |
| 技術情報 | 契約・前處理・model・計算・閾値・平均・推奨・catalog version | 放詳細 drawer |

> 🔴 **同一指標原則**:使用者側顯示的分數與管理畫面的個人結果,必須是**同一個 `metric_code`、同一個值**。不可做「管理畫面專用的同名別分數」。

- **「初回」定義**:同一人・同一分析種別的第一筆有效 completed 分析。含 Guest 移行 / B2B handoff。**不含**登録日、Premium 開始日、契約日、初回来店、failed/cancelled/invalid、以及沒有新撮影的再解析。**顔與姿勢分開算**。
- 2 時點比較:**左 = 舊、右 = 新**。同 `analysis_type` / `metric_code` 全項目,維持當時 version。画像刪除後數值履歴仍保留,version 不相容要警告。
- 本人畫面權限:Guest = 無履歴 / Member = 一覧・單筆詳細 / Premium = 初回・前回・任意 2 件比較。**管理畫面的可視性不看 plan**,看 operator / 店舗 scope 與監査要件。

## 6. KPI 正式定義

| KPI | 定義 | 顯示條件 |
|---|---|---|
| 月間アクティブユーザー | JST 月內有 ≥1 次 completed 分析的唯一 `data_subject` 數 | B2B 課金根據。去重 |
| 総分析回数 | 期間內 completed `analysis_session` 數 | 排除失敗・取消 |
| 継続分析ユーザー | 期末前適格分析 ≥2 次的唯一 subject 數 | **併記母数** |
| 離脱リスク | 最終適格分析起 ≥14 天且 account/link 仍 active | 天數可運用設定 |
| 改善率 | 可比較者中,依 `metric_direction` 最新值優於基準時點的人數 ÷ 可比較者數 ×100 | **必顯示指標・比較基準・母数・欠測** |
| care実施率 | `care_play_completed` 人數 ÷ 推奨表示人數 ×100 | 期間/slot/asset/scope 別 |
| care完了率 | 完了 playback 數 ÷ 開始 playback 數 ×100 | 重連視為同一 playback,去重 |

- 每個 metric 要帶「評価方向」:可動域=越高越好、左右差/偏位=絕對值越接近 0 越好,寫在 metadata。
- 基準時點由畫面 filter 選:「本人同一分析種別的初回適格分析」或「直前分析」。
- 平均値・中央値・改善率一律顯示母数・期間・對象條件・欠測數・使用 version。**少數母数不可隱藏**。

## 7. care 動画(固定 13 枠)

使用者向け功能名維持「**顔トレ**」;內部總稱 **care video / 顔ケア動画**。V1 只實作這 13 枠:

| 區分 | video_code | 對象 | 權限 |
|---|---|---|---|
| 案内 | `care_orientation` | — | 表示面依 Figma/動画仕様 |
| 1分 | `care_1m_smile` | いー | Member / Premium |
| 1分 | `care_1m_pucker` | うー | Member / Premium |
| 1分 | `care_1m_jaw_open` | あー | Member / Premium |
| 1分 | `care_1m_eye_open` | 目 | Member / Premium |
| 1分 | `care_1m_brow_furrow` | 眉間 | Member / Premium |
| 3分 | `care_3m_smile` | いー | Premium |
| 3分 | `care_3m_pucker` | うー | Premium |
| 3分 | `care_3m_jaw_open` | あー | Premium |
| 3分 | `care_3m_eye_open` | 目 | Premium |
| 3分 | `care_3m_brow_furrow` | 眉間 | Premium |
| 専門 | `lymph_care` | リンパ | Premium |
| 専門 | `nerve_approach` | 神経 | Premium |

**差し替えフロー**:本部 default asset(每個 video_code 可解析出 1 件)→ 企業/店舗申請既存枠差し替え → 本部確認提供者・內容・權利・承認狀態・公開期間・對象 scope 後 approve → 生效時間**只切換 `care_asset_id`**(`video_code` / `pose_code` 不變)→ 全程留履歴(原 asset、差替 asset、申請者、承認者、理由、起訖、取消、catalog version)。

**會員權限**:
- Guest:推奨 2 件**以 lock 呈現 + 登録 CTA**(不是隱藏),不可播放
- Member:選定 2 動作的 1 分 care,**JST 曆月 10 回**
- Premium:1分・3分・リンパ・神経,商品上無月間上限

> 🚫 **禁止**:`training_videos`、`facial_training`、`is_starter`、`release` 不可作為 V1 新實作名稱。不可加「はじめて向け」枠或第 14 個 slot。

## 8. 推奨基準値・方針管理

- **正式推奨只由 Backend 產生**。AI `/v1/recommend` 的值不可用於正式畫面或保存。
- `recommendation_baseline_version`(5動作基準値 set)與 `recommendation_policy_version`(順位・tie-break・欠損・fallback 方針)**分離**。
- 畫面提供:draft 建立 / 差分 / 影響 preview / approve / activate / scheduled activate / rollback。
- **禁止直接更新 active 值**;**不可重算或覆寫過去的 `recommendation_run`**。
- `average_version`(同年代平均)、AI `threshold_version`、推奨基準 version **是三個不同的東西**。
- 只有 `operator` 可 draft/承認/有効化/rollback(rollback 以新 version 執行,建議作成者與承認者分離)。其他 role 只能看自己 scope 的結果根據。

## 9. B2B 未連携分析

1. スタッフ 開始未登録顧客的 session
2. 顧客本人同意撮影・保存 → consent event 綁 `anonymous_id`
3. 無顧客 ID 撮影・分析,存為**未連携分析**。`data_subject_id` / `operator_user_id` / `salon_id` 分離
4. 以 QR / URL 交付**同一個 handoff token,有效 1 日**
5. 顧客用 Google 或 Email **走一般註冊**,token 消費 1 次綁定仮データ。**不做 B2B 專用輕量註冊**
6. 綁定時重算 `retention_state`。起算是「**對象的最終適格分析完了日**」,不是登録日

| 期限 | 值 | 連動 |
|---|---|---|
| handoff QR / URL | 發行起 **1 日** | 失效**不刪除画像** |
| 未連携的生画像 | 分析完了起 **180 日** | 180 日內綁定 → 轉入登録 2 年規則 |

## 10. 同意・画像保持・削除

| 主體 | 生画像期限 | 更新條件 |
|---|---|---|
| 登録ユーザー(B2C/B2B) | 最終適格分析完了日起 **2 年** | 有新撮影的分析 completed → **過去全画像同步更新為同一期限** |
| B2C Guest | 分析完了起 **180 日** | 一般註冊 + 明示引繼 → 轉登録規則 |
| B2B 未連携分析 | 分析完了起 **180 日** | 一般註冊 + handoff claim → 轉登録規則 |
| 將來的長期保存 | 撤回或退会為止 | 獨立的 `long_term_retention` 同意。**V1 UI 不顯示** |

- 全使用者初次撮影前必須同意 raw image capture / storage。**未同意不可開始撮影・分析**。
- 登入、預約、來店、店舗連携、カルテ閲覧、過去画像再解析、再スコアリング、施術記録 **都不更新期限**。
- 登録使用者於**期滿 30 日前通知**。期滿後停用署名 URL → queue → 刪除全 generation → 確認不存在 → 監査完了。
- 退会時刪除生画像;特徴量以 `anonymous_id` **在切斷與帳號直接連結的狀態下保存**。
- 長期保存同意 與 研究/AI品質改善同意 是**獨立兩軸**。研究同意初期 OFF、V1 畫面不顯示、不可作為服務條件。

> 🚫 **禁止表現**:不可寫「全データ削除」「完全削除」「匿名化」「個人情報は含まれません」。
> 正確說法 →「**紐付けを切った状態で保管**」。

## 11. 監査・Security

| 領域 | 要求 |
|---|---|
| 生画像 | 非公開 GCS、CMEK、Public Access Prevention、`Cache-Control: private, no-store` |
| 一時閲覧 | 驗權限・所有・active link・目的・理由 → **署名 URL 300 秒** |
| 画像監査 | 閲覧者・對象 asset・理由・日時・request ID → `image_access_logs` |
| 變更監査 | role、export、care 差し替え、基準値、policy、削除、rollback 全部追記 |
| 秘密情報 | Secret Manager。**不可明文出現在文件・DB 列・repository・畫面** |
| production | `/debug` 非公開;admin API 必須 認證 + 2FA + rate limit + 監査 |

## 12. 管理 API 對應

| 畫面操作 | API |
|---|---|
| 顧客一覧/詳細 | `GET /admin/v1/customers`、`GET /admin/v1/customers/{data_subject_id}` |
| 分析履歴/推移 | `GET /admin/v1/customers/{data_subject_id}/analysis-sessions` |
| KPI | `GET /admin/v1/metrics/overview` |
| care 実施 | `GET /admin/v1/care-playbacks` |
| 生画像一時閲覧 | `POST /admin/v1/raw-image-assets/{raw_image_asset_id}/view-tokens` |
| 監査検索 | `GET /admin/v1/audit-events` |
| 固定枠・asset | `GET /admin/v1/care-video-slots`、`POST /admin/v1/care-video-assets` |
| 差し替え | `replacement-requests` / `approve` / `reject` |
| 推奨基準・方針 | `recommendation-baseline-sets`、`recommendation-policy-sets` 的 draft / approve / activate |

> path・method・body・error code 的正本是 **API設計書 v1.3**。
> 🚫 V1 **沒有** `POST /admin/v1/care-video-slots`。

## 13. 狀態機

| 對象 | 狀態 | 管理畫面 |
|---|---|---|
| 分析 | `draft` / `capturing` / `analyzing` / `completed` / `failed` | 顯示可否重跑、retryable、欠損 capture |
| handoff | `unlinked` / `linked` / `expired` | **1日失效與画像180日分開顯示** |
| 保持削除 | `active` / `notice_scheduled` / `expired` / `deletion_queued` / `verifying` / `deleted` / `failed` | 失敗原因・重試・監査 |
| care assignment | `draft` / `pending_approval` / `approved` / `scheduled` / `active` / `ended` / `rejected` | publish 前拒絕重複有効 |
| 基準・policy | `draft` / `approved` / `active` / `retired` | active 不可直接編輯 |

- export、画像閲覧、差し替え、基準値變更等重操作 → **確認畫面 + 理由輸入**。
- 集計 job 與畫面 query 要**冪等**,同一 event 重複不可增加次數/課金/quota。
- 故障時不可覆寫過去 run 或 asset,用 status + 監査 event 讓它可重試。

## 14. 用語統一

| ❌ 不要用 | ✅ 用 |
|---|---|
| partner / salon(使用者可見處) | **店舗** |
| B2B Guest | **未登録顧客の仮データ / 未連携分析** |
| training_videos / facial_training / is_starter / release | **care video slot / asset / assignment** |
| 顔分析 | **表情分析** |
| baseline(指畫面) | **無表情**(neutral) |
| 全データ削除 / 完全削除 / 匿名化 | **紐付けを切った状態で保管** |
| users.role | organization_memberships / store_memberships |

## 15. 技術堆疊(繼承自 orinnme-admin 骨架)

Vite + React 19 + TypeScript / Tailwind CSS v4 / shadcn/ui v3(Nova preset, Geist)/ React Router / Recharts / React Hook Form + Zod / Lucide React

> ℹ️ 本 repo 刻意保留 shadcn(與一般「不用 shadcn」的偏好不同),因為是繼承 orinnme-admin 的既有骨架。

### 設計風格
白ベース / シンプル / 模板感(MUI・AdminLTE 風)。背景 `bg-background`、`bg-muted/50`;圓角 `rounded-md`;shadow 克制;中性灰為主,強調色只用在警告與主要動作。

**管理畫面視覺是未決事項 P2**(等設計師的管理畫面 Figma),先用本書的資訊結構做暫時實作。

### 文案
UI 文字**用日文**,從規格書 copy-paste。不確定的留 `{/* TODO: 日本語確認必要 */}`。
字型:西文 Inter / 日文 Noto Sans JP。

## 16. 実装マップ(v1.0 に沿って再構築済み)

旧 orinnme-admin のドメイン層(疲労度・主観 vs AI・admin/oem/b2b 3視点・自由動画カタログ)は
**削除済み**。以下が現在の構成:

```
src/lib/domain/     ← 仕様の型と計算。ここが実装の中心
  types.ts          role/membership・会社店舗・分析・care・推奨・保持・監査の型
  metrics.ts        指標カタログ + metric_direction + isImproved()
  care-catalog.ts   固定13枠 + entitlement(Guest/Member/Premium)
  scope.ts          role→scope 解決・顧客可視判定・capability・画面出し分け
  kpi.ts            §6 の KPI 定義そのまま。戻り値は必ず母数を持つ Aggregate
  periods.ts        JST 基準の期間プリセット
src/lib/mock/seed.ts  決定的モックデータ(実 API 差し替え時はここだけ置換)
src/contexts/         SessionContext(ログイン + 実効スコープ)
src/pages/            §4 の8画面 + 顧客詳細 + アカウント + ログイン
scripts/              仕様不変条件の smoke test
```

### 実装済みの仕様ガード(壊すと落ちる)
- `AggregateStat` を通さない KPI 表示は書かない → 母数・欠測・version・期間が必ず出る
- `scope.ts` の `canViewCustomer()` は active な `store_data_link` + membership の両方を要求
- `care-catalog.ts` は 13 枠固定。`assertCareSlotInvariant()` が `npm run smoke` で検証
- 生画像は `RawImagePlaceholder` / `RawImageViewButton` 経由のみ(理由入力 + 300秒 token)

### 検証コマンド
```bash
npm run check         # build + lint + smoke + smoke:render をまとめて実行
npm run smoke         # スコープ判定・entitlement・KPI 母数などの不変条件
npm run smoke:render  # 全ページを SSR して実行時エラーを検出
```

`npm run lint` は継承した shadcn の `ui/*` と `hooks/use-mobile.ts` で 5 件のエラーが出る。
これは複製時点から存在するもので、v1.0 対応で増やしたものではない。

### 未実装(意図的)
実 API 接続(`src/lib/api/` は未作成。現在は `src/lib/mock/seed.ts` を直接参照)、実認証と 2FA、
差し替え申請・承認の永続化(現在は toast のみ)、CSV export、管理画面のビジュアル(§16 P2)。

## 17. 未決事項(動工前確認)

| 優先 | 未決 | 可先做 |
|---|---|---|
| P0 | 画像期滿後的刪除保證上限 / 同意撤回時的刪除期限(現推薦:期滿後 30 日內) | 內部 state / queue |
| P0 | 初期推奨基準値・policy version | 畫面・table(**不可 active 化**) |
| P0 | 既存動画的 13 枠 mapping 與權利確認 | slot seed |
| P1 | `care_orientation` 的表示面與權限 | 保留 slot |
| P1 | 改善率的初期 `metric_direction` 一覧 | raw 差分・母数集計 |
| P1 | partner 側生画像閲覧將來是否開放 | V1 標準 OFF |
| P2 | 管理畫面視覺 | 用本書資訊結構暫時實作 |

## 17.5 吉田さんへの確認事項

規格 v1.0 では判断できなかった項目は **`docs/QUESTIONS_FOR_YOSHIDA.md`** に集約。
新しく「規格に書かれていない」ことに気づいたら、勝手に決めずここに追記する。

現在の未確認(2026-09-04 時点):
1. 🔴 分析の「品質」の定義(等級・閾値・適格分析から除外するか) ← **KPI の母数に影響**
2. 🟡 「欠損 capture」の扱い(§13。未実装)
3. 🔴 改善率の `metric_direction` 一覧(§16 P1)
4. 🟡 `care_orientation` の表示面・権限(§16 P1)
5. 🟡 care実施率を asset 別に見るときの母数
6. 🟡 連携解除後の姿勢分析を本部は見られるべきか
7. 🟡 会社・店舗の「適格分析」を種別で分けるか
8. 🔴 既存 Premium 会員が店舗連携したときの課金(二重課金の有無・care 権限) ← **請求金額に影響**
9. 🟡 離脱リスクの 14 日を画面から設定できるようにするか(§6「日数は運用設定」)

暫定実装には `provisional` フラグや ⓘ の注意書きを必ず添え、
**確定していない値が確定値として読まれないようにする**。

## 18. 規範引用

- shadcn MCP 使用 → @.claude/mcp-usage.md
- shadcn 元件守則 → @.claude/shadcn-usage.md
- 設計 token → @.claude/design-tokens.md
- 已裝元件清單 → @.claude/components-installed.md
- 列表頁範本 → @.claude/patterns/data-table.md
- 表單頁範本 → @.claude/patterns/form-page.md
- 設定頁範本 → @.claude/patterns/settings-page.md
