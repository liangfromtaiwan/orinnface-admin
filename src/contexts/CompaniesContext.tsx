import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { companies as initialCompanies } from "@/lib/mock-data/companies"
import type { Company } from "@/lib/mock-data/types"

// SettingsPage の「自社プロフィール」変更を Dashboard / Sidebar 等の
// 全 UI consumer に反映させるための React Context。
// mock-data の元配列は変更せず、Context 上で copy を保持して mutate する。
// 本番では同等の責務を backend(/companies endpoint)が担う。

// Company 型に無い拡張属性(logo / industry)は会社 ID をキーに別管理。
export type CompanyExtra = {
  logoUrl: string
  industry: string
}

function defaultExtraFor(company: Company): CompanyExtra {
  if (company.type === "oem") {
    return {
      logoUrl: "",
      industry: company.subType === "influencer" ? "KOL" : "美容",
    }
  }
  if (company.type === "b2b") {
    return {
      logoUrl: "",
      industry: company.id === 4 ? "サービス" : "IT",
    }
  }
  return { logoUrl: "", industry: "" }
}

type CompaniesContextValue = {
  companies: Company[]
  getCompany: (id: number) => Company | undefined
  updateCompany: (id: number, updates: Partial<Pick<Company, "name">>) => void
  getCompanyExtra: (id: number) => CompanyExtra
  updateCompanyExtra: (id: number, updates: Partial<CompanyExtra>) => void
}

const CompaniesContext = createContext<CompaniesContextValue | null>(null)

export function CompaniesProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(() => [
    ...initialCompanies,
  ])
  const [extras, setExtras] = useState<Record<number, CompanyExtra>>({})

  const getCompany = useCallback(
    (id: number) => companies.find((c) => c.id === id),
    [companies]
  )

  const updateCompany = useCallback(
    (id: number, updates: Partial<Pick<Company, "name">>) => {
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      )
    },
    []
  )

  const getCompanyExtra = useCallback(
    (id: number): CompanyExtra => {
      const stored = extras[id]
      if (stored) return stored
      const c = companies.find((x) => x.id === id)
      return c ? defaultExtraFor(c) : { logoUrl: "", industry: "" }
    },
    [companies, extras]
  )

  const updateCompanyExtra = useCallback(
    (id: number, updates: Partial<CompanyExtra>) => {
      setExtras((prev) => {
        const c = companies.find((x) => x.id === id)
        const current = prev[id] ?? (c ? defaultExtraFor(c) : { logoUrl: "", industry: "" })
        return { ...prev, [id]: { ...current, ...updates } }
      })
    },
    [companies]
  )

  const value = useMemo(
    () => ({
      companies,
      getCompany,
      updateCompany,
      getCompanyExtra,
      updateCompanyExtra,
    }),
    [companies, getCompany, updateCompany, getCompanyExtra, updateCompanyExtra]
  )

  return (
    <CompaniesContext.Provider value={value}>
      {children}
    </CompaniesContext.Provider>
  )
}

export function useCompanies(): CompaniesContextValue {
  const ctx = useContext(CompaniesContext)
  if (!ctx) {
    throw new Error("useCompanies must be used inside <CompaniesProvider>")
  }
  return ctx
}
