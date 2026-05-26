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
type CompaniesContextValue = {
  companies: Company[]
  getCompany: (id: number) => Company | undefined
  updateCompany: (id: number, updates: Partial<Pick<Company, "name">>) => void
}

const CompaniesContext = createContext<CompaniesContextValue | null>(null)

export function CompaniesProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(() => [
    ...initialCompanies,
  ])

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

  const value = useMemo(
    () => ({ companies, getCompany, updateCompany }),
    [companies, getCompany, updateCompany]
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
