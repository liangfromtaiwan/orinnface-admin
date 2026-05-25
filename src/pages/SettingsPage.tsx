import {
  BellIcon,
  Building2Icon,
  BuildingIcon,
  CreditCardIcon,
  StoreIcon,
  UserIcon,
  UsersIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type SettingsSection = {
  icon: LucideIcon
  title: string
  description: string
}

const ADMIN_SECTIONS: SettingsSection[] = [
  {
    icon: UserIcon,
    title: "アカウント",
    description: "プロフィール / メール変更 / パスワード変更",
  },
  {
    icon: UsersIcon,
    title: "メンバー管理",
    description: "社内メンバー(Owner / Admin / Viewer)の招待・権限管理",
  },
  {
    icon: Building2Icon,
    title: "提供先管理",
    description: "OEM / BtoB クライアントの追加・停止・プラン変更",
  },
  {
    icon: VideoIcon,
    title: "動画 catalog",
    description: "動画の追加・編集・カテゴリ管理",
  },
  {
    icon: BellIcon,
    title: "通知設定",
    description: "システム event 別の通知 ON / OFF",
  },
]

const OEM_SECTIONS: SettingsSection[] = [
  {
    icon: UserIcon,
    title: "アカウント",
    description: "プロフィール / メール変更 / パスワード変更",
  },
  {
    icon: UsersIcon,
    title: "メンバー管理",
    description: "店舗 / KOL スタッフ(管理者 / メンバー)の招待・権限管理",
  },
  {
    icon: StoreIcon,
    title: "自社プロフィール",
    description: "店舗名 / ロゴ / 業態などの基本情報",
  },
  {
    icon: BellIcon,
    title: "通知設定",
    description: "自社ユーザーが要注意状態になった時の通知",
  },
  {
    icon: CreditCardIcon,
    title: "プラン / 請求",
    description: "契約プランの確認・変更、請求履歴",
  },
]

const B2B_SECTIONS: SettingsSection[] = [
  {
    icon: UserIcon,
    title: "アカウント",
    description: "プロフィール / メール変更 / パスワード変更",
  },
  {
    icon: UsersIcon,
    title: "メンバー管理",
    description: "HR チーム(管理者 / メンバー)の招待・権限管理",
  },
  {
    icon: BuildingIcon,
    title: "自社プロフィール",
    description: "企業名 / ロゴ / 業態などの基本情報",
  },
  {
    icon: BellIcon,
    title: "通知設定",
    description: "集計値が閾値を超えた時のみ通知(個人特定情報は含まない)",
  },
  {
    icon: CreditCardIcon,
    title: "プラン / 請求",
    description: "契約プランの確認・変更、請求履歴",
  },
]

function sectionsForType(type: string): SettingsSection[] {
  if (type === "oem") return OEM_SECTIONS
  if (type === "b2b") return B2B_SECTIONS
  return ADMIN_SECTIONS
}

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get("type") ?? "admin"
  const sections = sectionsForType(type)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          v2 で順次実装予定
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon
          return (
            <Card
              key={s.title}
              aria-disabled
              className="cursor-not-allowed opacity-70 transition-colors"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-muted p-2">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-base">{s.title}</CardTitle>
                      <CardDescription>{s.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    v2 で実装予定
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </section>
    </div>
  )
}
