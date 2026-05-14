import { Navigate, useSearchParams } from "react-router-dom"

import { getCompany } from "@/lib/mock-data/companies"

export default function StatusPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"

  // b2b はプラン変更履歴 = 個別社員の課金状態であり、商業意義が無く規格にも記載無いため非表示
  if (type === "b2b") return <Navigate to="/dashboard" replace />

  const companyIdRaw = searchParams.get("company_id")
  const companyId = companyIdRaw != null ? Number(companyIdRaw) : 0
  const company = type === "oem" ? getCompany(companyId) : null

  const subtitle =
    type === "admin"
      ? "全提供先の会員ステータス履歴とプラン変更ログ"
      : `${company?.name ?? "—"} の会員ステータス履歴`

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ステータス</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* TODO Day 8: 4 KPI stat cards(チャーン率、純増、平均継続期間、現在構成)*/}
      {/* TODO Day 8: プラン構成 推移 chart(stacked area / line × 3) */}
      {/* TODO Day 8: プラン変更ログ table */}
      {/* TODO Day 8 optional: migration matrix */}
    </div>
  )
}
