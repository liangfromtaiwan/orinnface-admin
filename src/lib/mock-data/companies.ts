import type { Company } from "./types"

export const companies: Company[] = [
  {
    id: 0,
    name: "OrinnME運営",
    type: "admin",
    subType: "operator",
    createdAt: "2024-01-15",
  },
  {
    id: 1,
    name: "店舗A 美容サロン",
    type: "oem",
    subType: "shop",
    createdAt: "2024-06-01",
  },
  {
    id: 2,
    name: "Yumi(美容 KOL)",
    type: "oem",
    subType: "influencer",
    createdAt: "2024-09-10",
  },
  {
    id: 3,
    name: "企業X 株式会社",
    type: "b2b",
    subType: "company",
    createdAt: "2025-02-20",
  },
  {
    id: 4,
    name: "企業Y 株式会社",
    type: "b2b",
    subType: "company",
    createdAt: "2025-08-05",
  },
]

export function getCompany(id: number): Company | undefined {
  return companies.find((c) => c.id === id)
}
