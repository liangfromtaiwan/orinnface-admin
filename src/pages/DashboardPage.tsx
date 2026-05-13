import { useSearchParams } from "react-router-dom"

import { AdminDashboard } from "@/components/AdminDashboard"
import { B2BDashboard } from "@/components/B2BDashboard"
import { OEMDashboard } from "@/components/OEMDashboard"

export default function DashboardPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"

  if (type === "b2b") return <B2BDashboard />
  if (type === "oem") return <OEMDashboard />
  return <AdminDashboard />
}
