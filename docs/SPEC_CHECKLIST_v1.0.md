# 管理画面仕様書 v1.0 ⇄ 実装 対照チェックリスト

> 用途: 仕様書 v1.0 を上から読みながら、**必要な機能が実装されているか人の目で突き合わせる**ための表。
> 作成: 2026-09-13 / 梁 ・ 対象 commit: `eb64dfe`（+ membership 付与・剥奪の実装を反映）
> 正本は `docs/spec/orinnFACE_管理画面仕様書_v1.0.pdf`。本表は全文抽出版 `docs/ADMIN_SPEC_v1.0.md` の節番号に合わせてある。

## 使い方

- **「要求」列は仕様書の記述**（日本語）、**「メモ」列は私の判断・補足**（中国語）。どちらの言葉かで出所が分かるようにしてある。
- 左端の `☐` を潰しながら見る。`☐` を `☑` に書き換えれば差分が git に残る。
- 判定は実装を読んで付けた現時点の見立てなので、**最終判断は画面を触って確定**してください。

| 判定 | 意味 |
|---|---|
| ✅ | 実装済み。画面で確認できる |
| ⚠️ | 部分的。表示だけ / toast だけ / 暫定値で埋めている |
| ❌ | 未実装 |
| ➖ | このリポジトリの対象外（バックエンド担当、または V2 送り） |

**前提**: この repo は**フロントエンドのみ**（使用者確定 2026-08-30）。実 API・実認証・2FA・集計 job・保持 job はキンさん側。
データは `src/lib/mock/seed.ts` の決定的モックで、モック層を「バックエンドが実装すべき形」として保つ方針。

---

## §2 ロール・認証・権限

| ☐ | 要求（仕様書） | 実装 | 判定 | メモ |
|---|---|---|---|---|
| ☐ | role は operator / company_admin / store_admin / store_staff / customer の5種 | `types.ts` `RoleCode` | ✅ | customer は管理画面利用者ではないので画面には出ない |
| ☐ | role を accounts の単一列へ直書きせず、organization_memberships / store_memberships で scope 付き管理 | `types.ts` `OrganizationMembership` / `StoreMembership`、`scope.ts` `resolveScope()` | ✅ | |
| ☐ | 単店舗契約でも内部的に company と store を作成する | `seed.ts` | ✅ | 单店铺公司也建了 store，可在「会社・店舗」页确认 |
| ☐ | 一部の複数店舗だけを管理する担当者は store_admin membership を複数付与。エリア管理者 role を追加しない | `scope.ts` | ✅ | |
| ☐ | Frontend の表示非表示だけを権限制御にしない | `RequireScreen.tsx` 冒頭コメント、`scope.ts` | ⚠️ | 前端已注明「这不是权限依据」，但**实际的 API 再验证是后端工作**，此处只能到注释为止 |
| ☐ | operator でも生画像は通常一覧へ表示しない。理由入力と監査付き 5分 token を別操作で発行 | `RawImageAccess.tsx` / `RawImageViewer.tsx`、`decideRawImageView()` | ✅ | 300 秒倒计时 + 理由输入已实作。⚠️ 吉田 2026-09-07：**店舗の自店画像閲覧は理由入力なし**（direct）、本部の横断閲覧のみ理由必須 |
| ☐ | 2FA: operator / company_admin / store_admin 必須、store_staff 任意・初期 OFF | `ROLE_REQUIRES_2FA`、`AccountPage.tsx`、`nav-user.tsx` | ⚠️ | 只做到「必須なのに未設定」的警告显示。**実認証・2FA 本体は未実装（意図的）** |

---

## §3 店舗連携とデータ範囲

| ☐ | 要求（仕様書） | 実装 | 判定 | メモ |
|---|---|---|---|---|
| ☐ | 有効店舗は登録顧客1人につき active 最大1店舗 | `seed.ts`、`smoke.ts`「每人 active link <= 1」 | ✅ | smoke 有守 |
| ☐ | 来店履歴は store_visits へ累積。閲覧権限とは分離 | `types.ts` `StoreVisit`、`smoke.ts`「来店履歴だけでは閲覧不可」 | ✅ | |
| ☐ | 閲覧権限は active store_data_link **＋** スタッフ membership の両方が必要 | `scope.ts` `canViewCustomer()` | ✅ | smoke 有守 |
| ☐ | 連携解除で店舗から即時閲覧不可。本人の分析・care 履歴は保持 | `smoke.ts`「解除済み顧客は…閲覧できない」 | ✅ | 解除后姿势分析也不出（B2C 表示形式） |
| ☐ | 保存期限は連携・解除・閲覧では更新しない | `CustomerDetailPage.tsx:493` の注記 | ⚠️ | 画面上有明示文案，但**期限の再計算ロジック自体はバックエンド**。前端只是不去动它 |
| ☐ | B2B に Guest プランは存在しない。「未登録顧客の仮データ」「未連携分析」と呼ぶ | `seed.ts` `unregistered`、各画面の文言 | ✅ | 用語は「未連携分析」で統一済み |
| ☐ | 再連携には再同意が必要（吉田 2026-09-07 追加） | `StoreDataLink.consentedAt`、`smoke.ts` 同意系4件 | ✅ | 仕様書 v1.0 には無い項目。吉田確定分 |

---

## §4 画面構成

### 4.1 本部（operator）— 8メニュー

| ☐ | メニュー | 仕様の「主な内容」 | ルート | 判定 |
|---|---|---|---|---|
| ☐ | ダッシュボード | 全社 KPI、期間・会社・店舗 filter、母数・欠測表示 | `/dashboard` | ✅ |
| ☐ | 会社・店舗 | 契約状態、店舗、membership、利用状況 | `/organizations` | ✅ |
| ☐ | 顧客 | 権限範囲の顧客、active 店舗、分析履歴、care 実施、保持状態 | `/customers` | ✅ |
| ☐ | 分析 | ユーザー側と同じ neutral / 5動作 / 姿勢指標、品質、version、**推移** | `/analysis` | ⚠️ |
| ☐ | care動画 | 固定13枠、asset、差し替え申請、承認、公開、rollback | `/care` | ⚠️ |
| ☐ | 推奨設定 | 基準値 set、policy、preview、承認、有効化、rollback | `/recommendation` | ⚠️ |
| ☐ | 画像・保持 | 理由付き一時閲覧、期限、通知、削除 state、失敗再試行 | `/retention` | ✅ |
| ☐ | 監査 | 権限変更、画像閲覧、export、care 差し替え、基準値変更、削除 | `/audit` | ✅ |

- **会社・店舗 ✅**: 2026-09-13 に membership の付与・剥奪を実装。契約企業管理者の「未設定」から直接指名でき、店舗の担当者セルから店舗管理者・店舗スタッフを付け外しできる。理由入力必須で監査に `role_change` が残る。
- **分析 ⚠️**: session 一覧（種別・状態・適格・品質・model）はあるが、**この画面に「推移」が無い**。推移は顧客詳細の比較タブ側にある。仕様の読み方次第では別実装が要る。
- **care動画 ⚠️ / 推奨設定 ⚠️**: 承認・rollback などの操作は **toast を出すだけで永続化していない**（後述 §7 / §8）。

### 4.2–4.4 role 別

| ☐ | 要求（仕様書） | 判定 | メモ |
|---|---|---|---|
| ☐ | company_admin: 全体／店舗別の KPI、顧客、スタッフ、分析履歴、care 実施 | ✅ | 视点切换（OrganizationSwitcher）已可只看自己公司 |
| ☐ | company_admin: 配下店舗の一覧、**店舗間比較** | ⚠️ | 「会社・店舗」有各店的连携顾客数・适格分析数，可横向看；但没有专门的比较视图 |
| ☐ | company_admin / store_admin: **スタッフ membership の管理** | ✅ | `MembershipDialog`。company_admin 可動配下店舗；store_admin 因 §4.3 寫的是「確認する」所以只能看（→ QUESTIONS #14） |
| ☐ | company_admin / store_admin: 差し替え申請はできるが slot・pose・video_code の新設は不可 | ✅ | `scope.ts` `care.request_replacement` / `care.approve` 分离，smoke 有守 |
| ☐ | company_admin / store_admin: 本部承認前の asset を公開できない | ✅ | 状態遷移で表現済み |
| ☐ | store_admin: 所属企業全体へ権限を自動拡張しない | ✅ | smoke 有守 |
| ☐ | **store_staff: B2B 撮影・分析実行** | ❌ | 管理画面にスタッフ用の撮影／分析実行フローが無い |
| ☐ | **store_staff: 顧客本人同意の確認** | ⚠️ | 顾客详情有「同意」卡片可看，但没有スタッフ在现场确认・记录的操作 |
| ☐ | **store_staff: staff note** | ❌ | 未実装 |
| ☐ | **store_staff: handoff link 発行** | ❌ | `/retention` に handoff の**一覧**はあるが、発行操作が無い |
| ☐ | 顧客本人の代わりに必須同意をチェックする操作を標準フローにしない | ✅ | そもそも代行 UI を作っていない |

---

## §5 顧客・分析結果

### 5.1 顧客一覧（`/customers`）

| ☐ | 表示項目 | 実装 | 判定 |
|---|---|---|---|
| ☐ | 顧客識別（必要最小限。analytics へ PII を混入しない） | 名前 / ID / メール列 | ✅ |
| ☐ | 店舗（active 店舗と連携状態） | 店舗列 | ✅ |
| ☐ | 最新分析（completed_at、face／posture、品質、結果有無） | 最新分析列 | ✅ |
| ☐ | 継続（初回・前回・最新の適格分析日時、分析回数、離脱リスク） | 適格分析列 + 離脱リスクバッジ | ⚠️ |
| ☐ | care（推奨表示、再生開始、完了、直近実施、月次回数） | care 列（上下2段） | ✅ |
| ☐ | 保持（retention policy、期限、通知／削除 state。権限のある者だけ） | 保持列 | ✅ |

- **継続 ⚠️**: 一览显示的是「适格分析回数」+ 离脱风险 badge。**初回・前回・最新の3つの日時は一覧に出ていない**（顾客详情才有）。要不要补进一览是判断题。

### 5.2 顧客詳細・分析詳細（`/customers/:id`）

| ☐ | 要求（仕様書） | 実装 | 判定 | メモ |
|---|---|---|---|---|
| ☐ | neutral 無表情6指標、同年代比較、average_version。5動作と混ぜない | 「無表情」カード + 同年代比較テーブル | ✅ | smoke 有守（6 指標・average_version 一致・5動作混入なし） |
| ☐ | 5動作の可動域、左右差・偏位、代償・過緊張。ユーザー側と同じ metric 定義 | 分析詳細カード | ✅ | `metrics.ts` の共通 catalog を使用 |
| ☐ | 姿勢は B2B のみ。正面4・側面4。左右側面は別表示。B2C には出さない | 姿勢分析(B2B) パネル | ✅ | smoke 有守（連携なし＝姿勢を出さない） |
| ☐ | 比較: 初回比・前回比・任意2件比較。各回の画像状態と全比較可能 metric の当時値 | `ComparePanel` | ✅ | |
| ☐ | 比較は **左＝古い日、右＝新しい日** | `ComparePanel` | ✅ | |
| ☐ | version 非互換は警告する | — | ⚠️ | **要確認**: 版本不相容的警示是否真的会出现，需要造一笔跨 version 的资料试 |
| ☐ | 推奨: rank、pose、score、baseline、deviation、video_code、version。Backend 正式 run だけ | 推奨テーブル | ✅ | 列已完全对上 |
| ☐ | 技術情報: 契約・前処理・model・計算・閾値・平均・推奨・catalog version。通常は詳細 drawer | 技術情報カード | ⚠️ | 内容有，但**是常驻卡片不是 drawer**。仕様は「通常は詳細 drawer」 |
| ☐ | 同一指標原則: 管理画面専用に同名の別スコアを作らない | `metrics.ts` 単一 catalog | ✅ | |
| ☐ | 「初回」の定義（Guest 移行 / handoff 含む。登録日・契約日・Premium 開始日・初回来店・failed / cancelled / invalid・再解析は除く。顔と姿勢は別管理） | `kpi.ts` | ✅ | smoke「適格分析は再解析を除外」 |
| ☐ | 画像削除後も数値履歴を残す | 生画像カードの状態表示 | ✅ | |
| ☐ | 管理画面の閲覧可否は plan ではなく operator / 店舗 scope と監査要件で判定 | `scope.ts` | ✅ | |

---

## §6 KPI・改善・care 実施（`/dashboard`）

| ☐ | KPI | 正式定義 | 実装 | 判定 |
|---|---|---|---|---|
| ☐ | 月間アクティブユーザー | JST 月内に completed 分析1回以上の一意 data_subject。重複除外 | `monthlyActiveUsers()` | ✅ |
| ☐ | 総分析回数 | 期間内の completed session。失敗・取消を除外 | `kpi.ts` | ✅ |
| ☐ | 継続分析ユーザー | 期間末までに適格分析2回以上。母数を併記 | `AggregateStat` | ✅ |
| ☐ | 離脱リスク | 最終適格分析から14日以上かつ active。日数は運用設定 | `kpi.ts` | ⚠️ |
| ☐ | 改善率 | metric_direction に沿って改善した人数 ÷ 比較可能者数 | `kpi.ts` | ⚠️ |
| ☐ | care 実施率 | 完了人数 ÷ 推奨表示人数。期間・slot・asset・scope 別 | `kpi.ts` | ✅ |
| ☐ | care 完了率 | 完了 ÷ 開始。再接続は同一 playback | `kpi.ts` | ✅ |
| ☐ | 平均・中央値・改善率は母数・期間・条件・欠測数・version を表示。少数母数を隠さない | `AggregateStat` 経由を強制 | ✅ |
| ☐ | 期間・会社・店舗 filter | `periods.ts` + 店舗 Select + 視点切替 | ✅ |
| ☐ | B2B 課金対象ユーザー数（未連携分析を含め、claim 後は二重計上しない） | `billableActiveUsers()` | ✅ |

- **離脱リスク ⚠️**: 14 日は定数。仕様「日数は運用設定」＝画面から変えられるべきか未確認（QUESTIONS #9）。
- **改善率 ⚠️**: `metric_direction` が**暫定**（QUESTIONS #3、§16 P1 未決）。画面に「暫定」バッジ付き。

---

## §7 care 動画（`/care`）

| ☐ | 要求（仕様書） | 実装 | 判定 | メモ |
|---|---|---|---|---|
| ☐ | 固定13枠だけを実装（orientation + 1分×5 + 3分×5 + lymph + nerve） | `care-catalog.ts`、`assertCareSlotInvariant()` | ✅ | smoke「care slots = 13」 |
| ☐ | video_code が仕様どおり（`care_1m_smile` 等） | `care-catalog.ts` | ✅ | |
| ☐ | 禁止語を新規実装名にしない（training_videos / facial_training / is_starter / release） | — | ✅ | grep 不到，14 番目の slot も無い |
| ☐ | 本部デフォルト asset を各 video_code へ1件解決可能 | `resolveAssignment()`（店舗 > 会社 > 本部） | ✅ | 同じ枠に重複表示しない |
| ☐ | 契約企業・店舗は既存枠への差し替えを申請。自由な項目作成は不可 | 差し替え申請テーブル | ✅ | |
| ☐ | 本部が提供者・内容・権利・承認状態・公開期間・対象 scope を確認し approve 後に assignment を予約 | `CareRequestReviewDialog` + `decideCareRequestAction()` / `applyCareRequestAction()` | ✅ | 行クリックで開き、**今その範囲に出ている動画と並べて再生**してから承認。一覧に承認ボタンは置かない（中身を見ずに承認できてしまうため）。権利未確認は承認不可・理由必須・監査に残る。**開始日時が未来なら「公開予約」**に入り、即時なら公開して同じ枠・同じ範囲の前の公開を終了（重複有効なし）。⚠️ 状態は画面 state のみ（保存は backend） |
| ☐ | 審査できるのは本部だけ（契約企業・店舗は申請のみ・§4.2） | `decideCareRequestAction()` → `not_operator` | ✅ | 本部以外には承認・却下ボタンを**出さない**（押せないボタンを並べても誰が審査するのか伝わらない）。smoke 有守 |
| ☐ | 他社の差し替え申請が見えない | `visibleCareRequests()` | ✅ | 本部=全件 / 契約企業管理者=自社＋配下店舗 / 店舗管理者=自店＋自社の会社全体分 / 本部デフォルトは全員。⚠️ 前端の絞り込みなので、実 API では backend でも同条件を検証すること |
| ☐ | 企業・店舗に審査用の UI を出さない | `canApprove` で列と一覧を出し分け | ✅ | 企業側は「自社の差し替え申請」（申請者・権利・操作を出さず却下理由を出す）。**登録済み動画の一覧は本部のみ**（権利の棚卸しは §7.1 で本部の仕事。かつ asset に持ち主が無く他社の動画が見えるため → QUESTIONS #20）|
| ☐ | 適用範囲の表示 | `careScopeLabel()` | ✅ | 「会社全体」ではなく「◯◯社 の全店舗」「◯◯店 のみ」。本部は全社横断で見るので会社名を落とさない |
| ☐ | 有効日時で care_asset_id だけ切替。video_code / pose_code は不変 | 型で固定 | ✅ | |
| ☐ | 元 asset・差し替え asset・申請者・承認者・理由・開始終了・取消・catalog version を履歴保持 | 「差し替え履歴」テーブル（`CareVideosPage`） | ✅ | 却下・終了したものも消さずに並べる。本部が申請を経ず直接差し替えたものも同じ履歴に入る。申請理由と審査理由は別欄（`reason` / `decisionReason`）|
| ☐ | rollback（公開の取り消し） | `applyCareRequestAction(..., "cancel")` | ✅ | 履歴の行から取り消すと `ended` になり、その範囲は一段広い範囲（会社 → 本部デフォルト）へ戻る。smoke 有守。本部デフォルト自体は取消対象にせず「差し替え」で戻す |
| ☐ | 店舗提供の枠は「○○店提供」と表示 | care 動画 / 顧客詳細 | ✅ | 吉田 2026-09-07 反映済 |
| ☐ | 権限: Guest = 推奨2件を lock 表示＋登録 CTA・再生不可 / Member = 1分を月10回 / Premium = 上限なし | `careEntitlement()` | ✅ | smoke 有守 |
| ☐ | care 権限は2軸（店舗提供＝プラン不問 / 標準＝プラン判定） | `canPlaySlot()` | ✅ | 吉田 2026-09-07。仕様書 v1.0 には無い |
| ☐ | care_orientation の表示面・権限 | slot 保持のみ | ⚠️ | §16 P1 未決（QUESTIONS #4）。表示ロジック未実装は**仕様側が未確定だから** |

---

## §8 推奨基準値・方針管理（`/recommendation`）

| ☐ | 要求（仕様書） | 実装 | 判定 | メモ |
|---|---|---|---|---|
| ☐ | baseline_version（5動作の基準値 set）と policy_version（順位・tie-break・欠損・fallback）を分離 | 画面が2セクションに分離 | ✅ | |
| ☐ | draft 作成 | `createBaselineDraft()` / `createPolicyDraft()`、`BaselineDraftDialog` / `PolicyDraftDialog` | ✅ | 既存版をコピーして直す形。コピー元と同じ値では作れない |
| ☐ | 差分 | `diffBaselineSets()` / `diffPolicySets()`、`RecommendationDiff` | ✅ | 各カードに「何と比べた差分か」付きで常時表示。比較対象は `comparisonBaseFor()`（draft→active / active→直前の退役版） |
| ☐ | 影響 preview | `previewBaselineImpact()` / `previewPolicyImpact()` | ✅ | 基準値=draft で推奨を引き直し、現行 run と突き合わせた**試算**（保存しない・過去 run を書き換えない。smoke 有守）。方針は文章なので結果を計算せず「その規則が効く分析の件数」を出す |
| ☐ | approve / activate | `applyBaselineAction()` / `applyPolicyAction()` | ⚠️ | activate は実装。**approve は操作として置いていない**（使用者確定 2026-09-18。本部が 1 名なら同じ人がもう一度押すだけのため）→ §8 の操作表からの意図的な逸脱。承認済という状態は残り、**「有効化を予約」したときに入る**。誰が決めたかは `approvedBy` に記録する。理由入力必須・監査に残る。有効化で前の active は自動で retired（active は常に 1 件）|
| ☐ | scheduled activate | `SetActionButton` の `schedule` | ✅ | approved のみ。日時を入れて予約、有効化で予約は消える |
| ☐ | rollback は新 version として実行 | `applySetAction()` の `rollback` | ✅ | retired を戻さず**同じ値の新 draft** を起こす。元の retired はそのまま残り、承認からやり直す |
| ☐ | active 値の直接更新は禁止。過去 run を再計算・上書きしない | `decideSetEdit()` / `applyBaselineEdit()` | ✅ | **禁止されているのは active の更新だけ**と読み、下書き・承認済は中身を直せるようにした（使用者確定 2026-09-18。まだどの推奨にも使われていないため作り直させる理由がない）。有効・退役は画面にも関数にも編集の口を出さない。承認済を直すと**下書きに戻り予約も外れる**（承認したのはその内容なので）|
| ☐ | average_version / threshold_version / 推奨基準 version を同じ値として扱わない | `types.ts` で別フィールド | ✅ | |
| ☐ | 操作権限: draft 作成・承認・有効化・rollback は operator のみ。他 role は自 scope の結果根拠のみ閲覧 | `scope.ts` | ✅ | smoke 有守 |
| ☐ | 初期推奨基準値と policy version | — | ➖ | §16 P0 未決。**実測＋事業承認まで active 化不可**。有効化・予約の確認ダイアログに警告を出す（`p0_undecided`）が、操作自体は塞いでいない |

- **2026-09-15 実装**: draft 作成・差分・影響 preview・承認・有効化・予約・rollback を実装。
  可否判定は `decideDraftCreate()` / `decideSetAction()` の 2 関数だけが持ち、画面は role を直接見ない。
  状態で出せる操作は `availableActions()`（draft→承認 / approved→有効化・予約 / retired→rollback / active→なし）。
- **承認ボタンは置かない**（使用者確定 2026-09-18）: 下書きカードは「有効化」「有効化を予約」の 2 つ。下書きから予約すると**承認済へ進める**（下書きのまま予約を持たせると、予約時刻に「まだ決めていない版」が有効化されてしまう）。
- **作成者と承認者は分けない**（使用者確定 2026-09-18）: 本部の管理者が自分で決めてよい範囲なので、自分が作った下書きをそのまま承認できる。§8 は分離を「**推奨**」と書いているだけで必須ではないため、警告も出さない。分離する運用に変えるなら `decideSetAction()` で `createdBy === actorName` を弾く 1 行で済む。
- **推奨の計算は seed と共有**: `rankRecommendedPoses()` を seed の `recommendationRuns` も通す。
  管理画面が別計算を持つと「preview では変わると出たのに実際は変わらない」が起きるため。
- ⚠️ **永続化は無い**（backend 担当）。リロードで消える。

---

## §9 B2B 未連携分析

| ☐ | 要求（仕様書） | 実装 | 判定 | メモ |
|---|---|---|---|---|
| ☐ | スタッフが未登録顧客の session を開始する | — | ❌ | スタッフ用の操作画面が無い（§4.4 と同じ穴） |
| ☐ | 顧客本人が撮影・保存へ同意。consent event を anonymous_id へ紐付け | 型はあり | ⚠️ | 記録の**表示**はできるが、現場で取る操作が無い |
| ☐ | 顧客 ID なしで分析し、未連携分析として保存。data_subject_id / operator_user_id / salon_id を分離 | `seed.ts` `unregistered` | ✅ | |
| ☐ | 1日有効の同一 handoff token を QR／URL で渡す | `/retention` の handoff 一覧 | ⚠️ | **一覧はあるが発行操作が無い**。QR 表示も無い |
| ☐ | 顧客が通常登録し token を1回消費して仮データを紐付け。B2B 専用軽量登録を作らない | `handoffTokens` の claim 状態 | ✅ | 軽量登録は作っていない |
| ☐ | 紐付け時に retention_state を再計算。起算は登録日ではなく最終適格分析完了日 | 画面の文言 + `kpi.ts` | ✅ | |
| ☐ | handoff QR／URL は発行から1日。失効しても画像は削除しない | `/retention` の注記 | ✅ | |
| ☐ | 未連携の生画像は分析完了から180日。180日内の紐付けで登録2年規則へ移行 | `types.ts` retention policy | ✅ | |
| ☐ | **1日失効と画像180日を別表示**（§13） | handoff 表と生画像表を分離 | ✅ | |

---

## §10 同意・画像保持・削除（`/retention`）

| ☐ | 要求（仕様書） | 実装 | 判定 | メモ |
|---|---|---|---|---|
| ☐ | 登録ユーザー: 最終適格分析完了日から2年 rolling。過去全画像を同じ期限へ更新 | policy 表示 + 顧客詳細の説明 | ✅ | |
| ☐ | B2C Guest: 分析完了から180日 | policy 表示 | ✅ | |
| ☐ | B2B 未連携分析: 分析完了から180日 | policy 表示 | ✅ | |
| ☐ | 全ユーザーは初回撮影前に raw image capture／storage へ同意。未同意では撮影・分析を開始しない | 同意カード | ⚠️ | 同意の**有無は見える**が、「未同意なら撮影させない」ゲートは撮影フローが無いので未検証 |
| ☐ | ログイン・予約・来店・店舗連携・カルテ閲覧・再解析・再スコアリング・施術記録では期限を更新しない | `CustomerDetailPage.tsx:493` に明文 | ✅ | 文案已逐条列出 |
| ☐ | 満了30日前に通知 | `noticeSentAt` + 「通知済」表示 | ✅ | |
| ☐ | 期限到達後は署名 URL 停止 → queue → 全 generation 削除 → 不存在確認 → 監査完了 | 削除 state の遷移表示 | ✅ | `notice_scheduled / expired / deletion_queued / verifying / deleted / failed` |
| ☐ | 失敗時の再試行 | 再試行ボタン | ⚠️ | toast のみ（実処理は後端） |
| ☐ | 退会時は生画像を削除。特徴量は紐付けを切って anonymous_id で保持 | — | ⚠️ | **退会操作の画面が無い**。文言ルール（🚫「完全削除」等）は別途 Figma 側で対応済 |
| ☐ | 長期保存同意と研究・AI 品質改善同意は独立2軸。研究同意は初期 OFF・V1 画面非表示 | 画面に出していない | ✅ | 仕様どおり非表示が正 |
| ☐ | 画像満了後の削除保証上限・同意撤回時の削除期限 | — | ➖ | §16 P0 未決（弁護士確認待ち）。現推奨は満了後30日以内 |

---

## §11 監査・セキュリティ（`/audit`）

| ☐ | 要求（仕様書） | 実装 | 判定 | メモ |
|---|---|---|---|---|
| ☐ | 一時閲覧は権限・所有・active link・目的・理由を検証し、署名 URL 300秒 | `decideRawImageView()` + 300秒カウントダウン | ✅ | |
| ☐ | 画像監査: 閲覧者・対象 asset・理由・日時・request ID を記録 | 監査テーブルの列 | ✅ | 列が完全に一致 |
| ☐ | 変更監査: role / export / care 差し替え / 基準値 / policy / 削除 / rollback | `AUDIT_CATEGORY_LABEL` 9種 | ⚠️ | **カテゴリは揃っているが、export だけ発生源の機能が無い**（下記 §12 参照） |
| ☐ | 生画像は非公開 GCS / CMEK / PAP / Cache-Control private | — | ➖ | インフラ側（Cloud Run 構成） |
| ☐ | 秘密情報を文書・DB 行・repo・画面へ平文表示しない | — | ✅ | 画面に出していない |
| ☐ | production で /debug 非公開。admin API は認証・2FA・rate limit・監査必須 | — | ➖ | 後端・インフラ側 |

---

## §12 管理 API 対応

> **この repo はフロントエンドのみ**なので、以下は全て `src/lib/mock/seed.ts` 直参照。
> `src/lib/api/` は意図的に未作成。**チェックすべきは「モックの形が API 設計書 v1.3 と対応しているか」**。

| ☐ | 画面操作 | API（仕様書） | 判定 |
|---|---|---|---|
| ☐ | 顧客一覧／詳細 | `GET /admin/v1/customers`、`/customers/{data_subject_id}` | ➖ |
| ☐ | 分析履歴／推移 | `GET /admin/v1/customers/{id}/analysis-sessions` | ➖ |
| ☐ | KPI | `GET /admin/v1/metrics/overview` | ➖ |
| ☐ | care 実施 | `GET /admin/v1/care-playbacks` | ➖ |
| ☐ | 生画像一時閲覧 | `POST /admin/v1/raw-image-assets/{id}/view-tokens` | ➖ |
| ☐ | 監査検索 | `GET /admin/v1/audit-events` | ➖ |
| ☐ | 固定枠・asset | `GET /admin/v1/care-video-slots`、`POST /admin/v1/care-video-assets` | ➖ |
| ☐ | 差し替え | `replacement-requests` / approve / reject | ➖ |
| ☐ | 推奨基準・方針 | `recommendation-baseline-sets` / `-policy-sets` の draft・approve・activate | ➖ |
| ☐ | **V1 に `POST /admin/v1/care-video-slots` は存在しない** | — | ✅ |
| ☐ | **export（CSV 書き出し）** | 監査対象として §11 に列挙 | ❌ |

- **export ❌**: 画面に書き出し操作が一つも無い。監査カテゴリ `export` だけ先に存在している状態。
  §13「重い操作は確認画面と理由入力を設ける」の対象でもあるので、作るなら理由入力とセットで。

---

## §13 状態・エラー・運用

| ☐ | 対象 | 主要状態（仕様書） | 実装 | 判定 |
|---|---|---|---|---|
| ☐ | 分析 | draft / capturing / analyzing / completed / failed | `AnalysisPage` の状態列 | ✅ |
| ☐ | 分析 | 再実行可否・retryable を表示 | `retryable` 表示 | ✅ |
| ☐ | 分析 | **欠損 capture を表示** | — | ❌ |
| ☐ | handoff | unlinked / linked / expired。1日失効と画像180日を別表示 | `/retention` | ✅ |
| ☐ | 保持削除 | active / notice_scheduled / expired / deletion_queued / verifying / deleted / failed | `RETENTION_STATE_LABEL` | ✅ |
| ☐ | care assignment | draft / pending_approval / approved / scheduled / active / ended / rejected | `types.ts` | ✅ |
| ☐ | care assignment | **重複有効を publish 前に拒否** | `resolveAssignment()` は1件に解決する | ⚠️ |
| ☐ | 基準・policy | draft / approved / active / retired。active 直接編集不可 | `types.ts` + 編集 UI 無し | ✅ |
| ☐ | 重い操作は確認画面と理由入力 | 生画像のみ実装 | ⚠️ |
| ☐ | 集計 job と画面 query は冪等。同一 event の重複で回数・課金・quota を増やさない | `makeBillingIdentityResolver()` | ✅ |
| ☐ | 障害時に過去 run や asset を上書きせず、status と監査 event で再試行可能 | 上書き UI を作っていない | ✅ |

- **欠損 capture ❌**: 撮るべき枚数（表情6 / 姿勢8?）と一部欠損時の completed / failed 判定が**仕様に無い**（QUESTIONS #2）。仕様待ちの未実装。
- **重複有効の拒否 ⚠️**: 表示側は `resolveAssignment()` が1件に解決するので画面は壊れないが、**「publish 前に拒否する」バリデーション自体は無い**。

---

## §15 受入条件（ここが最終チェック）

| ☐ | 受入条件 | 判定 | 根拠 |
|---|---|---|---|
| ☐ | role と scope の全組合せで、権限外顧客・他店舗顧客・解除済み顧客が取得できない | ✅ | `npm run smoke` のスコープ系 check |
| ☐ | 管理画面の個人結果がユーザー画面と同じ metric 値。別定義の同名スコアが無い | ✅ | `metrics.ts` 単一 catalog |
| ☐ | 改善率・care 率が母数・期間・対象条件・欠測を表示し、重複 event を除外 | ✅ | `AggregateStat` 経由を強制 |
| ☐ | 固定13 video_code だけが存在し、差し替え後も video_code / pose_code 不変で asset だけ変わる | ✅ | `assertCareSlotInvariant()` |
| ☐ | Guest 再生不可、Member 月10回、Premium 無制限が **Backend entitlement** で判定される | ⚠️ | 前端 `careEntitlement()` 已实作且 smoke 有守，但「Backend で判定」是后端条件 |
| ☐ | 本番が AI `/v1/recommend` を使わず、Backend 正式 run だけを表示 | ✅ | 推奨は `recommendationRuns` のみ参照 |
| ☐ | 未同意で撮影不可、QR1日と画像180日が分離、登録時に2年規則へ再計算 | ⚠️ | 分離と再計算は OK。**「未同意で撮影不可」は撮影フローが無いので未検証** |
| ☐ | 期限更新・30日前通知・全 generation 削除・画像一時閲覧が監査可能 | ✅ | 監査画面に該当カテゴリあり |
| ☐ | V1 active 店舗1件を DB／API で制約し、解除後も本人履歴を保持 | ⚠️ | 前端 smoke 有守；DB／API 制約は后端 |
| ☐ | production で /debug 非公開、operator / company_admin / store_admin の 2FA 必須 | ➖ | 后端・インフラ |

---

## 穴のまとめ（作るならこの順）

| 優先 | 未実装 | 仕様の根拠 | なぜ今できるか |
|---|---|---|---|
| ~~1~~ | ~~推奨設定の draft 作成・差分・影響 preview~~ | ~~§8~~ | **✅ 2026-09-15 実装済み** |
| 2 | **store_staff の操作画面**（撮影開始・同意確認・staff note・handoff 発行） | §4.4 / §9 | role は作ってあるのに、その role の主業務の画面が無い |
| ~~3~~ | ~~membership の付与・剥奪~~ | ~~§4.2 / §4.3~~ | **✅ 2026-09-13 実装済み** |
| ~~4~~ | ~~差し替え申請の永続化と履歴／rollback 画面~~ | ~~§7.1~~ | **✅ 2026-09-18 実装済み**（保存自体は backend） |
| 5 | **export（CSV）＋確認画面・理由入力** | §11 / §13 | 監査カテゴリだけ先にある状態の解消 |
| 6 | 顧客一覧に 初回・前回・最新の適格分析日時 | §5.1 | 一覧の列が仕様より少ない |
| 7 | 技術情報を drawer へ | §5.2 | 「通常は詳細 drawer」。今は常駐カード |
| 8 | 分析画面の「推移」 | §4.1 | 読み方次第。顧客詳細の比較で足りるかを先に決める |

### 仕様が決まらないと作れないもの（＝実装漏れではない）

`docs/QUESTIONS_FOR_YOSHIDA.md` 参照。

- 欠損 capture の扱い（§13、QUESTIONS #2）
- care_orientation の表示面・権限（§16 P1、QUESTIONS #4）
- 改善率の metric_direction 一覧（§16 P1、QUESTIONS #3）— 現在は暫定＋「暫定」バッジ
- 分析の「品質」の等級・閾値・適格分析から除外するか（QUESTIONS #1）— **KPI の母数に効く**
- 初期推奨基準値・policy version（§16 P0）— 実測＋事業承認まで active 化不可
- 離脱リスク14日を画面から設定可能にするか（§6「日数は運用設定」、QUESTIONS #9）
