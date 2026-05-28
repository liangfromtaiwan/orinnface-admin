import { useSearchParams } from "react-router-dom"

import { CompanyProfileCard } from "@/components/CompanyProfileCard"
import { MembersCard } from "@/components/MembersCard"
import { NotificationCard } from "@/components/NotificationCard"
import { PlanCard } from "@/components/PlanCard"
import { ProvidersCard } from "@/components/ProvidersCard"
import { VideoCatalogCard } from "@/components/VideoCatalogCard"

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"
  const companyId = Number(searchParams.get("company_id") ?? 0)
  const profileKey = `${type}:${companyId}`

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          組織 / システムレベルの設定。個人のアカウント情報は「アカウント」画面で変更できます。
        </p>
      </div>

      {/* メンバー管理 section(視点別の Role 階層) */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">メンバー管理</h2>
        <MembersCard type={type} companyId={companyId} />
      </section>

      {/* 自社プロフィール section(OEM / BtoB のみ表示。admin は規格上不要) */}
      {(type === "oem" || type === "b2b") && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">自社プロフィール</h2>
          <CompanyProfileCard
            key={`company-${profileKey}`}
            type={type}
            companyId={companyId}
          />
        </section>
      )}

      {/* 提供先管理 section(admin のみ表示) */}
      {type === "admin" && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">提供先管理</h2>
          <ProvidersCard />
        </section>
      )}

      {/* 動画 catalog section(admin のみ表示) */}
      {type === "admin" && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">動画 catalog</h2>
          <VideoCatalogCard />
        </section>
      )}

      {/* 通知設定 section(全 3 視角、内容が異なる) */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">通知設定</h2>
        <NotificationCard type={type} />
      </section>

      {/* プラン / 請求 section(OEM / BtoB のみ。admin は規格上不要) */}
      {(type === "oem" || type === "b2b") && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">プラン / 請求</h2>
          <PlanCard type={type} />
        </section>
      )}
    </div>
  )
}
