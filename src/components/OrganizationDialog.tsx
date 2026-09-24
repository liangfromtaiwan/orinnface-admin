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
  ORG_READONLY_NOTE,
  canEditOrganizations,
  companyEditRights,
  decideCreateCompany,
  decideRenameCompany,
  decideRenameStore,
  storeEditRights,
} from "@/lib/domain/organizations"
import {
  canManageMembership,
  companyAdminsOf,
  isEmailLike,
} from "@/lib/domain/scope"
import {
  CONTRACT_STATUS_LABEL,
  ROLE_LABEL,
  type AdminAccount,
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

/**
 * 担当者の一覧。外す操作もここに置く。
 * 🔴 外すのは元に戻すのに再招待が要るので、一段置いて理由を必須にする (§13)。
 * 🔴 自分の担当は自分で外せない。外すと画面から締め出される。
 */
function MemberList({
  members,
  role,
  onRevoke,
  canRevoke,
}: {
  members: AdminAccount[]
  /** 店舗のように 1 人が複数の役割を持ちうる場合に役割も出す。 */
  role?: (account: AdminAccount) => string | undefined
  onRevoke?: (account: AdminAccount) => void
  /** 相手の役割によって外せるかが変わる場合 (`decideMembershipEdit()` が正本)。 */
  canRevoke?: (account: AdminAccount) => boolean
}) {
  const { account } = useSession()
  const [armed, setArmed] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  if (members.length === 0) {
    return <p className="text-xs text-amber-700">未設定</p>
  }

  return (
    <ul className="space-y-1">
      {members.map((m) => {
        const label = role?.(m)
        const isSelf = m.id === account.id
        return (
          <li key={m.id} className="space-y-1">
            <span className="flex flex-wrap items-center gap-x-2 text-xs">
              <span>
                {m.displayName}
                {label ? `（${label}）` : ""}
                {m.status === "invited" ? "（招待中）" : ""}
              </span>
              {onRevoke && !isSelf && (canRevoke?.(m) ?? true) ? (
                <button
                  type="button"
                  className="text-destructive hover:underline"
                  onClick={() => {
                    setArmed(armed === m.id ? null : m.id)
                    setReason("")
                  }}
                >
                  {armed === m.id ? "やめる" : "外す"}
                </button>
              ) : null}
              {isSelf ? (
                <span className="text-muted-foreground">自分の担当は外せません</span>
              ) : null}
            </span>
            {armed === m.id && onRevoke ? (
              <span className="flex items-center gap-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="外す理由（監査に残ります）"
                  className="h-8 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-destructive"
                  disabled={!isReasonEnough(reason)}
                  title={
                    !isReasonEnough(reason) ? "理由を入力してください" : undefined
                  }
                  onClick={() => {
                    onRevoke(m)
                    setArmed(null)
                    setReason("")
                  }}
                >
                  外す
                </Button>
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
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
  onRevoke,
  canInvite = true,
  deniedNote,
}: {
  label: string
  hint?: string
  /** すでに担当している人。未登録なら「招待中」。 */
  members?: AdminAccount[]
  email: string
  name: string
  onEmail: (v: string) => void
  onName: (v: string) => void
  /** 担当を外す。渡さなければ外せない。 */
  onRevoke?: (account: AdminAccount) => void
  /** 招待できないロールでは入力欄を出さない (`decideMembershipEdit()` が正本)。 */
  canInvite?: boolean
  deniedNote?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">
        {label}
        {hint && canInvite ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </p>
      {members ? (
        <MemberList members={members} onRevoke={canInvite ? onRevoke : undefined} />
      ) : null}
      {/* 🔴 招待できないなら入力欄自体を出さない。入れてから弾かれるほうが分かりにくい */}
      {!canInvite ? (
        <p className="text-xs text-muted-foreground">{deniedNote}</p>
      ) : (
      <>
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
      </>
      )}
    </div>
  )
}

/** 店舗 1 件分の入力。追加・編集で同じ形にする。 */
function StoreFields({
  store,
  storeId,
  members,
  onChange,
  onRemove,
  onRevoke,
  rights = { name: true, status: true },
  canInvite = true,
}: {
  store: DraftStore
  storeId?: StoreId
  members?: AdminAccount[]
  onChange: (patch: Partial<DraftStore>) => void
  onRemove?: () => void
  onRevoke?: (account: AdminAccount) => void
  /** 直せる項目 (`storeEditRights()` が正本)。 */
  rights?: { name: boolean; status: boolean }
  canInvite?: boolean
}) {
  return (
    <div className="space-y-1 rounded-md border p-2.5">
      <div className="flex items-center gap-2">
        {rights.name ? (
          <Input
            value={store.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="店舗名（例: 銀座店）"
            className="h-8 flex-1"
          />
        ) : (
          <span className="flex-1 text-sm">{store.name}</span>
        )}
        {rights.status ? (
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
        ) : (
          <span className="w-28 text-xs text-muted-foreground">
            {STORE_STATUS_LABEL[store.status]}
          </span>
        )}
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
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">担当者</p>
          <MemberList
            members={members}
            role={(a) => {
              const m = a.storeMemberships.find((x) => x.storeId === storeId)
              return m ? ROLE_LABEL[m.role] : undefined
            }}
            onRevoke={onRevoke}
          />
        </div>
      ) : null}
      {canInvite ? (
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
      ) : null}
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
            <PlusIcon /> 追加する
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
    changeMembership,
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

  const rights = companyEditRights(scope)
  const storeRights = storeEditRights(scope)
  const canInviteAdmin = canManageMembership(scope, {
    kind: "company",
    companyId: company.id,
    role: "company_admin",
  })
  const canInviteStoreManager = (s: Store) =>
    canManageMembership(scope, {
      kind: "store",
      storeId: s.id,
      role: "store_admin",
    })
  /* 店舗を足せるのは本部だけ(吉田さん確定 2026-09-24) */
  const canAddStore = canEditOrganizations(scope)
  /*
    🔴 1 つも直せないなら編集ボタン自体を出さない。押しても何もできない画面を作らない。
    ⚠️ 担当者だけはこの条件に入れない。契約企業管理者・店舗管理者の担当者操作は
       一覧の「担当者」列から入れるので、読み取り専用のダイアログを二重に開かせない。
  */
  const canOpen = rights.name || rights.status || canAddStore || storeRights.name
  if (!canOpen) return null

  const admins = companyAdminsOf(accounts, company.id)
  const decision = decideRenameCompany(scope, companies, company, name)
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
    (!rights.name || decision.kind === "allowed") &&
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
            {rights.status
              ? "解約・一時停止しても、顧客・分析履歴・同意・保存期限は作り直しません。企業を止めると配下の店舗もまとめて止まります。"
              : "店舗名と担当者を変更できます。契約に関わる項目は本部が変更します。"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          <div className="space-y-1">
            <p className="text-sm font-medium">企業名</p>
            {rights.name ? (
              <>
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
              </>
            ) : (
              <>
                <p className="text-sm">{company.name}</p>
                <p className="text-xs text-muted-foreground">{ORG_READONLY_NOTE}</p>
              </>
            )}
          </div>

          <MemberField
            label="契約企業管理者"
            hint="メールで招待します"
            canInvite={canInviteAdmin}
            deniedNote="指名できるのは本部だけです。"
            members={admins}
            email={adminEmail}
            name={adminName}
            onEmail={setAdminEmail}
            onName={setAdminName}
            onRevoke={(a) => {
              changeMembership(
                a.id,
                { kind: "company", companyId: company.id, role: "company_admin" },
                "revoke",
                `${company.name} の契約企業管理者から外す`
              )
              toast.success(`${a.displayName} の担当を外しました`)
            }}
          />

          <div className="space-y-1">
            <p className="text-sm font-medium">契約状態</p>
            {rights.status ? (
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
            ) : (
              <>
                <p className="text-sm">
                  {CONTRACT_STATUS_LABEL[company.contractStatus]}
                </p>
                <p className="text-xs text-muted-foreground">{ORG_READONLY_NOTE}</p>
              </>
            )}
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
                storeId={s.id}
                store={storeDrafts[s.id] ?? {
                  name: s.name,
                  status: s.status,
                  managerEmail: "",
                  managerName: "",
                }}
                members={membersOf(s.id)}
                rights={storeRights}
                canInvite={canInviteStoreManager(s)}
                onRevoke={(a) => {
                  const m = a.storeMemberships.find((x) => x.storeId === s.id)
                  if (!m) return
                  changeMembership(
                    a.id,
                    { kind: "store", storeId: s.id, role: m.role },
                    "revoke",
                    `${s.name} の担当から外す`
                  )
                  toast.success(`${a.displayName} の担当を外しました`)
                }}
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
            {canAddStore ? (
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
                <PlusIcon /> 店舗を追加する
              </Button>
            ) : null}
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
  const { scope, accounts, stores, updateStore, inviteMember, changeMembership } =
    useSession()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(store.name)
  const [status, setStatus] = useState(store.status)
  const [reason, setReason] = useState("")
  const [email, setEmail] = useState("")
  const [memberName, setMemberName] = useState("")
  /* 🔴 §4.3 店舗には店舗管理者と店舗スタッフの 2 つの担当がある */
  const [role, setRole] = useState<"store_admin" | "store_staff">("store_staff")

  const rights = storeEditRights(scope)
  const canInviteAdmin = canManageMembership(scope, {
    kind: "store",
    storeId: store.id,
    role: "store_admin",
  })
  const canInviteStaff = canManageMembership(scope, {
    kind: "store",
    storeId: store.id,
    role: "store_staff",
  })
  const canInvite = canInviteAdmin || canInviteStaff
  /* 🔴 1 つも直せないなら編集ボタン自体を出さない(担当者は一覧の「担当者」列から) */
  if (!rights.name && !rights.status) return null

  const members = accounts.filter((a) =>
    a.storeMemberships.some((m) => m.storeId === store.id)
  )
  const decision = decideRenameStore(scope, stores, store, name)
  const changed = name.trim() !== store.name || status !== store.status
  const inviting = Boolean(email.trim())
  const badEmail = inviting && !isEmailLike(email)
  const heavy = status !== store.status && status === "closed"
  const ready =
    (!rights.name || decision.kind === "allowed") &&
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
            {rights.name ? (
              <>
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
              </>
            ) : (
              <>
                <p className="text-sm">{store.name}</p>
                <p className="text-xs text-muted-foreground">{ORG_READONLY_NOTE}</p>
              </>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">状態</p>
            {rights.status ? (
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
            ) : (
              <>
                <p className="text-sm">{STORE_STATUS_LABEL[store.status]}</p>
                <p className="text-xs text-muted-foreground">{ORG_READONLY_NOTE}</p>
              </>
            )}
          </div>

          {/* 🔴 今いる人を出したうえで招待する。入力欄だけだと誰が居るか分からない */}
          <div className="space-y-1 border-t pt-3">
            <p className="text-sm font-medium">担当者</p>
            <MemberList
              members={members}
              role={(a) => {
                const r = a.storeMemberships.find((x) => x.storeId === store.id)
                return r ? ROLE_LABEL[r.role] : undefined
              }}
              /* 🔴 店舗管理者が外せるのはスタッフだけ */
              canRevoke={(a) => {
                const r = a.storeMemberships.find((x) => x.storeId === store.id)
                return r
                  ? canManageMembership(scope, {
                      kind: "store",
                      storeId: store.id,
                      role: r.role,
                    })
                  : false
              }}
              onRevoke={(a) => {
                const r = a.storeMemberships.find((x) => x.storeId === store.id)
                if (!r) return
                changeMembership(
                  a.id,
                  { kind: "store", storeId: store.id, role: r.role },
                  "revoke",
                  `${store.name} の担当から外す`
                )
                toast.success(`${a.displayName} の担当を外しました`)
              }}
            />
            {/* 🔴 招待できる役割は decideMembershipEdit() が決める。
                   店舗管理者が足せるのは店舗スタッフだけ (吉田さん 2026-09-14) */}
            {canInvite ? (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="追加で招待する方のメール"
                    className="h-9 flex-1"
                  />
                  {canInviteAdmin ? (
                    <Select
                      value={role}
                      onValueChange={(v) =>
                        setRole(v as "store_admin" | "store_staff")
                      }
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
                  ) : (
                    <span className="w-32 text-xs text-muted-foreground">
                      {ROLE_LABEL.store_staff}として招待
                    </span>
                  )}
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
                    担当を外すときは、上の一覧から「外す」を押してください。
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                担当者を増やせるのは本部・企業管理者・店舗管理者です。
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
