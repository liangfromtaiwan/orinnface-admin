/**
 * アカウント (仕様書 v1.0 §2)
 *
 * role は accounts の単一列ではなく membership で保持する。
 * 🔴 operator / company_admin / store_admin は 2FA 必須。
 */

import { PageHeader, SpecNote } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession, useStoreName } from "@/contexts/session-context"
import { ROLE_LABEL, ROLE_REQUIRES_2FA } from "@/lib/domain/types"
import { companies } from "@/lib/mock/seed"

export default function AccountPage() {
  const { account, scope } = useSession()
  const storeName = useStoreName()
  const needs2fa = ROLE_REQUIRES_2FA[scope.role]

  return (
    <div className="space-y-4">
      <PageHeader title="アカウント" description={account.email} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">実効スコープ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            ロール: {ROLE_LABEL[scope.role]}
            {scope.crossCompany ? "(全会社・全店舗を横断)" : ""}
          </div>
          {scope.companyId ? (
            <div>
              会社:{" "}
              {companies.find((c) => c.id === scope.companyId)?.name ?? scope.companyId}
            </div>
          ) : null}
          {scope.storeIds.length > 0 ? (
            <div>店舗: {scope.storeIds.map((id) => storeName(id)).join(" / ")}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">membership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {account.organizationMemberships.map((m) => (
            <div key={`${m.companyId}-${m.role}`}>
              {companies.find((c) => c.id === m.companyId)?.name ?? m.companyId} —{" "}
              {ROLE_LABEL[m.role]}
            </div>
          ))}
          {account.storeMemberships.map((m) => (
            <div key={`${m.storeId}-${m.role}`}>
              {storeName(m.storeId)} — {ROLE_LABEL[m.role]}
            </div>
          ))}
          {account.organizationMemberships.length === 0 &&
          account.storeMemberships.length === 0 ? (
            <span className="text-muted-foreground">membership がありません</span>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            2要素認証
            <Badge variant={account.twoFactorEnabled ? "outline" : "destructive"}>
              {account.twoFactorEnabled ? "設定済" : "未設定"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {needs2fa
            ? "このロールでは 2要素認証が必須です。"
            : "このロールでは任意です(初期 OFF)。"}
        </CardContent>
      </Card>

      <SpecNote>
        一部の店舗だけを管理する担当者には、対象店舗ごとに店舗管理者の membership を
        複数付与します。固定のエリア管理者ロールは追加しません。画面の表示・非表示だけを
        権限制御にせず、API query のたびに membership・店舗連携・対象スコープを検証します。
      </SpecNote>
    </div>
  )
}
