/**
 * 分析詳細 (仕様書 v1.0 §5.2)
 *
 * 1 回の分析の全結果を 1 ページで見る。
 * 顧客詳細の一覧から「詳細」で来て、戻ると一覧へ帰る。
 *
 * 🔴 スコープ外の顧客はここでも開けない。URL を直接叩かれても
 *    `useSession()` が返す customers に居なければ表示しない (§2)。
 *    実 API 接続時は取得のたびに Backend 側でも再検証する。
 * 🔴 姿勢分析は B2B のみ。active な店舗連携がない顧客には出さない (§5.2)。
 */

import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { ChevronLeftIcon } from "lucide-react"

import { CustomerBadges } from "@/components/CustomerBadges"
import { PageHeader, SpecNote } from "@/components/PageHeader"
import { SessionDetail } from "@/components/SessionDetail"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useSession, useStoreName } from "@/contexts/session-context"
import { customerLabel } from "@/lib/domain/customers"
import { formatDate, isEligible } from "@/lib/domain/kpi"
import { usesB2bDisplay } from "@/lib/domain/scope"
import { ANALYSIS_TYPE_LABEL } from "@/lib/domain/types"

export default function AnalysisDetailPage() {
  const { dataSubjectId = "", sessionId = "" } = useParams()
  const { customers, analysisSessions, storeDataLinks } = useSession()
  const storeName = useStoreName()

  const customer = customers.find((c) => c.dataSubjectId === dataSubjectId)

  /** 🔴 姿勢分析は B2B のみ。連携が無い顧客の姿勢はここでも開けない。 */
  const isB2b = usesB2bDisplay(dataSubjectId, storeDataLinks)

  const session = useMemo(
    () =>
      analysisSessions.find(
        (s) =>
          s.id === sessionId &&
          s.dataSubjectId === dataSubjectId &&
          (isB2b || s.analysisType !== "posture")
      ),
    [analysisSessions, sessionId, dataSubjectId, isB2b]
  )

  if (!customer || !session) {
    return (
      <div className="space-y-4">
        <PageHeader title="分析詳細" />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            この分析は表示できません。権限の範囲外か、すでに存在しません。
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/customers/${dataSubjectId}`}>顧客詳細へ戻る</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${ANALYSIS_TYPE_LABEL[session.analysisType]} ${
          session.completedAt
            ? formatDate(session.completedAt)
            : `${formatDate(session.startedAt)} 開始`
        }`}
        description={
          <>
            <Link
              to={`/customers/${customer.dataSubjectId}`}
              className="underline-offset-2 hover:underline"
            >
              {customerLabel(customer)}
            </Link>
            <span className="mx-1.5">/</span>
            {storeName(session.storeId)}
            <span className="mx-1.5">/</span>
            {session.newCapture ? "新規撮影" : "再解析(適格外)"}
            {isEligible(session) ? null : (
              <span className="ml-1.5 text-muted-foreground">
                （適格分析の母数には入りません）
              </span>
            )}
            <span className="mt-1 block">
              <CustomerBadges customer={customer} linked={isB2b} />
            </span>
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to={`/customers/${customer.dataSubjectId}`}>
              <ChevronLeftIcon />
              顧客詳細へ戻る
            </Link>
          </Button>
        }
      />

      <SessionDetail session={session} />

      <SpecNote>
        ここに出している値は、ご本人のアプリに出るものと同じ metric_code・同じ値です。
        管理画面専用の別スコアは作っていません。過去との比較は顧客詳細の「比較」タブで見ます。
      </SpecNote>
    </div>
  )
}
