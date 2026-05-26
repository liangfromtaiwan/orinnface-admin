import { useState } from "react"
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
import { Switch } from "@/components/ui/switch"

const NOTIFICATION_METHODS = ["メール", "Slack", "Web 通知"] as const
type NotificationMethod = (typeof NOTIFICATION_METHODS)[number]

// ─────────────────────────────────────────────────────────────
// admin:event 別通知(enabled + method)
// ─────────────────────────────────────────────────────────────

type AdminEvent = {
  key: string
  label: string
  defaultEnabled: boolean
  defaultMethod: NotificationMethod
}

const ADMIN_EVENTS: AdminEvent[] = [
  { key: "new_user", label: "新規ユーザー登録時", defaultEnabled: true, defaultMethod: "メール" },
  { key: "premium_signup", label: "Premium 課金時", defaultEnabled: true, defaultMethod: "Slack" },
  { key: "premium_cancel", label: "Premium 解約時", defaultEnabled: true, defaultMethod: "Slack" },
  { key: "anomaly", label: "異常検知時(主観 vs AI 大乖離)", defaultEnabled: true, defaultMethod: "メール" },
  { key: "monthly_report", label: "月次レポート", defaultEnabled: true, defaultMethod: "メール" },
  { key: "security", label: "セキュリティ警告", defaultEnabled: true, defaultMethod: "メール" },
]

type AdminEventState = { enabled: boolean; method: NotificationMethod }
type AdminSettings = Record<string, AdminEventState>

function buildInitialAdminSettings(): AdminSettings {
  return Object.fromEntries(
    ADMIN_EVENTS.map((e) => [
      e.key,
      { enabled: e.defaultEnabled, method: e.defaultMethod },
    ])
  )
}

function AdminNotifications() {
  const [saved, setSaved] = useState<AdminSettings>(buildInitialAdminSettings)
  const [current, setCurrent] = useState<AdminSettings>(buildInitialAdminSettings)

  const isDirty = JSON.stringify(saved) !== JSON.stringify(current)

  function updateEvent(key: string, patch: Partial<AdminEventState>) {
    setCurrent((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }))
  }

  function handleSave() {
    setSaved(current)
    toast.success("保存しました")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知設定</CardTitle>
        <CardDescription>
          システム event 別の通知 ON / OFF と配信方法
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ADMIN_EVENTS.map((e) => {
          const state = current[e.key]
          return (
            <div
              key={e.key}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <label className="text-sm font-medium">{e.label}</label>
              <div className="flex items-center gap-3">
                <Select
                  value={state.method}
                  onValueChange={(v) =>
                    updateEvent(e.key, { method: v as NotificationMethod })
                  }
                  disabled={!state.enabled}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Switch
                  checked={state.enabled}
                  onCheckedChange={(enabled) =>
                    updateEvent(e.key, { enabled })
                  }
                  aria-label={`${e.label} の通知`}
                />
              </div>
            </div>
          )
        })}
        <div className="flex justify-end border-t pt-4">
          <Button onClick={handleSave} size="sm" disabled={!isDirty}>
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// oem:自社ユーザー要注目時の通知(toggle のみ)
// ─────────────────────────────────────────────────────────────

const OEM_EVENTS: { key: string; label: string; defaultEnabled: boolean }[] = [
  { key: "anomaly", label: "主観 vs AI 大乖離の検知時", defaultEnabled: true },
  { key: "inactive", label: "連続不利用ユーザー検知時(7 日以上)", defaultEnabled: true },
  { key: "new_user", label: "自社の新規ユーザー登録時", defaultEnabled: false },
  { key: "monthly_report", label: "月次レポート", defaultEnabled: true },
]

type OemSettings = Record<string, boolean>

function buildInitialOemSettings(): OemSettings {
  return Object.fromEntries(OEM_EVENTS.map((e) => [e.key, e.defaultEnabled]))
}

function OemNotifications() {
  const [saved, setSaved] = useState<OemSettings>(buildInitialOemSettings)
  const [current, setCurrent] = useState<OemSettings>(buildInitialOemSettings)

  const isDirty = JSON.stringify(saved) !== JSON.stringify(current)

  function toggleEvent(key: string, enabled: boolean) {
    setCurrent((prev) => ({ ...prev, [key]: enabled }))
  }

  function handleSave() {
    setSaved(current)
    toast.success("保存しました")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知設定</CardTitle>
        <CardDescription>
          自社ユーザーが要注意状態になった時の通知(メール送信)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {OEM_EVENTS.map((e) => (
          <div
            key={e.key}
            className="flex items-center justify-between gap-3"
          >
            <label className="text-sm font-medium">{e.label}</label>
            <Switch
              checked={current[e.key]}
              onCheckedChange={(enabled) => toggleEvent(e.key, enabled)}
              aria-label={`${e.label} の通知`}
            />
          </div>
        ))}
        <div className="flex justify-end border-t pt-4">
          <Button onClick={handleSave} size="sm" disabled={!isDirty}>
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// b2b:集計値が閾値を超えた時のみ通知(個人特定情報なし)
// ─────────────────────────────────────────────────────────────

type B2BSettings = {
  fatigueEnabled: boolean
  fatigueThreshold: string // 0.0 - 5.0
  utilizationEnabled: boolean
  utilizationThreshold: string // %
  improvementEnabled: boolean
  improvementThreshold: string // %
  monthlyReport: boolean
}

const B2B_INITIAL: B2BSettings = {
  fatigueEnabled: true,
  fatigueThreshold: "3.5",
  utilizationEnabled: true,
  utilizationThreshold: "60",
  improvementEnabled: false,
  improvementThreshold: "30",
  monthlyReport: true,
}

function B2BNotifications() {
  const [saved, setSaved] = useState<B2BSettings>(B2B_INITIAL)
  const [current, setCurrent] = useState<B2BSettings>(B2B_INITIAL)

  const isDirty = JSON.stringify(saved) !== JSON.stringify(current)

  function update<K extends keyof B2BSettings>(key: K, value: B2BSettings[K]) {
    setCurrent((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    // 簡易バリデーション
    if (current.fatigueEnabled) {
      const n = Number(current.fatigueThreshold)
      if (isNaN(n) || n < 0 || n > 5) {
        toast.error("疲労度の閾値は 0.0〜5.0 の範囲で入力してください")
        return
      }
    }
    if (current.utilizationEnabled) {
      const n = Number(current.utilizationThreshold)
      if (isNaN(n) || n < 0 || n > 100) {
        toast.error("利用率の閾値は 0〜100 の範囲で入力してください")
        return
      }
    }
    if (current.improvementEnabled) {
      const n = Number(current.improvementThreshold)
      if (isNaN(n) || n < 0 || n > 100) {
        toast.error("改善率の閾値は 0〜100 の範囲で入力してください")
        return
      }
    }
    setSaved(current)
    toast.success("保存しました")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知設定</CardTitle>
        <CardDescription>
          集計値が閾値を超えた時のみ通知。個別ユーザーの通知は行いません(集計のみ)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 疲労度 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">
              全体疲労度平均が
            </label>
            <Input
              type="number"
              step="0.1"
              min={0}
              max={5}
              value={current.fatigueThreshold}
              onChange={(e) => update("fatigueThreshold", e.target.value)}
              disabled={!current.fatigueEnabled}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              以上で通知
            </span>
          </div>
          <Switch
            checked={current.fatigueEnabled}
            onCheckedChange={(v) => update("fatigueEnabled", v)}
            aria-label="疲労度通知"
          />
        </div>

        {/* 利用率 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">
              利用率が
            </label>
            <Input
              type="number"
              step="1"
              min={0}
              max={100}
              value={current.utilizationThreshold}
              onChange={(e) => update("utilizationThreshold", e.target.value)}
              disabled={!current.utilizationEnabled}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              % 以下で通知
            </span>
          </div>
          <Switch
            checked={current.utilizationEnabled}
            onCheckedChange={(v) => update("utilizationEnabled", v)}
            aria-label="利用率通知"
          />
        </div>

        {/* 改善率 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">
              改善率が
            </label>
            <Input
              type="number"
              step="1"
              min={0}
              max={100}
              value={current.improvementThreshold}
              onChange={(e) => update("improvementThreshold", e.target.value)}
              disabled={!current.improvementEnabled}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              % 未満で通知
            </span>
          </div>
          <Switch
            checked={current.improvementEnabled}
            onCheckedChange={(v) => update("improvementEnabled", v)}
            aria-label="改善率通知"
          />
        </div>

        {/* 月次レポート */}
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <label className="text-sm font-medium">月次レポートを受信</label>
          <Switch
            checked={current.monthlyReport}
            onCheckedChange={(v) => update("monthlyReport", v)}
            aria-label="月次レポート"
          />
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

// ─────────────────────────────────────────────────────────────
// 視点ルーター
// ─────────────────────────────────────────────────────────────

export function NotificationCard({ type }: { type: string }) {
  if (type === "oem") return <OemNotifications />
  if (type === "b2b") return <B2BNotifications />
  return <AdminNotifications />
}
