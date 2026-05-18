# OrinnME 実装 TODO

> 雇主確認済かつ未実装の項目を優先順に整理。
> 全体の規格落地状況は `SPEC_REVIEW.md` を参照。

## 雇主確認済 未実装

### A. ユーザー詳細ページに性別・生年月日表示

- 確認日: 2026/5/18
- 設計師判斷(細節自由):
  - 位置:頂部使用者情報区(Avatar の隣 / 下)
  - BtoB 視角:非表示(個人情報保護、規格 0 章の三套画面差異に準拠)
  - Guest 未入力時:「未登録」表示
- 実装ファイル:
  - `src/pages/UserDetailPage.tsx`(表示)
  - `src/lib/mock-data/types.ts`(`User` に `gender?` / `birthDate?` 追加)
  - `src/lib/mock-data/users.ts`(30 名分の mock 値 + 一部 Guest を「未入力」相当の undefined に)
- 估時:30〜60 分
- 優先度:**週二**

### B. CTA 効果分析を管理画面に追加

- 確認日: 2026/5/18
- 設計師判斷(細節自由、週二 polish):
  - 配置:ContentPage(コンテンツ分析)頁
  - KPI:
    - Day 7 / ケア後 / Day 30 の CTA 表示・点击率
    - CTA → Premium 升級転換率
  - 三套画面の出し分け:
    - 運営(admin):全体表示
    - OEM:自社利用者の CTA 効果のみ
    - BtoB:非表示(個人転換は商業意義無し、規格 0 章準拠)
- 実装ファイル:
  - `src/pages/ContentPage.tsx`(KPI セクション追加)
  - `src/lib/mock-data/`(新ファイル `cta-events.ts` 想定、または `plan-history.ts` 拡張)
  - `docs/API_CONTRACT.md`(新 endpoint `/cta-events` を追記)
- 估時:1〜2 時間
- 優先度:**週三**

## v2 落地 batch fix(週二優先)

| # | 項目 | ステータス | 影響範囲 |
|---|------|-----------|---------|
| 1 | 動画 mock 12 本(120 秒削除) | ✅ 完了 `b4065c1` | `mock-data/videos.ts` |
| 2 | ContentAnalytics Bar Chart 2 bucket | ✅ 自動対応済 | 空 bucket 非表示ロジックで自動 |
| 3 | 疲労度 Premium 限定(推移チャート含む) | ✅ 完了 `b4065c1` | `UserDetailPage.tsx` |
| 4 | Guest activityLog から動画記録削除 | ✅ 完了 `b4065c1` | `mock-data/users.ts` |
| 5 | Member 動画記録 30s / 月 10 回上限 | ✅ 完了 `b4065c1` | `mock-data/users.ts`, `videos.ts` |
| 6 | 価格表示確認(¥980 → ¥780、または非表示) | ⚠️ 雇主確認待ち | grep 結果 0 件、現在は非表示 |
| 7 | `ContentPage.tsx:92` description 文案修正 | ✅ 完了 2026-05-18 | `「3 尺(30/60/120秒)」` → `「2 尺(30/60秒)」` |

## 未確認 ⚠️(`SPEC_REVIEW.md` の残課題)

- 全体コンディションスコアの定義(規格質問 #2 / DEMO.md)
- G→M 純増の独立 KPI 必要性(規格質問 #5 / DEMO.md)
- 価格表示の扱い(上記 #6)
