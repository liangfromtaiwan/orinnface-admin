import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

// アカウント section の「プロフィール」を SettingsPage → Sidebar 等の
// 全 UI consumer に反映させるための React Context。
// 視点 + companyId(key)ごとに別プロフィールを管理し、
// セッション内で保存 → サイドバーが即時更新される。
// 本番では同等の責務を backend(/me endpoint)が担う。

export type UserProfile = {
  name: string
  displayName: string
  email: string
  avatarUrl: string
}

type UserProfilesContextValue = {
  getProfile: (key: string) => UserProfile
  updateProfile: (key: string, updates: Partial<UserProfile>) => void
}

// 視点 + companyId に応じたデフォルトプロフィール(mock 用)。
// 真實実装では JWT claim + /me API から取得する。
export function defaultProfileFor(key: string): UserProfile {
  const [type, idStr] = key.split(":")
  const companyId = Number(idStr)
  if (type === "oem") {
    if (companyId === 2) {
      return {
        name: "Yumi",
        displayName: "Yumi",
        email: "yumi@orinnme-partner.jp",
        avatarUrl: "",
      }
    }
    return {
      name: "山田 健太",
      displayName: "山田",
      email: "kenta@shop-a.jp",
      avatarUrl: "",
    }
  }
  if (type === "b2b") {
    if (companyId === 4) {
      return {
        name: "佐藤 美穂",
        displayName: "佐藤",
        email: "miho.sato@kigyo-y.jp",
        avatarUrl: "",
      }
    }
    return {
      name: "鈴木 一郎",
      displayName: "鈴木",
      email: "ichiro.suzuki@kigyo-x.jp",
      avatarUrl: "",
    }
  }
  return {
    name: "OrinnME 田中",
    displayName: "田中",
    email: "tanaka@orinnme.jp",
    avatarUrl: "",
  }
}

const UserProfilesContext = createContext<UserProfilesContextValue | null>(null)

export function UserProfilesProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})

  const getProfile = useCallback(
    (key: string): UserProfile => {
      return profiles[key] ?? defaultProfileFor(key)
    },
    [profiles]
  )

  const updateProfile = useCallback(
    (key: string, updates: Partial<UserProfile>) => {
      setProfiles((prev) => {
        const current = prev[key] ?? defaultProfileFor(key)
        return { ...prev, [key]: { ...current, ...updates } }
      })
    },
    []
  )

  const value = useMemo(
    () => ({ getProfile, updateProfile }),
    [getProfile, updateProfile]
  )

  return (
    <UserProfilesContext.Provider value={value}>
      {children}
    </UserProfilesContext.Provider>
  )
}

export function useUserProfiles(): UserProfilesContextValue {
  const ctx = useContext(UserProfilesContext)
  if (!ctx) {
    throw new Error("useUserProfiles must be used inside <UserProfilesProvider>")
  }
  return ctx
}
