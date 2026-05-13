import { useSearchParams } from "react-router-dom"

import { AdminDashboard } from "@/components/AdminDashboard"
import { B2BDashboard } from "@/components/B2BDashboard"

export default function DashboardPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"

  if (type === "b2b") return <B2BDashboard />
  // type=oem は Day 5 に専用 OEMDashboard を追加するまで Admin にフォールバック
  return <AdminDashboard />
}
