# orinnface-admin

OrinnFACE 管理画面(`orinnface-admin-frontend`)。
本部・契約企業管理者・店舗管理者・店舗スタッフ向けの管理 UI。

- 正本規格: **orinnFACE 管理画面仕様書 v1.0**(2026-08-18 / FitWayWorld株式会社)
  → 正本 PDF `docs/spec/orinnFACE_管理画面仕様書_v1.0.pdf` / 全文抽出 `docs/ADMIN_SPEC_v1.0.md` / 實作指引 `CLAUDE.md`
- 使用者向け Figma 正本: file key `4NiQEpytzfygBpGhhpcXDa` の `node-id=13-2` と `node-id=99-2` のみ
  (`node-id=0-1` はテスト用。**完全に除外**)

## システム内の位置づけ

| Project | 役割 |
|---|---|
| orinnface-frontend | B2C / 顧客向け画面 |
| orinnface-backend | 一般 API、分析オーケストレーション、権限、正式推奨 |
| **orinnface-admin-frontend** | **本 repo** |
| orinnface-admin-backend | 管理 API、監査、集計、care 差し替え、基準値運用 |
| orinnface-ai | 画像から分析値を返す内部サービス |

管理画面から AI へ直接接続しない。すべて管理 API / Backend を経由する。

## Tech stack

Vite + React 19 + TypeScript / Tailwind CSS v4 / shadcn/ui v3 (Nova preset) /
React Router / Recharts / React Hook Form + Zod / Lucide React

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
```

## 検証

```bash
npm run check         # build + lint + smoke + smoke:render
npm run smoke         # 仕様不変条件(スコープ判定・固定13枠・KPI 母数)
npm run smoke:render  # 全ページを SSR して実行時エラーを検出
```

`npm run lint` は継承した shadcn の `ui/*` と `hooks/use-mobile.ts` で 5 件エラーが出る
(複製時点から存在)。

## 現況

ドメイン層・画面ともに仕様書 v1.0 に沿って再構築済み。データは `src/lib/mock/seed.ts` の
決定的モックで、実 API 接続・実認証・差し替え申請の永続化は未実装。
実装マップと仕様ガードは `CLAUDE.md` §16 を参照。

旧 OrinnME 時代のドキュメントは `docs/legacy-orinnme/` に退避してある(履歴目的のみ、
**現行仕様ではない**)。
