/**
 * 企業・店舗の追加と編集 (吉田さん確定 2026-09-24)
 *
 * > 企業・店舗は、V1では本部が管理画面から追加します。
 *
 * 🔴 追加・編集できるのは**本部だけ**。可否は `decideCreateCompany()` /
 *    `decideCreateStore()` の 1 箇所で決める。
 * 🔴 解約・一時停止は**消すのではなく状態を変える**。顧客・分析履歴・同意・
 *    保存期限を作り直さないため (§2)。削除は用意しない。
 * 🔴 企業を解約・停止すると、配下の店舗もまとめて止まる。店舗だけ動いたままだと
 *    契約が切れているのに撮影できてしまう。
 * 🔴 企業管理者・店舗の担当者は**メールで招待**する。招待された方が登録・ログイン
 *    するまでアカウントは使えない(パスワードはこちらで設定しない)。
 */

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { ReasonField } from "@/components/ReasonField"
import { isReasonEnough } from "@/components/reason-rules"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSession } from "@/contexts/session-context"
import {
  ORG_DENIAL_LABEL,
  canEditOrganizations,
  decideCreateCompany,
  decideCreateStore,
} from "@/lib/domain/organizations"
import { isEmailLike } from "@/lib/domain/scope"
import {
  CONTRACT_STATUS_LABEL,
  type Company,
  type Store,
} from "@/lib/domain/types"

const STORE_STATUS_LABEL: Record<Store["status"], string> = {
  active: "営業中",
  closed: "閉店",
}

type DraftStore = { name: string; status: Store["status"]; managerEmail: string }

/* ------------------------------------------------------------------ *
 * 新規追加
 * ------------------------------------------------------------------ */

export function CreateOrganizationDialog() {
  const { scope, companies, createCompany, inviteMember } = useSession()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [status, setStatus] = useState<Company["contractStatus"]>("active")
  const [draftStores, setDraftStores] = useState<DraftStore[]>([
    { name: "", status: "active", managerEmail: "" },
  ])

  if (!canEditOrganizations(scope)) return null

  const decision = decideCreateCompany(scope, companies, name)
  const filledStores = draftStores.filter((s) => s.name.trim())
  const badEmail =
    (adminEmail.trim() && !isEmailLike(adminEmail)) ||
    filledStores.some((s) => s.managerEmail.trim() && !isEmailLike(s.managerEmail))
  const ready = decision.kind === "allowed" && !badEmail

  function reset() {
    setName("")
    setAdminEmail("")
    setStatus("active")
    setDraftStores([{ name: "", status: "active", managerEmail: "" }])
  }

  function submit() {
    const companyId = createCompany({
      name,
      contractStatus: status,
      stores: filledStores.map((s) => ({ name: s.name, status: s.status })),
    })
    // 🔴 招待は担当ごと。企業管理者は企業に、店舗の担当者はその店舗に付ける
    if (adminEmail.trim()) {
      inviteMember(
        adminEmail.trim(),
        "",
        { kind: "company", companyId, role: "company_admin" },
        `企業「${name.trim()}」の追加に伴う企業管理者の招待`
      )
    }
    toast.success(`企業「${name.trim()}」を追加しました`, {
      description:
        filledStores.length > 0 ? `店舗 ${filledStores.length} 件も追加しました` : undefined,
    })
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon /> 企業・店舗を追加
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>企業・店舗を追加</DialogTitle>
          <DialogDescription>
            単店舗の契約でも、内部的には企業と店舗の両方を作ります (§2)。
            あとから店舗を増やしても、アカウント・顧客・分析履歴は作り直しません。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          <div className="space-y-1">
            <p className="text-sm font-medium">企業名</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 株式会社ルミエール"
              className="h-9"
            />
            {name.trim() && decision.kind === "denied" ? (
              <p className="text-xs text-destructive">
                {ORG_DENIAL_LABEL[decision.reason]}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              企業管理者
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                任意・メールで招待します
              </span>
            </p>
            <Input
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              type="email"
              placeholder="admin@example.jp"
              className="h-9"
            />
            {adminEmail.trim() && !isEmailLike(adminEmail) ? (
              <p className="text-xs text-destructive">
                メールアドレスの形式が正しくありません
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                招待された方が登録・ログインするまで、このアカウントは使えません。
                パスワードはこちらでは設定しません。
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">契約状態</p>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as Company["contractStatus"])}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(CONTRACT_STATUS_LABEL) as Company["contractStatus"][]
                ).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CONTRACT_STATUS_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">店舗</p>
            {draftStores.map((st, i) => (
              <div key={i} className="space-y-1 rounded-md border p-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    value={st.name}
                    onChange={(e) =>
                      setDraftStores((prev) =>
                        prev.map((x, k) =>
                          k === i ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                    placeholder="店舗名（例: 銀座店）"
                    className="h-8 flex-1"
                  />
                  <Select
                    value={st.status}
                    onValueChange={(v) =>
                      setDraftStores((prev) =>
                        prev.map((x, k) =>
                          k === i ? { ...x, status: v as Store["status"] } : x
                        )
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STORE_STATUS_LABEL) as Store["status"][]).map(
                        (k) => (
                          <SelectItem key={k} value={k}>
                            {STORE_STATUS_LABEL[k]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  {draftStores.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="この店舗を外す"
                      onClick={() =>
                        setDraftStores((prev) => prev.filter((_, k) => k !== i))
                      }
                    >
                      <XIcon className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <Input
                  value={st.managerEmail}
                  onChange={(e) =>
                    setDraftStores((prev) =>
                      prev.map((x, k) =>
                        k === i ? { ...x, managerEmail: e.target.value } : x
                      )
                    )
                  }
                  type="email"
                  placeholder="担当者のメール（任意・店舗管理者として招待）"
                  className="h-8"
                />
              </div>
            ))}
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs"
              onClick={() =>
                setDraftStores((prev) => [
                  ...prev,
                  { name: "", status: "active", managerEmail: "" },
                ])
              }
            >
              店舗をもう 1 件追加する
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            やめる
          </Button>
          <Button
            disabled={!ready}
            title={
              decision.kind === "denied"
                ? ORG_DENIAL_LABEL[decision.reason]
                : badEmail
                  ? "メールアドレスの形式が正しくありません"
                  : undefined
            }
            onClick={submit}
          >
            追加する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * 編集（名称・状態）
 * ------------------------------------------------------------------ */

export function EditCompanyDialog({ company }: { company: Company }) {
  const { scope, companies, updateCompany, createStore } = useSession()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(company.name)
  const [status, setStatus] = useState(company.contractStatus)
  const [reason, setReason] = useState("")
  const [newStore, setNewStore] = useState("")

  if (!canEditOrganizations(scope)) return null

  const decision = decideCreateCompany(scope, companies, name, company.id)
  const storeDecision = decideCreateStore(scope, [], company.id, newStore)
  const changed = name.trim() !== company.name || status !== company.contractStatus
  /* 🔴 解約・停止は影響が大きいので理由を必須にする (§13) */
  const heavy = status !== company.contractStatus && status !== "active"
  const ready =
    decision.kind === "allowed" && changed && (!heavy || isReasonEnough(reason))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          編集
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{company.name}</DialogTitle>
          <DialogDescription>
            解約・一時停止しても、顧客・分析履歴・同意・保存期限は作り直しません。
            企業を止めると配下の店舗もまとめて止まります。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">企業名</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
            {decision.kind === "denied" ? (
              <p className="text-xs text-destructive">
                {ORG_DENIAL_LABEL[decision.reason]}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">契約状態</p>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as Company["contractStatus"])}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(CONTRACT_STATUS_LABEL) as Company["contractStatus"][]
                ).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CONTRACT_STATUS_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {heavy ? (
            <ReasonField
              value={reason}
              onChange={setReason}
              label="変更の理由"
              hint="契約状態を止める操作です。監査に残ります。"
            />
          ) : null}

          <div className="space-y-1 border-t pt-3">
            <p className="text-sm font-medium">店舗を追加</p>
            <div className="flex items-center gap-2">
              <Input
                value={newStore}
                onChange={(e) => setNewStore(e.target.value)}
                placeholder="店舗名"
                className="h-8 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={storeDecision.kind !== "allowed"}
                onClick={() => {
                  createStore(company.id, { name: newStore, status: "active" })
                  toast.success(`店舗「${newStore.trim()}」を追加しました`)
                  setNewStore("")
                }}
              >
                追加
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            閉じる
          </Button>
          <Button
            disabled={!ready}
            title={
              !changed
                ? "変更がありません"
                : heavy && !isReasonEnough(reason)
                  ? "理由を入力してください"
                  : undefined
            }
            onClick={() => {
              updateCompany(company.id, { name, contractStatus: status })
              toast.success(`${company.name} を更新しました`)
              setOpen(false)
              setReason("")
            }}
          >
            保存する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EditStoreDialog({ store }: { store: Store }) {
  const { scope, stores, updateStore } = useSession()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(store.name)
  const [status, setStatus] = useState(store.status)
  const [reason, setReason] = useState("")

  if (!canEditOrganizations(scope)) return null

  const decision = decideCreateStore(scope, stores, store.companyId, name, store.id)
  const changed = name.trim() !== store.name || status !== store.status
  const heavy = status !== store.status && status === "closed"
  const ready =
    decision.kind === "allowed" && changed && (!heavy || isReasonEnough(reason))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          編集
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{store.name}</DialogTitle>
          <DialogDescription>
            閉店にしても、その店舗で撮影した分析履歴と同意の記録は残ります。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">店舗名</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
            {decision.kind === "denied" ? (
              <p className="text-xs text-destructive">
                {ORG_DENIAL_LABEL[decision.reason]}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">状態</p>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as Store["status"])}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STORE_STATUS_LABEL) as Store["status"][]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {STORE_STATUS_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {heavy ? (
            <ReasonField
              value={reason}
              onChange={setReason}
              label="閉店の理由"
              hint="監査に残ります。"
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            閉じる
          </Button>
          <Button
            disabled={!ready}
            title={
              !changed
                ? "変更がありません"
                : heavy && !isReasonEnough(reason)
                  ? "理由を入力してください"
                  : undefined
            }
            onClick={() => {
              updateStore(store.id, { name, status })
              toast.success(`${store.name} を更新しました`)
              setOpen(false)
              setReason("")
            }}
          >
            保存する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
