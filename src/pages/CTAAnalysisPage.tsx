import { Navigate, useSearchParams } from "react-router-dom"

export default function CTAAnalysisPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"

  // b2b は個人情報非開示のため CTA 個別効果分析は非表示
  if (type === "b2b") return <Navigate to="/dashboard" replace />

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">CTA 効果分析</h1>
      <p className="text-sm text-muted-foreground">
        過去 30 日のコンバージョン分析
      </p>
      <p className="text-sm text-muted-foreground pt-8">
        実装中...(Phase 2 KPI Card + Table 予定)
      </p>
    </div>
  )
}
