import { useState } from "react"
import { CheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Plan = {
  id: string
  name: string
  priceJpy: number | null // null = お問い合わせ
  limit: string // ユーザー上限などの説明
}

const OEM_PLANS: Plan[] = [
  { id: "basic", name: "ベーシック プラン", priceJpy: 9800, limit: "最大 100 ユーザー" },
  { id: "standard", name: "スタンダード プラン", priceJpy: 24800, limit: "最大 500 ユーザー" },
  { id: "professional", name: "プロフェッショナル プラン", priceJpy: 58000, limit: "ユーザー数無制限" },
]

const B2B_PLANS: Plan[] = [
  { id: "standard", name: "スタンダード プラン", priceJpy: 48000, limit: "最大 50 名" },
  { id: "enterprise", name: "エンタープライズ プラン", priceJpy: 120000, limit: "最大 500 名" },
  { id: "custom", name: "カスタム プラン", priceJpy: null, limit: "お問い合わせ" },
]

const OEM_CURRENT_PLAN_ID = "standard"
const B2B_CURRENT_PLAN_ID = "standard"

type Invoice = {
  id: string
  date: string // YYYY-MM-DD
  amount: number
  status: "支払済み" | "処理中"
}

function buildInvoices(monthlyAmount: number): Invoice[] {
  // 過去 6 ヶ月の請求履歴を mock 生成
  return [
    { id: "inv-202604", date: "2026-04-15", amount: monthlyAmount, status: "支払済み" },
    { id: "inv-202603", date: "2026-03-15", amount: monthlyAmount, status: "支払済み" },
    { id: "inv-202602", date: "2026-02-15", amount: monthlyAmount, status: "支払済み" },
    { id: "inv-202601", date: "2026-01-15", amount: monthlyAmount, status: "支払済み" },
    { id: "inv-202512", date: "2025-12-15", amount: monthlyAmount, status: "支払済み" },
    { id: "inv-202511", date: "2025-11-15", amount: monthlyAmount, status: "支払済み" },
  ]
}

function formatJpy(amount: number | null): string {
  if (amount === null) return "お問い合わせ"
  return `¥${amount.toLocaleString("ja-JP")} / 月`
}

export function PlanCard({ type }: { type: "oem" | "b2b" }) {
  const plans = type === "oem" ? OEM_PLANS : B2B_PLANS
  const currentPlanId =
    type === "oem" ? OEM_CURRENT_PLAN_ID : B2B_CURRENT_PLAN_ID
  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? plans[0]
  const description =
    type === "oem"
      ? "契約プランの確認・変更、請求履歴(店舗管理者向け)"
      : "契約プランの確認・変更、請求履歴(契約管理者向け)"

  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [invoicesOpen, setInvoicesOpen] = useState(false)

  function handleSelectPlan(plan: Plan) {
    if (plan.id === currentPlanId) {
      toast.info("現在のプランです")
      return
    }
    if (plan.priceJpy === null) {
      toast.success("お問い合わせフォームに移動します(mock)")
    } else {
      toast.success(`${plan.name} への変更リクエストを送信しました`)
    }
    setPlanDialogOpen(false)
  }

  function handleDownloadInvoice(inv: Invoice) {
    toast.success(`${inv.id} の PDF をダウンロード開始しました(mock)`)
  }

  const invoices =
    currentPlan.priceJpy !== null ? buildInvoices(currentPlan.priceJpy) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>プラン / 請求</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 現プラン */}
        <div className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-medium">{currentPlan.name}</span>
                <Badge variant="default">現プラン</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentPlan.limit}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold tabular-nums">
                {formatJpy(currentPlan.priceJpy)}
              </div>
              <div className="text-xs text-muted-foreground">
                次回更新日:2026-05-15
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* プラン変更 Dialog */}
          <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
            <Button variant="outline" size="sm" onClick={() => setPlanDialogOpen(true)}>
              プラン変更
            </Button>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>プラン変更</DialogTitle>
                <DialogDescription>
                  変更内容は次回更新日(2026-05-15)から適用されます。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                {plans.map((p) => {
                  const isCurrent = p.id === currentPlanId
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4",
                        isCurrent && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          {isCurrent && (
                            <Badge variant="default" className="gap-1">
                              <CheckIcon className="size-3" />
                              現プラン
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {p.limit}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums">
                          {formatJpy(p.priceJpy)}
                        </span>
                        <Button
                          size="sm"
                          variant={isCurrent ? "outline" : "default"}
                          disabled={isCurrent}
                          onClick={() => handleSelectPlan(p)}
                        >
                          {isCurrent ? "選択中" : "選択"}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
                  閉じる
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 請求書履歴 Dialog */}
          <Dialog open={invoicesOpen} onOpenChange={setInvoicesOpen}>
            <Button variant="outline" size="sm" onClick={() => setInvoicesOpen(true)}>
              請求書履歴
            </Button>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>請求書履歴</DialogTitle>
                <DialogDescription>
                  過去 6 ヶ月分の請求情報
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                {invoices.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    請求履歴がありません
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>請求番号</TableHead>
                        <TableHead>日付</TableHead>
                        <TableHead className="text-right">金額</TableHead>
                        <TableHead>ステータス</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs">
                            {inv.id}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {inv.date}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ¥{inv.amount.toLocaleString("ja-JP")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                inv.status === "支払済み" ? "secondary" : "outline"
                              }
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadInvoice(inv)}
                            >
                              PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInvoicesOpen(false)}>
                  閉じる
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
