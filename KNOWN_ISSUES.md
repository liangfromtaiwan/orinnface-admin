# OrinnME 管理画面 — 既知の制約 / 未対応事項

> 規格 v1 / v2 落地状況の自主審査(2026-05-20)で見つかった残課題。
>
> **A. 雇主確認待ち**(週四検査時に方針確定したい項目)
> **C. 工程師接手 TODO**(backend 設計を伴うため設計師判断のみで決められない項目)
>
> B カテゴリの「補完可能」項目はすべて本日(2026-05-20)実装済(commit にて push 予定)。

---

## A. 雇主確認待ち(週四検査時に確定)

### A-1. 表情・疲労 分布率の「日 / 週 / 月」切替(規格 v1 2-2 / 2-3)

**規格の文言**:
> 表情分類分布率(日・週・月)
> 表情疲労度分布率(日・週・月)

**現状実装**:
- AdminDashboard / OEMDashboard / B2BDashboard に「表情カテゴリ分布」「疲労ステージ分布」BarChart あり
- **本日 snapshot のみ**、期間切替トグル無し

**確認したいこと**:
- 本日 snapshot で OK か、それとも「日・週・月」セグメント切替が必須か?
- 必須なら、Tab 切替(`<Tabs>`)で実装可能(規模:1-2 時間)

**実装ファイル(対応する場合)**:
- `src/components/AdminDashboard.tsx`(`buildDistributionData()` を period パラメータ化)
- `src/components/OEMDashboard.tsx` 同様
- `src/components/B2BDashboard.tsx` 同様

---

### A-2. 主観データ「推移」(時系列)(規格 v1 2-2)

**規格の文言**:
> 主観データ推移(主観疲労度 / 集中しやすさ / 部位入力)

**現状実装**:
- B2BDashboard に 3 種類の **分布**(`主観疲労分布` / `主観集中分布` / `部位別コンディション`)BarChart
- UserDetailPage に **個別ユーザー**の主観疲労 LineChart(時系列)
- **集計レベルの時系列推移は無し**

**確認したいこと**:
- 規格「推移」は時系列(LineChart)を意図しているか、現状の分布スナップショットで OK か?
- 時系列が必要な場合、3 種それぞれ別の LineChart にするか、重ね合わせか?
- 部位は時系列の意味があるか(普通毎日変わらない)?

---

### A-3. 継続セッション率(週 3 回以上)(規格 v1 2-4)

**規格の文言**:
> 継続セッション率(週 3 回以上の習慣化)

**現状実装**:**0**

**確認したいこと**:
- 「習慣化」の定義(週 3 回以上=ハードコード?それとも雇主が閾値を変えたい?)
- どの視点で表示する?(admin / oem / b2b すべてか、b2b は集計版か)
- 1 KPI Card で OK(週次更新)か、推移 LineChart も必要か?

**実装ファイル(対応する場合)**:
- `src/lib/mock-data/users.ts` に helper 追加(activityLog から週単位カウント)
- 各 dashboard に KPI Card 追加

---

### A-4. 行動時間帯ヒートマップ(規格 v1 2-4)

**規格の文言**:
> 行動時間帯ヒートマップ

**現状実装**:**0**(activityLog の `analyzedAt` は時刻含むが集計・可視化なし)

**確認したいこと**:
- v1 で必須? v2 で良い?
- 軸構成:曜日 × 時間帯(24h)が一般的、それで OK?
- 個人特定のリスク懸念(b2b 視点では特に。例:1 人だけの企業で時間帯バレる)→ b2b では非表示推奨?

**実装規模**:
- 自作で BarChart のカスタム or recharts には heatmap が無いため、矩形 grid を `div` で組む
- 規模 2-4 時間

---

## C. 工程師接手 TODO(backend 設計を伴う)

### C-1. アクティブ率(規格 v1 2-1)

**規格の文言**:
> アクティブ率

**現状実装**:**0**

**未確定の定義**:
- アクティブ率 = (DAU / 登録ユーザー)?
- それとも = (WAU / 累計登録)?
- もしくは = (アクティブセッション / 全セッション)?

**対応方針(推奨)**:
- 雇主に定義確認 + backend で event-sourced 計算(`active_users / total_registered`)
- 計算は backend、frontend は数字を受け取って KPI Card 表示するだけ

---

### C-2. 初回 → 2 回目 転換率(規格 v1 2-1)

**規格の文言**:
> 初回 → 2 回目転換率

**現状実装**:**0**(onboarding funnel データが mock には無い)

**対応方針**:
- backend で `users.signup_date` と `users.second_analysis_date` を保持
- 「signup から N 日内に 2 回目分析を実行したユーザー / signup 総数」を計算
- N の値は雇主と相談(7 日?30 日?)
- frontend は KPI Card 1 つ追加するだけ

---

### C-3. 動画完遂率の「離脱箇所」(秒数別 drop-off)(規格 v1 2-3)

**規格の文言**:
> 動画完遂率 + 離脱箇所

**現状実装**:
- 完遂率(0/1)は ContentPage で実装済(`completionRate`)
- **離脱箇所(動画のどの秒数で離脱したか)は未実装**

**対応方針**:
- backend で `video_views` テーブルに `dropped_at_seconds` カラム追加
- 動画別の Histogram(横軸:秒数、縦軸:離脱人数)を ContentPage に追加
- 既存 mock は `completed: boolean` のみのため、mock 拡張が必要(`droppedAtSeconds?: number`)

---

## 既知の近似計算(mock 制限)

### WAU / MAU の係数近似

**実装位置**:`src/lib/mock-data/analytics.ts` `getActiveUserStats()`

**理由**:
- mock では per-user の active timestamp を持たないため、平均 DAU から係数で「ユニーク数」を近似
- 係数:WAU = 平均 DAU × 1.2、MAU = 平均 DAU × 1.4

**真實 backend 対応**:
- `analytics_events.distinct(user_id) WHERE timestamp >= now() - interval '7 day'` で正確算出

---

### 改善率の「ケア前後デルタ」近似

**実装位置**:`src/lib/mock-data/analytics.ts` `improvementRate`

**理由**:
- mock では 1 日あたり 1 つの改善率を抽選で生成(`0.38 + jitter`)
- 実際は「ケア実行直後の再分析疲労値」と「ケア実行直前の疲労値」のデルタを集計すべき

**真實 backend 対応**:
- ケア実行 event と完遂後の再分析 event を pair で結合
- (再分析疲労値 - ケア前疲労値) を集計、改善方向に向かった割合を算出

---

## メンテ方針

1. 雇主確認後に方針確定 → 本ファイルから該当項目を削除し、適切な場所に移動
   - 実装する場合 → `TODO.md` または `DESIGN_DECISIONS.md` に移行
   - 仕様外と判断 → `SPEC_REVIEW.md` の「対象外」セクションへ
2. 工程師接手後、backend 設計で対応した項目は本ファイルから削除
3. 新規に gap が見つかったら本ファイルに追記

---

## 関連ドキュメント

- `SPEC_REVIEW.md` — 規格 v1 / v2 の落地状況総覧
- `DESIGN_DECISIONS.md` — 設計判断ログ(9 件)
- `API_CONTRACT.md` — backend 接手用 API 契約
- `SCREENS_INVENTORY.md` — 画面一覧
- `QUESTIONS_FOR_MEETING.md` — 雇主確認したい設計判断
