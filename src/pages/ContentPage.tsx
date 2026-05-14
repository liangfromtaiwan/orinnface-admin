import { useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { getCompany } from "@/lib/mock-data/companies"

export default function ContentPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"
  const companyIdRaw = searchParams.get("company_id")
  const companyId = companyIdRaw != null ? Number(companyIdRaw) : 0
  const company = type !== "admin" ? getCompany(companyId) : null

  const subtitle = (() => {
    if (type === "admin") return "全提供先における動画利用状況"
    if (type === "oem")
      return `${company?.name ?? "—"} 自社ユーザーの動画利用`
    return `${company?.name ?? "—"} 員工の動画利用(集計のみ)`
  })()

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            コンテンツ分析
          </h1>
          {type === "b2b" && (
            <Badge variant="outline">BtoB 集計(個人情報非表示)</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* TODO Day 7 #7: 4 KPI stat cards */}
      {/* TODO Day 7 #7: 人気動画 ranking table */}
      {/* TODO Day 8: 動画尺別 完遂率 bar chart */}
      {/* TODO Day 8 optional: カテゴリ別 完遂率 chart */}
    </div>
  )
}
