# OrinnFACE 管理画面 設計判断ログ

本文件記錄設計過程中的關鍵判斷,讓未來工程師接手時理解「**為什麼這樣做**」。

---

## 動画カテゴリ:mock 5 種 vs 規格 3 種

### 現狀
- mock data (videos.ts): 5 カテゴリ × 動画
- 規格 v2 2-1: 3 表情分類(ゆらぎ / おだやか / 張り)× 2 尺 = 12 本

### 設計判斷:保留 5 カテゴリ

**規格根拠**:
規格 4-4「將來対応」:
> OEM 展開時:company_id をキーに
> コンテンツ・文言・動画の出し分けが可能な構造にする

**理由**:
- 未來 OEM(美容店、フィットネス、KOL 等)可能有自訂分類
- mock 用 5 カテゴリ 展現「擴展性」
- 不是 bug,是「規格 4-4 落地演示」

**現在 v2.0 實際資料**:
規格 2-1 的 3 表情分類(ゆらぎ / おだやか / 張り)

**未來 OEM 擴展時**:
不同 company_id 可以有不同分類體系
mock 結構已預留此擴展性

### 雇主確認(2026/5/18)
雇主明確指示:「mock data / 運算邏輯不用煩,工程師處理」
此設計判斷保留至工程師接手後,如需調整再對齊規格。

### 工程師接手注意事項
- 真實 backend 實作時,動画分類應 by company_id 動態查詢
- 不要 hardcode 3 種或 5 種
- 用 catalog table 結構,支援未來擴展

---

## 表情 5 種 wellness 順 mapping(推移チャート用)

### 現狀
規格未明確定義 5 種表情的「順序意義」。

### 設計判斷:健康類 SaaS 邏輯

mapping:
- 5: おだやか(最健康)
- 4: 張り(弱)
- 3: ゆらぎ(弱)
- 2: 張り(強)(緊張、不健康)
- 1: ゆらぎ(強)(大幅波動、不健康)

**理由**:
- OrinnFACE 是健康類 SaaS,「おだやか居中最高」貼近產品理念
- 「張り強」= 緊張、繃緊,在健康 app 中是「不健康徵兆」
- 「ゆらぎ強」= 大幅波動,也不健康

**規格根拠**:
規格 2-2 列出表情分類但未定義順序。
此 mapping 為設計師解釋,工程師接手時可依雇主指示調整。

### 工程師接手注意事項
- 此 mapping 在推移チャート(UserDetailPage)使用
- 如雇主要求調整,改 EXPRESSION_WELLNESS_SCORE constant 即可
- 位置:src/lib/mock-data/types.ts

---

## 警告色實作位置(規格 3-1)

### 規格
> 主観疲労度と AI 疲労度に大きなズレがある場合 → 行を赤くする
> 警告アイコンを出して「何か起きている」と一目でわかるようにする
> 具体的な閾値はエンジニアチームで定義

### 設計判斷:ユーザー詳細頁的「全行動歴史」Table

**理由**:
- 規格沒明說具體頁面位置
- 「全行動歴史」是 user 的時間軸,最能展示「**主観 vs AI 落差大**」的時點
- Dashboard 是集計級,看不出個別 user 的落差

### 雇主確認狀態
- 未直接確認(規格 3-1 列為「⚠️ 雇主確認待ち」 → 已篩除)
- 雇主授權「設計師細節決定」(2026/5/18)

### 工程師接手注意事項
- 具體閾値由工程師定義(規格 3-1 已明寫)
- 警告色觸發邏輯:`recordHasGap()` function
- 位置:src/lib/mock-data/users.ts

---

## BtoB 個資保護策略(規格 3-2)

### 規格
> 個人を特定できる情報は一切表示しない
> 企業には集計データのみを提供する

### 設計判斷:多層次防護

1. **Sidebar 層**:BtoB 視角時隱藏「ユーザー」「ステータス」選項
2. **URL 層**:直接打 /users 或 /status 自動 redirect 到 dashboard
3. **資料層**:即使打通 API 也只返回集計值,無個人欄位

### 工程師接手注意事項
- 後端**必須**做權限檢查(不能只依賴前端隱藏)
- BtoB 視角的 /api/users endpoint 應回 403
- 詳細請參考 API_CONTRACT.md(待建立)

---

## 推移チャート:3 placeholder → 1 重ね合わせ Chart

### 規格
規格 3「ユーザー詳細」:
> 表情 / 主観 / 疲労度の推移グラフ(重ね合わせ)

### 設計判斷:1 張寬版 Chart 三條 Line 重疊

**最初提案**:3 個獨立 Card(各自 chart)
**改為**:1 個寬版 Card,三條 line 重疊

**理由**:
- 規格寫「重ね合わせ」明確就是 1 張圖
- 三條重疊讓「主観 vs AI 落差」視覺化(呼應警告色邏輯)
- 跟「ContentAnalytics 動画尺別」的 ChartCard 樣式一致
- 版面更乾淨

### 工程師接手注意事項
- Chart 用 ChartContainer h-[280px] 固定高度
- 避免「**height: 100% 沒父層約束**」造成的 Bug 1(已修)

---

## 視角切替的 URL 設計

### 設計判斷:Query Parameter(?company_id=X&type=Y)

而不是:
- Path parameter(/admin/dashboard, /oem/dashboard)
- Sub-domain(admin.example.com)

**理由**:
- 規格寫「company_id + type フラグ」決定畫面
- URL 上看得到當前視角,方便 debug
- 切換視角不需要重新 mount route
- 跟 React Router v7 的 search params 整合

### 工程師接手注意事項
- 真實環境中,company_id 應從 JWT claim 取
- 不應信任前端傳的 company_id
- 後端必須 cross-check JWT 中的 company_id

---

## CTA 効果分析:新ページ + 2 漏斗 KPI 構造

### 規格
規格 v2 6 章 + Figma に CTA 7 トリガー定義あり(無料登録 / Premium 課金 2 種類のコンバージョン軸)。

### 設計判斷:独立ページ `/cta-analysis` + 2 漏斗 KPI

**配置**:
- 当初 TODO.md では ContentPage 内に追加予定だった
- 実装時(2026-05-19)に独立ページ `/cta-analysis` に変更

**理由**:
- CTA は「コンテンツ利用」とは別の商業指標(コンバージョン軸)
- ContentPage に同居させると見出しが混雑、視覚的に重複
- Sidebar から直接アクセスできた方が雇主のデモ時に見せやすい

**構造**:
- 2 KPI Card(上段、横並び):
  - 無料登録 CVR(Guest → Member)
  - Premium 課金 CVR(Free → Premium)
- 2 Timing 別 Table(CTA Type ごとに section 分け):
  - 列:タイミング / トリガー / クリック / クリック率 / 転換 / CVR

**三套画面の出し分け**:
- 運営(admin):全社 CTA event 集計
- OEM:自社 user の CTA event のみ(`getCTAEventsByCompany(companyId)`)
- BtoB:**非表示**(/cta-analysis にアクセスしても /dashboard に redirect、Sidebar 項目も非表示)

### 雇主確認(2026-05-18)
- 「CTA 効果分析を管理画面に含める」+「細節は設計師決定」を明示授權

### 工程師接手注意事項
- mock data 実裝位置:`src/lib/mock-data/cta-events.ts`
- KPI helper:`getCTAStats(events, ctaType)` / `getCTAStatsByTiming(events)`
- BtoB 視点に対する backend 権限チェック必須(`/api/cta-events` 403)
- API endpoint は `API_CONTRACT.md` で確定要(未起草)
- 真實環境では `triggeredAt / clicked / converted / convertedAt` を event-sourced で記録すべき

---

## CTA Timing:規格 7 個 → 実裝 6 個(M-1 + M-2 統合)

### 規格
規格 v2 6 章 + Figma に CTA 7 トリガー:
- G-1:アンケート終了後
- G-2:ケア開始前
- G-3:1 日上限到達
- M-1:第 7→8 回時
- M-2:第 7-10 回 毎回
- M-3:月上限到達(強制)
- M-4:Day30 累積

### 設計判斷:M-1 + M-2 を「ケア動画 7-10 回 毎回」に統合(6 個に削減)

**統合キー**:`video_care_7_to_10`、ラベル:「ケア動画 7-10 回 毎回」

**理由**:
- M-1(第 7→8 回時)= 第 7 回動画視聴完了の直後に発火
- M-2(第 7-10 回 毎回)= 第 7・8・9・10 回 毎回発火
- M-2 の「第 7 回発火」は M-1 と本質的に同一時点・同一文脈
- 別 event として記録するとトリガー数が重複カウントされ KPI が歪む
- 統合により「ケア動画閲覧時の Premium 訴求」という単一概念に集約

### 雇主確認状態
- 統合判断は「規格逸脱」ではなく「規格の冗長排除」と解釋
- 設計師細節決定の範囲内(2026-05-18 授權)
- 真實 backend 実裝時、雇主に再確認要(M-1/M-2 を分けて見たい場合は sub_type フィールドで分岐可能)

### 工程師接手注意事項
- `CTATiming` 型は 6 個(`src/lib/mock-data/types.ts`):
  `after_survey` / `before_care` / `daily_limit` / **`video_care_7_to_10`** / `monthly_limit` / `day_30`
- 個別 KPI が必要になった場合、event に `sub_type: 'first_unlock' | 'repeated_prompt'` を追加して同一 timing 内で分岐可能
- 統合判断のロールバックは types.ts + cta-events.ts 2 ファイル変更で済む

---

## 性別 / 生年月日 表示策略(年齢のみ表示)

### 規格
規格 v2 1-1「取得項目」4 項:
- 性別
- 生年月日
- 疲れやすさ
- 表情のこわばり度合い

### 設計判斷:UI には「性別 + 年齢(計算値)」のみ表示

**雇主同意済(2026-05-18)**:性別 / 生年月日の 2 項を `UserDetailPage` に追加

**設計師細節決定**:
- 生年月日そのもの(YYYY-MM-DD)は**表示しない**
- かわりに「年齢(33 歳)」を計算して表示
- 表示位置:`UserDetailPage` 頂部の使用者情報区(Avatar の隣)
- BtoB 視点では性別 / 年齢どちらも**完全非表示**(規格 3-2 準拠)
- Guest user(規格上未登録、undefined)→ sub-info 全体を非レンダリング

**理由**:
- 完全な生年月日は個人特定情報、管理画面の常時表示には過剰
- 「年齢」だけで「Premium 層の年齢分布」「ケア提案の文脈把握」には十分
- 誕生日キャンペーン等の特殊用途が出てきたら別画面で個別取得する方が privacy 安全
- 規格 0 章「三套画面差異」と整合(BtoB に個資なし)

### 工程師接手注意事項
- 年齢計算 helper の実裝位置:`UserDetailPage.tsx` 内の local function(規模小、共通化不要)
- 真實 DB は `birthDate` を保持するが、frontend に渡すのは `age:number` のみにする選択肢あり(個資最小化)
- BtoB 視点の API が誤って `birthDate` / `gender` フィールドを返さないよう backend で fields filtering 必須
- 性別の選択肢は「女性 / 男性 / 回答しない」3 値(規格通り、`Gender` type)
- 生年月日 → 年齢計算は時点依存(基準日が必要)、frontend 計算は現在時刻ベース

---

> 持續更新中。每加入新的設計判斷時更新本文件。
> 未來工程師接手時,優先閱讀此文件理解「**為什麼**」,而不只是「**做了什麼**」。
