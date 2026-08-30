# orinnFACE 管理画面仕様書 v1.0(全文抽出)

- 發行: FitWayWorld株式会社 / 2026-08-18
- 前版: v0.9.3(2026-08-10)
- 用途: 実装・レビュー・運用で日常参照する正本

> **正本 PDF**: [`docs/spec/orinnFACE_管理画面仕様書_v1.0.pdf`](spec/orinnFACE_管理画面仕様書_v1.0.pdf)
> 本檔是該 PDF 的**文字抽出版**(供 grep / diff 用),排版與表格線已遺失。有疑義時以 PDF 為準。
> 實作指引摘要見 repo 根目錄 `CLAUDE.md`。

```text
orinnFACE

管理画面仕様書
権限・画面・KPI・care運用・同意／保存・監査の実装正本

文書版: v1.0
改訂日: 2026年8月18日
発行: FitWayWorld株式会社
前版: v0.9.3（2026年8月10日）
用途: 実装・レビュー・運用で日常参照する正本

 本改訂の結論 旧training_videos中心の仮仕様を廃止し、ユーザー側と同一の分析指標、管理用推移、
 care実施、固定13枠の差し替え、本部承認、B2B未連携分析、2年／180日の画像保持をV1として統合し
 た。

重要: Figmaの判断根拠は file key 4NiQEpytzfygBpGhhpcXDa の node-id=13-2 と node-id=99-2 のみ。
node-id=0-1はテスト用であり完全に除外する。
orinnFACE 管理画面仕様書 | v1.0

目次
1.​ 本書の位置づけ・正本境界
2.​ システム構成
3.​ ロール・認証・権限
4.​ 店舗連携とデータ範囲
5.​ 画面構成
6.​ 顧客・分析結果
7.​ KPI・改善・care実施
8.​ care動画管理
9.​ 推奨基準値・方針管理
10.​B2B未連携分析
11.​ 同意・画像保持・削除
12.​監査・セキュリティ
13.​管理API対応
14.​状態・エラー・運用
15.​V2/V3拡張
16.​受入条件
17.​実装前の未決事項
18.​旧仕様からの置換

0. 本書の位置づけ・正本境界
本書は、管理画面フロントエンドおよび管理APIの画面・権限・運用動作を定める。物理DB列はDB設計
書v1.9、API pathはAPI設計書v1.3、実行・IAMはインフラ・Backend設計書v1.7を正本とする。

 領域                   正本                       本書での扱い

 管理画面の画面・操作           本書 v1.0                  実装・受入の正本

 DB物理構造               DB設計書 v1.9               本書で列名を独自追加しない

 API名称・schema         API設計書 v1.3              本書の画面操作をAPIへ対応付ける

 Backend・IAM・job      インフラ／Backend v1.7        認証、監査、保持jobの正本

 AI分析値                AI分析 v1.6                管理画面で別スコアを作らない

 正式推奨・care            AI推奨 v1.2                Backend推奨と固定13枠を使用

 ユーザーUI               正しいFigma 13-2／99-2       管理画面のユーザー結果表示の意味を合わせる

 変更管理 確定値を黙って上書きしない。基準値・推奨方針・care公開はdraft→承認→有効化で版を発行
 し、過去snapshotを変更しない。

1. システム構成
 プロジェクト                           役割

 orinnface-frontend               B2C／顧客向け画面

orinnFACE 管理画面仕様書 | v1.0

 プロジェクト                           役割

 orinnface-backend                一般API、分析オーケストレーション、権限、正式推奨

 orinnface-admin-frontend         本部・契約企業管理者・店舗管理者・店舗スタッフ向け管理画面

 orinnface-admin-backend          管理API、監査、集計、care差し替え、基準値運用

 orinnface-ai                     画像から分析値を返す内部サービス。顧客情報・動画・権限を扱わない

●​ 管理画面は一般ユーザー画面とデプロイ単位を分ける。DBはidentity／analyticsを論理分離し、接
   続roleも最小権限にする。
●​ 管理画面からAIへ直接接続しない。すべて管理API／Backendを経由する。
●​ 画面表示は『店舗』に統一する。内部コードのpartnerをユーザー向けに表示しない。

2. ロール・認証・権限
 role_code           表示             範囲                                         2FA

 operator            本部             全会社・店舗を横断。高リスク操作と監査を担当                     必須

                                    所属企業とその配下の全店舗を横断。店舗、スタッフ、顧
 company_admin       契約企業管理者                                                   必須
                                    客、KPI、差し替え申請

                                    store_membershipを付与された1店舗または複数店舗。
 store_admin         店舗管理者                                                     必須
                                    店舗運用、スタッフ、顧客、KPI

                                    所属店舗かつactiveな店舗連携を持つ顧客。撮影・結果・
 store_staff         店舗スタッフ                                                    任意／初期OFF
                                    メモ・handoff

 customer            顧客             本人データのみ。管理画面の利用者ではない                       任意／初期OFF

●​ roleをaccountsの単一列へ直書きせず、organization_memberships／store_membershipsで
   scope付き管理する。
●​ 単店舗契約でも内部的にcompanyとstoreを作成する。複数店舗横断管理へ変更する場合は同じ
   accountへcompany_adminを付与し、account、顧客、分析履歴、同意、保存期限を作り直さない。
●​ 一部の複数店舗だけを管理する担当者は、対象店舗ごとのstore_admin membershipを複数付与
   する。固定のエリア管理者roleは追加しない。
●​ Frontendの表示非表示だけを権限制御にしない。API queryのたびにmembership、
   store_data_link、対象scopeを検証する。
●​ operatorでも生画像は通常一覧へ表示しない。理由入力と監査付き5分tokenを別操作で発行す
   る。

3. 店舗連携とデータ範囲
 項目                   V1ルール                                    V2以降

 有効店舗                 登録顧客1人につきactive最大1店舗                     複数店舗activeを許可

 来店履歴                 store_visitsへ累積。閲覧権限とは分離                 維持

                      active store_data_link＋スタッフmembershipの
 閲覧権限                                                          複数linkごとに同じ判定
                      両方が必要

orinnFACE 管理画面仕様書 | v1.0

 項目             V1ルール                                V2以降

                店舗から即時閲覧不可。本人の分析・care履歴は
 連携解除                                                同じ
                保持

 保存期限           連携・解除・閲覧では更新しない                      同じ

 B2Bの呼称 B2BにGuestプランは存在しない。登録前は『未登録顧客の仮データ』または『未連携分析』と
 呼ぶ。B2C Guestと混同しない。

4. 画面構成

4.1 本部（operator）
 メニュー            主な内容

 ダッシュボード         全社KPI、期間・会社・店舗filter、母数・欠測表示

 会社・店舗           契約状態、店舗、membership、利用状況。V1の契約作成は手動運用

 顧客              権限範囲の顧客、active店舗、分析履歴、care実施、保持状態

 分析              ユーザー側と同じneutral／5動作／姿勢指標、品質、version、推移

 care動画          固定13枠、asset、差し替え申請、承認、公開、rollback

 推奨設定            基準値set、policy、preview、承認、有効化、rollback

 画像・保持           理由付き一時閲覧、期限、通知、削除state、失敗再試行

 監査              権限変更、画像閲覧、export、care差し替え、基準値変更、削除

4.2 契約企業管理者（company_admin）
●​ 所属企業とその配下の全店舗を横断し、全体／店舗別のKPI、顧客、スタッフ、分析履歴、care実
   施を確認する。
●​ 配下店舗の一覧、店舗間比較、店舗管理者・店舗スタッフのmembershipを権限範囲内で管理す
   る。
●​ 固定13枠への差し替え申請はできるが、V1でslot・pose・video_codeを新設できない。
●​ 本部承認前のassetを顧客へ公開できない。生画像の管理画面表示は標準OFF。

4.3 店舗管理者（store_admin）
●​ store_membershipを付与された店舗のKPI、顧客、スタッフ、分析履歴、care実施を確認する。
●​ 複数店舗を担当する場合は対象店舗ごとにstore_admin membershipを付与し、所属企業全体へ
   権限を自動拡張しない。
●​ 固定13枠への差し替え申請はできるが、本部承認前のassetは公開できず、生画像表示は標準
   OFFとする。

4.4 店舗スタッフ（store_staff）
●​ 所属店舗のactive連携顧客だけを検索・閲覧する。
●​ B2B撮影、顧客本人同意の確認、分析実行、結果表示、staff note、handoff link発行を行う。

orinnFACE 管理画面仕様書 | v1.0

●​ 顧客本人の代わりに必須同意をチェックする操作を標準フローにしない。

5. 顧客・分析結果

5.1 顧客一覧
 表示項目             要件

 顧客識別             表示名／顧客番号等の必要最小限。analyticsへPIIを混入しない

 店舗               active店舗と連携状態。V1はactive最大1

 最新分析             completed_at、face／posture、品質、結果有無

 継続               初回・前回・最新の適格分析日時、分析回数、離脱リスク

 care             推奨表示、再生開始、完了、直近実施、月次回数

 保持               retention policy、期限、通知／削除state。権限のある者だけ

5.2 顧客詳細・分析詳細
 領域           表示する値                                            注意

 neutral      無表情6指標、同年代比較、average_version                     5動作の可動域と混ぜない

              smile／pucker／jaw_open／eye_open／brow_furrowの可動
 5動作                                                           ユーザー側と同じmetric定義
              域、左右差・偏位、代償・過緊張

                                                               B2Cには出さない。V1ユーザー画面
 姿勢           B2Bのみ。正面4、側面4。左右側面結果は別表示
                                                               は左側面

              同じ分析種別の初回比、前回比、任意2件比較。各回の画像状
 比較                                                            AIではなくBackend／Frontend責務
              態と全比較可能metricの当時値

              rank、pose、score、baseline、deviation、video_code、
 推奨                                                            Backend正式runだけ
              version

 技術情報         契約・前処理・model・計算・閾値・平均・推奨・catalog version         通常は詳細drawer

 同一指標原則 ユーザー側へ表示するスコアと管理画面の個人結果は同じmetric_code・同じ値を使う。管
 理画面専用に同名の別スコアを作らない。

●​ 本人向け履歴一覧は日時、thumbnailまたは画像状態、分析種別、店舗名、総合スコアを表示し、
   単体詳細はその日の全結果を表示する。管理画面は権限内の同じsnapshotを使うが、生画像表
   示は標準OFFを維持する。
●​ 『初回』は同一人物・同一分析種別の最初の有効なcompleted分析。Guest移行／B2B handoff分
   を含め、登録日・Premium開始日・契約日・初回来店、failed・cancelled・invalid、新規撮影のない
   再解析は含めない。顔と姿勢は別管理する。
●​ 2時点比較は左=古い日、右=新しい日とし、同一analysis_type／metric_codeの全項目を当時
   versionのまま表示する。画像削除後も数値履歴を残し、version非互換は警告する。
●​ 本人画面の権限はGuest=履歴なし、Member=一覧・単体詳細、Premium=初回・前回・任意2件比
   較。管理画面の閲覧可否はplanではなくoperator／店舗scopeと監査要件で判定する。

orinnFACE 管理画面仕様書 | v1.0

6. KPI・改善・care実施
 KPI            正式定義                                       表示条件

 月間アクティブユー
                JST月内にcompleted分析が1回以上ある一意data_subject数    B2B課金根拠。重複除外
 ザー

 総分析回数          期間内のcompleted analysis_session数            失敗・取消を除外

 継続分析ユーザー       期間末までに適格分析が2回以上ある一意subject数                母数を併記

 離脱リスク          最終適格分析から14日以上かつactive account／link         日数は運用設定

                比較可能者のうちmetric_directionに沿って最新値が基準時点よ      指標・比較基準・母数・欠測を必ず
 改善率
                り改善した人数 ÷ 比較可能者数 ×100                      表示

 care実施率        care_play_completed人数 ÷ 推奨表示人数 ×100        期間・slot・asset・scope別

                                                           再接続は同一playbackとして重複
 care完了率        完了playback数 ÷ 開始playback数 ×100
                                                           除外

●​ 改善はmetricごとに評価方向を持たせる。可動域は高い方向、左右差・偏位は絶対値が0へ近づく
   方向などをmetadataで定義する。
●​ 基準時点は画面filterで『本人の同一分析種別の初回適格分析』『直前分析』を選ぶ。『初回』は
   completed_at順の最初の有効な分析であり、登録日・契約開始日・Premium開始日・店舗初回来
   店ではない。
●​ Guestから登録／B2B handoffで正しく引き継いだ適格分析は本人の履歴と初回候補に含める。失
   敗・取消・invalid、新規撮影のない再解析／再スコアリングは除外する。
●​ 平均値、中央値、改善率は母数、期間、対象条件、欠測数、使用versionを表示し、少数母数を隠さ
   ない。

7. care動画管理
ユーザー向け機能名は『顔トレ』を維持し、内部コンテンツ総称はcare video／顔ケア動画とする。V1は
次の13枠だけを実装する。

 区分        video_code                        対象       権限

 案内        care_orientation                  —        表示面はFigma／動画仕様で確定

 1分        care_1m_smile                     いー       Member／Premium

 1分        care_1m_pucker                    うー       Member／Premium

 1分        care_1m_jaw_open                  あー       Member／Premium

 1分        care_1m_eye_open                  目        Member／Premium

 1分        care_1m_brow_furrow               眉間       Member／Premium

 3分        care_3m_smile                     いー       Premium

 3分        care_3m_pucker                    うー       Premium

 3分        care_3m_jaw_open                  あー       Premium

 3分        care_3m_eye_open                  目        Premium

 3分        care_3m_brow_furrow               眉間       Premium

orinnFACE 管理画面仕様書 | v1.0

 区分         video_code                対象            権限

 専門         lymph_care                リンパ           Premium

 専門         nerve_approach            神経            Premium

7.1 差し替えフロー
1.​ 本部デフォルトassetを各video_codeへ1件解決可能にする。
2.​ 契約企業・店舗は既存枠への差し替えを申請する。V1は自由な項目作成を許可しない。
3.​ 本部が提供者、内容、権利、承認状態、公開期間、対象scopeを確認し、approve後にassignment
    を予約する。
4.​ 有効日時でcare_asset_idだけを切り替える。video_codeとpose_codeは変更しない。
5.​ 元asset、差し替えasset、申請者、承認者、理由、開始・終了、取消、catalog versionを履歴保持す
    る。

7.2 会員権限
 区分              表示                         再生

 Guest           推奨2件をlock表示＋登録CTA          不可

 Member          選定2動作の1分care               JST暦月10回

 Premium         1分・3分・リンパ・神経               商品上の月間上限なし

 禁止 training_videos、facial_training、is_starter、releaseをV1の新規実装名にしない。仕様外の『はじめ
 て向け』枠や14番目のslotを追加しない。

8. 推奨基準値・方針管理
●​ 正式推奨はBackendだけが生成する。AI /v1/recommendの値を本番画面・保存へ使わない。
●​ recommendation_baseline_versionは5動作の基準値set、recommendation_policy_versionは
   順位・tie-break・欠損・fallback方針であり分離する。
●​ 画面はdraft作成、差分、影響preview、approve、activate、scheduled activate、rollbackを提供す
   る。
●​ active値の直接更新は禁止し、過去recommendation_runを再計算・上書きしない。
●​ 同年代平均average_version、AI threshold_version、推奨基準versionを同じ値として扱わない。

 操作                 operator                company_admin／store_admin／store_staff

 閲覧                 全version・差分・影響          自scopeの結果根拠のみ

 draft作成            可                       不可

 承認／有効化             可。作成者と承認者の分離を推奨         不可

 rollback           新versionとして実行           不可

orinnFACE 管理画面仕様書 | v1.0

9. B2B未連携分析
1.​ スタッフが未登録顧客のsessionを開始する。
2.​ 顧客本人が撮影・保存へ同意する。consent eventをanonymous_idへ紐付ける。
3.​ 顧客IDなしで撮影・分析し、未連携分析として保存する。data_subject_id、operator_user_id、
    salon_idを分離する。
4.​ 1日有効の同一handoff tokenをQR／URLで渡す。
5.​ 顧客がGoogleまたはメールで通常登録し、tokenを1回消費して仮データを紐付ける。B2B専用軽
    量登録は作らない。
6.​ 紐付け時にretention_stateを再計算する。起算は登録日ではなく対象の最終適格分析完了日。

 期限                    値                         連動

 handoff QR／URL        発行から1日                    失効しても画像を削除しない

 未連携の生画像               分析完了から180日                180日内の紐付けで登録2年規則へ移行

10. 同意・画像保持・削除
 主体                    生画像期限                           更新条件

                                                       新規撮影を伴う分析がcompleted。過去全画像を同
 登録ユーザー（B2C／B2B）       最終適格分析完了日から2年
                                                       じ期限へ更新

 B2C Guest             分析完了から180日                      通常登録＋明示的引継ぎで登録規則へ移行

 B2B未連携分析              分析完了から180日                      通常登録＋handoff claimで登録規則へ移行

 将来の長期保存               撤回または退会まで                       独立したlong_term_retention同意。V1 UI非表示

●​ 全ユーザーは初回撮影前にraw image capture／storageへ本人同意する。未同意では撮影・分
   析を開始しない。
●​ ログイン、予約、来店、店舗連携、カルテ閲覧、過去画像再解析、再スコアリング、施術記録では期
   限を更新しない。
●​ 登録ユーザーには満了30日前に通知する。期限到達後は署名URLを停止し、queue→全
   generation削除→不存在確認→監査完了とする。
●​ 退会時は生画像を削除する。特徴量はアカウント情報との直接の紐付けを切った状態で
   anonymous_idにより保持する。
●​ 長期保存と研究・AI品質改善同意は独立した二軸。研究同意は初期OFF、V1画面非表示、サービ
   ス条件にしない。

11. 監査・セキュリティ
 領域               要件

 生画像              非公開GCS、CMEK、Public Access Prevention、Cache-Control private/no-store

 一時閲覧             権限・所有・active link・目的・理由を検証し、署名URL300秒

 画像監査             閲覧者、対象asset、理由、日時、request IDをimage_access_logsへ記録

orinnFACE 管理画面仕様書 | v1.0

 領域                 要件

 変更監査               role、export、care差し替え、基準値、policy、削除、rollbackを追記

 秘密情報               Secret Manager等。文書、DB行、repository、画面へ平文表示しない

 production         /debug非公開。admin APIは認証・2FA・rate limit・監査を必須

12. 管理API対応
 画面操作                           API

 顧客一覧／詳細                        GET /admin/v1/customers、GET /admin/v1/customers/{data_subject_id}

 分析履歴／推移                        GET /admin/v1/customers/{data_subject_id}/analysis-sessions

 KPI                            GET /admin/v1/metrics/overview

 care実施                         GET /admin/v1/care-playbacks

 生画像一時閲覧                        POST /admin/v1/raw-image-assets/{raw_image_asset_id}/view-tokens

 監査検索                           GET /admin/v1/audit-events

 固定枠・asset                      GET /admin/v1/care-video-slots、POST /admin/v1/care-video-assets

 差し替え                           replacement-requests／approve／reject

                                recommendation-baseline-sets／recommendation-policy-sets のdraft・approve・
 推奨基準・方針
                                activate

 API正本 path、method、body、error codeの詳細はAPI設計書v1.3を正とする。V1にPOST
 /admin/v1/care-video-slotsは存在しない。

13. 状態・エラー・運用
 対象                主要状態                                          管理画面

                   draft／capturing／analyzing／completed／
 分析                                                              再実行可否、retryable、欠損captureを表示
                   failed

 handoff           unlinked／linked／expired                       1日失効と画像180日を別表示

                   active／notice_scheduled／expired／
 保持削除                                                            失敗理由・再試行・監査
                   deletion_queued／verifying／deleted／failed

                   draft／pending_approval／approved／
 care assignment                                                 重複有効をpublish前に拒否
                   scheduled／active／ended／rejected

 基準・policy         draft／approved／active／retired                 active直接編集不可

●​ export、画像閲覧、差し替え、基準値変更などの重い操作は確認画面と理由入力を設ける。
●​ 集計jobと画面queryは冪等にし、同一eventの重複で回数・課金・quotaを増やさない。
●​ 障害時に過去runやassetを上書きせず、statusと監査eventで再試行可能にする。

orinnFACE 管理画面仕様書 | v1.0

14. V2/V3拡張
 将来機能             V1から保持                                   V1画面では提供しない

 複数店舗             store_data_linksを複数行で保持                  複数activeのUI

 新care枠           slot／asset／assignment／catalogを分離         店舗による自由slot作成

 Voice等           analysis_type／metric／model versionを抽象化   Voice画面・Voice推奨

 研究・長期保存          consent eventとretention policyを別軸        初回toggle、初期ON

 高度分析             結果・metric・推奨runを追記                       過去結果の上書き再計算

15. 受入条件
●​    roleとscopeの全組合せで、権限外顧客・他店舗顧客・解除済み顧客が取得できない。
●​    管理画面個人結果がユーザー画面と同じmetric値を表示し、別定義の同名スコアがない。
●​    改善率・care率が母数、期間、対象条件、欠測を表示し、重複eventを除外する。
●​    固定13 video_codeだけが存在し、差し替え後もvideo_code／pose_codeが不変でassetだけが
      変わる。
●​    Guest再生不可、Member月10回、Premium商品上無制限がBackend entitlementで判定される。
●​    本番がAI /v1/recommendを使用せず、Backend正式runだけを表示する。
●​    未同意で撮影不可、QR1日と画像180日が分離、登録時に2年規則へ再計算される。
●​    期限更新、30日前通知、全generation削除、画像一時閲覧が監査可能である。
●​    V1 active店舗1件をDB／APIで制約し、解除後も本人履歴を保持する。
●​    productionで/debug非公開、operator／company_admin／store_adminの2FAが必須である。

16. 実装前の未決事項
 優先        未決事項                            確定条件                          先行可能範囲

           画像満了後の削除保証上限・同意撤回               弁護士＋運用。現推奨は満了後30日以
 P0                                                                      内部state／queue
           時の削除期限                          内

                                                                         画面・table。active化不
 P0        初期推奨基準値・policy version          実測＋事業承認
                                                                         可

 P0        既存動画の13枠mapping・権利確認            本部棚卸し                         slot seed

 P1        care_orientationの表示面・権限         動画仕様＋正しいFigma                 slot保持

 P1        改善率の初期metric_direction一覧        指標責任者承認                       raw差分・母数集計

           partner側生画像閲覧を将来許可する
 P1                                        法務・運用・画面同意                    V1標準OFF
           か

 P2        管理画面ビジュアル                       デザイナー管理画面Figma                本書の情報構造で仮実装

orinnFACE 管理画面仕様書 | v1.0

17. 旧仕様からの置換
 旧記述                                v1.0の正式記述

 生画像は無期限保存                          登録2年rolling／B2C Guest・B2B未連携180日

 users.role                         organization_memberships／store_memberships

 user_store_visitsで閲覧               来店store_visitsと閲覧store_data_linksを分離

 training_videos／facial_training／
                                    固定13 care slot／asset／assignment。starter補完なし
 is_starter

 店舗が独自動画を自由追加                       既定枠への差し替え申請。本部承認

 改善・動画視聴はV2                         V1から収集・管理表示。複雑な予測はV2

 AIが推奨                              Backendが正式推奨。AI推奨は非本番

 B2B Guest                          未登録顧客の仮データ／未連携分析

 複数店舗を累積active                      V1 active1件、V2複数


```
