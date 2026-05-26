import { useState } from "react"
import { BuildingIcon, StoreIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCompanies } from "@/contexts/CompaniesContext"

const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB

const OEM_INDUSTRIES = ["美容", "フィットネス", "飲食", "KOL", "その他"] as const
const B2B_INDUSTRIES = ["IT", "製造", "金融", "サービス", "その他"] as const

// 視点 + companyId に応じた業態の初期値(mock)
function initialIndustryFor(
  type: string,
  companyId: number,
  subType: string | undefined
): string {
  if (type === "oem") {
    if (subType === "influencer") return "KOL"
    return "美容"
  }
  // b2b — mock 用に company_id ごとに業種を変える
  return companyId === 4 ? "サービス" : "IT"
}

export function CompanyProfileCard({
  type,
  companyId,
}: {
  type: "oem" | "b2b"
  companyId: number
}) {
  const { getCompany, updateCompany } = useCompanies()
  const initialCompany = getCompany(companyId)
  const initialName = initialCompany?.name ?? ""
  const initialIndustry = initialIndustryFor(
    type,
    companyId,
    initialCompany?.subType
  )

  // 「保存済」値(button の dirty 判定基準)
  const [savedName, setSavedName] = useState(initialName)
  const [savedIndustry, setSavedIndustry] = useState(initialIndustry)
  const [savedLogoUrl, setSavedLogoUrl] = useState<string>("")

  // 現在編集中の値
  const [name, setName] = useState(initialName)
  const [industry, setIndustry] = useState(initialIndustry)
  const [logoUrl, setLogoUrl] = useState<string>("")

  const isDirty =
    name !== savedName ||
    industry !== savedIndustry ||
    logoUrl !== savedLogoUrl

  const industries = type === "oem" ? OEM_INDUSTRIES : B2B_INDUSTRIES
  const nameLabel = type === "oem" ? "店舗名 / KOL 名" : "企業名"
  const namePlaceholder =
    type === "oem" ? "例:店舗A 美容サロン" : "例:企業X 株式会社"
  const description =
    type === "oem"
      ? "自社の基本情報(店舗・KOL 用)"
      : "自社の基本情報(企業用)"
  const PlaceholderIcon = type === "oem" ? StoreIcon : BuildingIcon

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください")
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("画像は 2MB 以下を選択してください")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLogoUrl(reader.result as string)
    }
    reader.onerror = () => {
      toast.error("画像の読み込みに失敗しました")
    }
    reader.readAsDataURL(file)
  }

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(`${nameLabel}を入力してください`)
      return
    }
    // Context 経由で更新 → Dashboard / Sidebar 等の他画面にも反映
    updateCompany(companyId, { name: trimmed })
    setName(trimmed)
    setSavedName(trimmed)
    setSavedIndustry(industry)
    setSavedLogoUrl(logoUrl)
    toast.success("保存しました")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>自社プロフィール</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ロゴ */}
        <div className="grid gap-2">
          <label className="text-sm font-medium">ロゴ</label>
          <div className="flex items-center gap-4">
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${name} のロゴ`}
                  className="size-full object-cover"
                />
              ) : (
                <PlaceholderIcon className="size-10 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <label className="cursor-pointer">
                  画像を選択
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
              </Button>
              {logoUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLogoUrl("")}
                >
                  削除
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            PNG / JPEG、最大 2MB
          </p>
        </div>

        {/* 名前 */}
        <div className="grid gap-2">
          <label
            htmlFor="company-name"
            className="text-sm font-medium"
          >
            {nameLabel}
          </label>
          <Input
            id="company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
          />
        </div>

        {/* 業態 */}
        <div className="grid gap-2">
          <label htmlFor="company-industry" className="text-sm font-medium">
            業態
          </label>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger id="company-industry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {industries.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button onClick={handleSave} size="sm" disabled={!isDirty}>
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
