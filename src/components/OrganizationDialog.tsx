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
import { companyAdminsOf, isEmailLike } from "@/lib/domain/scope"
import {
  CONTRACT_STATUS_LABEL,
  ROLE_LABEL,
  type Company,
  type Store,
  type StoreId,
} from "@/lib/domain/types"

const STORE_STATUS_LABEL: Record<Store["status"], string> = {
  active: "営業中",
  closed: "閉店",
}

type DraftStore = {
  name: string
  status: Store["status"]
  managerEmail: string
  managerName: string
}

/** 担当者の一覧と、メールでの招待。追加・編集の両方で同じ形にする。 */
function MemberField({
  label,
  hint,
  members,
  email,
  name,
  onEmail,
  onName,
}: {
  label: string
  hint?: string
  /** すでに担当している人。未登録なら「招待中」。 */
  members?: { displayName: string; status: string }[]
  email: string
  name: string
  onEmail: (v: string) => void
  onName: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">
        {label}
        {hint ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </p>
      {members ? (
        <p className="text-xs text-muted-foreground">
          {members.length === 0 ? (
            <span className="text-amber-700">未設定</span>
          ) : (
            members
              .map((m) =>
                m.status === "invited" ? `${m.displayName}(招待中)` : m.displayName
              )
              .join(" / ")
          )}
        </p>
      ) : null}
      <Input
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        type="email"
        placeholder={members ? "追加で招待する方のメール" : "admin@example.jp"}
        className="h-9"
      />
      {/* 🔴 名前が無いとメールアドレスがそのまま表示名になる。本人が
             登録するまでの仮の名前として、分かっていれば入れておく */}
      <Input
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="お名前（任意・分かっていれば）"
        className="h-9"
      />
      {email.trim() && !isEmailLike(email) ? (
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
  )
}

/** 店舗 1 件分の入力。追加・編集で同じ形にする。 */
function StoreFields({
  store,
  members,
  onChange,
  onRemove,
}: {
  store: DraftStore
  members?: { displayName: string; status: string }[]
  onChange: (patch: Partial<DraftStore>) => void
  onRemove?: () => void
}) {
  return (
    <div className="space-y-1 rounded-md border p-2.5">
      <div className="flex items-center gap-2">
        <Input
          value={store.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="店舗名（例: 銀座店）"
          className="h-8 flex-1"
        />
        <Select
          value={store.status}
          onValueChange={(v) => onChange({ status: v as Store["status"] })}
        >
          <SelectTrigger className="h-8 w-28">
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
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="この店舗を外す"
            onClick={onRemove}
          >
            <XIcon className="size-4" />
          </Button>
        ) : null}
      </div>
      {members ? (
        <p className="text-xs text-muted-foreground">
          担当者:{" "}
          {members.length === 0 ? (
            <span className="text-amber-700">未割当</span>
          ) : (
            members
              .map((m) =>
                m.status === "invited" ? `${m.displayName}(招待中)` : m.displayName
              )
              .join(" / ")
          )}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          value={store.managerEmail}
          onChange={(e) => onChange({ managerEmail: e.target.value })}
          type="email"
          placeholder={
            members
              ? "追加で招待する担当者のメール"
              : "担当者のメール（任意・店舗管理者として招待）"
          }
          className="h-8 flex-1"
        />
        <Input
          value={store.managerName}
          onChange={(e) => onChange({ managerName: e.target.value })}
          placeholder="お名前（任意）"
          className="h-8 w-40"
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 新規追加
 * ------------------------------------------------------------------ */

export function CreateOrganizationDialog() {
  const { scope, companies, createCompany, inviteMember } = useSession()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminName, setAdminName] = useState("")
  const [status, setStatus] = useState<Company["contractStatus"]>("active")
  const [draftStores, setDraftStores] = useState<DraftStore[]>([
    { name: "", status: "active", managerEmail: "", managerName: "" },
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
    setAdminName("")
    setStatus("active")
    setDraftStores([
      { name: "", status: "active", managerEmail: "", managerName: "" },
    ])
  }

  function submit() {
    const { companyId, storeIds } = createCompany({
      name,
      contractStatus: status,
      stores: filledStores.map((s) => ({ name: s.name, status: s.status })),
    })
    // 🔴 招待は担当ごと。企業管理者は企業に、店舗の担当者はその店舗に付ける
    if (adminEmail.trim()) {
      inviteMember(
        adminEmail.trim(),
        adminName.trim(),
        { kind: "company", companyId, role: "company_admin" },
        `企業「${name.trim()}」の追加に伴う企業管理者の招待`
      )
    }
    filledStores.forEach((st, i) => {
      if (!st.managerEmail.trim()) return
      inviteMember(
        st.managerEmail.trim(),
        st.managerName.trim(),
        { kind: "store", storeId: storeIds[i], role: "store_admin" },
        `店舗「${st.name.trim()}」の追加に伴う店舗管理者の招待`
      )
    })
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

          <MemberField
            label="企業管理者"
            hint="任意・メールで招待します"
            email={adminEmail}
            name={adminName}
            onEmail={setAdminEmail}
            onName={setAdminName}
          />

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
              <StoreFields
                key={i}
                store={st}
                onChange={(patch) =>
                  setDraftStores((prev) =>
                    prev.map((x, k) => (k === i ? { ...x, ...patch } : x))
                  )
                }
                onRemove={
                  draftStores.length > 1
                    ? () => setDraftStores((prev) => prev.filter((_, k) => k !== i))
                    : undefined
                }
              />
            ))}
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs"
              onClick={() =>
                setDraftStores((prev) => [
                  ...prev,
                  { name: "", status: "active", managerEmail: "", managerName: "" },
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
  const {
    scope,
    accounts,
    companies,
    stores,
    updateCompany,
    createStore,
    updateStore,
    inviteMember,
  } = useSession()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(company.name)
  const [status, setStatus] = useState(company.contractStatus)
  const [reason, setReason] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminName, setAdminName] = useState("")
  const own = stores.filter((s) => s.companyId === company.id)
  /** 既存店舗の編集内容。保存するまで反映しない。 */
  const [storeDrafts, setStoreDrafts] = useState<Record<StoreId, DraftStore>>(() =>
    Object.fromEntries(
      own.map((s) => [
        s.id,
        { name: s.name, status: s.status, managerEmail: "", managerName: "" },
      ])
    )
  )
  /** 新しく足す店舗。 */
  const [newStores, setNewStores] = useState<DraftStore[]>([])

  if (!canEditOrganizations(scope)) return null

  const admins = companyAdminsOf(accounts, company.id)
  const decision = decideCreateCompany(scope, companies, name, company.id)
  const membersOf = (storeId: StoreId) =>
    accounts.filter((a) => a.storeMemberships.some((m) => m.storeId === storeId))

  const changedStores = own.filter((s) => {
    const d = storeDrafts[s.id]
    return d && (d.name.trim() !== s.name || d.status !== s.status)
  })
  const filledNew = newStores.filter((s) => s.name.trim())
  const changed =
    name.trim() !== company.name ||
    status !== company.contractStatus ||
    changedStores.length > 0 ||
    filledNew.length > 0
  /* 🔴 解約・停止は影響が大きいので理由を必須にする (§13) */
  const heavy =
    (status !== company.contractStatus && status !== "active") ||
    changedStores.some((s) => storeDrafts[s.id].status === "closed")
  const badEmail =
    (adminEmail.trim() && !isEmailLike(adminEmail)) ||
    Object.values(storeDrafts).some(
      (d) => d.managerEmail.trim() && !isEmailLike(d.managerEmail)
    ) ||
    filledNew.some((s) => s.managerEmail.trim() && !isEmailLike(s.managerEmail))
  const ready =
    decision.kind === "allowed" &&
    changed &&
    !badEmail &&
    (!heavy || isReasonEnough(reason))

  function submit() {
    if (name.trim() !== company.name || status !== company.contractStatus) {
      updateCompany(company.id, { name, contractStatus: status })
    }
    for (const s of changedStores) {
      const d = storeDrafts[s.id]
      updateStore(s.id, { name: d.name, status: d.status })
    }
    for (const s of filledNew) {
      createStore(company.id, { name: s.name, status: s.status })
    }
    /*
      🔴 招待は担当ごと。既存店舗の担当者はその店舗へ、企業管理者は企業へ付ける。
      ⚠️ 新しく足した店舗の担当者は、この時点では店舗 id が確定していないため
         招待しない。店舗を作ったあと、その行から招待してもらう。
    */
    if (adminEmail.trim()) {
      inviteMember(
        adminEmail.trim(),
        adminName.trim(),
        { kind: "company", companyId: company.id, role: "company_admin" },
        `${company.name} の企業管理者を招待`
      )
    }
    for (const s of own) {
      const d = storeDrafts[s.id]
      if (!d?.managerEmail.trim()) continue
      inviteMember(
        d.managerEmail.trim(),
        d.managerName.trim(),
        { kind: "store", storeId: s.id, role: "store_admin" },
        `${s.name} の店舗管理者を招待`
      )
    }
    toast.success(`${company.name} を更新しました`)
    setOpen(false)
    setReason("")
    setAdminEmail("")
    setAdminName("")
    setNewStores([])
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          // 開くたびに今の値から始める(閉じている間に変わっている場合がある)
          setName(company.name)
          setStatus(company.contractStatus)
          setStoreDrafts(
            Object.fromEntries(
              own.map((s) => [
                s.id,
                { name: s.name, status: s.status, managerEmail: "", managerName: "" },
              ])
            )
          )
          setNewStores([])
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          編集
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>企業・店舗を編集</DialogTitle>
          <DialogDescription>
            解約・一時停止しても、顧客・分析履歴・同意・保存期限は作り直しません。
            企業を止めると配下の店舗もまとめて止まります。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
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

          <MemberField
            label="企業管理者"
            hint="メールで招待します"
            members={admins}
            email={adminEmail}
            name={adminName}
            onEmail={setAdminEmail}
            onName={setAdminName}
          />

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
              hint="契約や店舗を止める操作です。監査に残ります。"
            />
          ) : null}

          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">店舗</p>
            {own.map((s) => (
              <StoreFields
                key={s.id}
                store={storeDrafts[s.id] ?? {
                  name: s.name,
                  status: s.status,
                  managerEmail: "",
                  managerName: "",
                }}
                members={membersOf(s.id)}
                onChange={(patch) =>
                  setStoreDrafts((prev) => ({
                    ...prev,
                    [s.id]: { ...prev[s.id], ...patch },
                  }))
                }
              />
            ))}
            {newStores.map((st, i) => (
              <StoreFields
                key={`new_${i}`}
                store={st}
                onChange={(patch) =>
                  setNewStores((prev) =>
                    prev.map((x, k) => (k === i ? { ...x, ...patch } : x))
                  )
                }
                onRemove={() =>
                  setNewStores((prev) => prev.filter((_, k) => k !== i))
                }
              />
            ))}
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs"
              onClick={() =>
                setNewStores((prev) => [
                  ...prev,
                  { name: "", status: "active", managerEmail: "", managerName: "" },
                ])
              }
            >
              店舗を追加する
            </Button>
            {filledNew.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                新しく足す店舗の担当者は、保存して店舗ができてから招待してください。
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            やめる
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
            onClick={submit}
          >
            保存する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EditStoreDialog({ store }: { store: Store }) {
  const { scope, accounts, stores, updateStore, inviteMember } = useSession()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(store.name)
  const [status, setStatus] = useState(store.status)
  const [reason, setReason] = useState("")
  const [email, setEmail] = useState("")
  const [memberName, setMemberName] = useState("")
  /* 🔴 §4.3 店舗には店舗管理者と店舗スタッフの 2 つの担当がある */
  const [role, setRole] = useState<"store_admin" | "store_staff">("store_staff")

  if (!canEditOrganizations(scope)) return null

  const members = accounts.filter((a) =>
    a.storeMemberships.some((m) => m.storeId === store.id)
  )
  const decision = decideCreateStore(scope, stores, store.companyId, name, store.id)
  const changed = name.trim() !== store.name || status !== store.status
  const inviting = Boolean(email.trim())
  const badEmail = inviting && !isEmailLike(email)
  const heavy = status !== store.status && status === "closed"
  const ready =
    decision.kind === "allowed" &&
    (changed || inviting) &&
    !badEmail &&
    (!heavy || isReasonEnough(reason))

  function submit() {
    if (changed) updateStore(store.id, { name, status })
    if (inviting) {
      inviteMember(
        email.trim(),
        memberName.trim(),
        { kind: "store", storeId: store.id, role },
        `${store.name} の${ROLE_LABEL[role]}を招待`
      )
    }
    toast.success(`${store.name} を更新しました`)
    setOpen(false)
    setReason("")
    setEmail("")
    setMemberName("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setName(store.name)
          setStatus(store.status)
        }
      }}
    >
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

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
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

          {/* 🔴 今いる人を出したうえで招待する。入力欄だけだと誰が居るか分からない */}
          <div className="space-y-1 border-t pt-3">
            <p className="text-sm font-medium">担当者</p>
            <p className="text-xs text-muted-foreground">
              {members.length === 0 ? (
                <span className="text-amber-700">未割当</span>
              ) : (
                members
                  .map((m) => {
                    const r = m.storeMemberships.find((x) => x.storeId === store.id)
                    const label = r ? `（${ROLE_LABEL[r.role]}）` : ""
                    return m.status === "invited"
                      ? `${m.displayName}${label}(招待中)`
                      : `${m.displayName}${label}`
                  })
                  .join(" / ")
              )}
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="追加で招待する方のメール"
                className="h-9 flex-1"
              />
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "store_admin" | "store_staff")}
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store_staff">
                    {ROLE_LABEL.store_staff}
                  </SelectItem>
                  <SelectItem value="store_admin">
                    {ROLE_LABEL.store_admin}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="お名前（任意・分かっていれば）"
              className="h-9"
            />
            {badEmail ? (
              <p className="text-xs text-destructive">
                メールアドレスの形式が正しくありません
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                招待された方が登録・ログインするまで、このアカウントは使えません。
                担当を外すのは一覧の担当者欄から行います。
              </p>
            )}
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
              !changed && !inviting
                ? "変更がありません"
                : heavy && !isReasonEnough(reason)
                  ? "理由を入力してください"
                  : undefined
            }
            onClick={submit}
          >
            保存する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
