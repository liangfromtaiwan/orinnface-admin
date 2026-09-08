/**
 * 分析履歴(全件) — 顧客詳細から遷移する (仕様書 v1.0 §5)
 *
 * 履歴は使うほど増えるため、顧客詳細では最新 10 件で打ち切り、
 * 全件はこの画面で見る。行の描き方は AnalysisHistoryTable に寄せてあるので
 * 2 画面で列や表記がずれない。
 *
 * 行の「詳細」は ?session= を付けて顧客詳細へ戻す。
 * 指標の中身は顧客詳細側で描くため、ここでは一覧だけを持つ。
 */

import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon } from "lucide-react"

import { AnalysisHistoryTable } from "@/components/AnalysisHistoryTable"
import { CustomerBadges } from "@/components/CustomerBadges"
import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSession } from "@/contexts/session-context"
import { usesB2bDisplay } from "@/lib/domain/scope"
import {
  ANALYSIS_TYPE_LABEL,
  type AnalysisType,
} from "@/lib/domain/types"
import { customerIdentities } from "@/lib/mock/seed"

export default function CustomerAnalysesPage() {
  const { dataSubjectId = "" } = useParams()
  const navigate = useNavigate()
  const { customers, analysisSessions, storeDataLinks } = useSession()
  const [type, setType] = useState<AnalysisType | "all">("all")

  const customer = customers.find((c) => c.dataSubjectId === dataSubjectId)
  const identity = customerIdentities.find((x) => x.dataSubjectId === dataSubjectId)
  const activeLink = storeDataLinks.find(
    (l) => l.dataSubjectId === dataSubjectId && l.status === "active"
  )
  const isB2b = usesB2bDisplay(dataSubjectId, storeDataLinks)

  const allOwnSessions = useMemo(
    () =>
      analysisSessions
        .filter((s) => s.dataSubjectId === dataSubjectId)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [analysisSessions, dataSubjectId]
  )
  /** 🔴 姿勢分析は B2B のみ。連携が無い顧客には出さない (§5.2)。 */
  const sessions = useMemo(
    () =>
      isB2b
        ? allOwnSessions
        : allOwnSessions.filter((s) => s.analysisType !== "posture"),
    [allOwnSessions, isB2b]
  )
  const hiddenPostureCount = allOwnSessions.length - sessions.length

  const shown = type === "all" ? sessions : sessions.filter((s) => s.analysisType === type)
  const countOf = (t: AnalysisType) =>
    sessions.filter((s) => s.analysisType === t).length

  if (!customer) {
    return (
      <div className="space-y-4">
        <PageHeader title="分析履歴" />
        <SpecNote>
          この顧客は現在のスコープでは閲覧できません。active な店舗連携と、その店舗の
          担当に割り当てられていることの両方が必要です。
        </SpecNote>
        <Button variant="outline" asChild>
          <Link to="/customers">
            <ArrowLeftIcon /> 顧客一覧へ
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${customer.displayName} の分析履歴`}
        titleAside={
          identity ? (
            identity.email
          ) : (
            <span className="text-xs">メールアドレスなし（未登録）</span>
          )
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono tabular-nums">{customer.displayCode}</span>
            <CustomerBadges
              customer={customer}
              linked={!!activeLink}
              className="px-1.5 py-0.5 text-[11px]"
            />
            <span className="text-xs">全 {sessions.length} 件</span>
          </span>
        }
        actions={
          <>
            <Select value={type} onValueChange={(v) => setType(v as AnalysisType | "all")}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="種別" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて ({sessions.length})</SelectItem>
                <SelectItem value="face">
                  {ANALYSIS_TYPE_LABEL.face} ({countOf("face")})
                </SelectItem>
                {isB2b ? (
                  <SelectItem value="posture">
                    {ANALYSIS_TYPE_LABEL.posture} ({countOf("posture")})
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
            <Button variant="outline" asChild>
              <Link to={`/customers/${dataSubjectId}`}>
                <ArrowLeftIcon /> 顧客詳細
              </Link>
            </Button>
          </>
        }
      />

      <Card className="py-0">
        {shown.length === 0 ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            該当する分析はありません
          </CardContent>
        ) : (
          <AnalysisHistoryTable
            sessions={shown}
            onSelect={(id) =>
              navigate(`/customers/${dataSubjectId}?session=${id}`)
            }
          />
        )}
      </Card>

      {hiddenPostureCount > 0 ? (
        <SpecNote>
          この顧客は店舗連携が有効でないため、姿勢分析 {hiddenPostureCount} 件は
          表示していません。姿勢分析は B2B のみの項目です。データ自体は保持されています。
        </SpecNote>
      ) : null}

      <SpecNote>
        「詳細」を押すと顧客詳細へ戻り、その回の指標を開きます。
        適格分析は新規撮影のみで、再解析は母数に入りません (§6)。
      </SpecNote>
    </div>
  )
}
