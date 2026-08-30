import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { useSession } from "@/contexts/session-context"
import { canAccessScreen, visibleScreens, type ScreenKey } from "@/lib/domain/scope"

/**
 * ロールのスコープ外の画面へ入らせない。
 *
 * 🔴 これは表示制御であってアクセス制御ではない。
 *    実データは API 側で membership / store_data_link / scope を再検証すること。
 */
export default function RequireScreen({
  screen,
  children,
}: {
  screen: ScreenKey
  children: ReactNode
}) {
  const { scope } = useSession()
  if (canAccessScreen(scope, screen)) return <>{children}</>

  const fallback = visibleScreens(scope)[0]
  return <Navigate to={fallback ? `/${fallback}` : "/account"} replace />
}
