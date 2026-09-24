/**
 * membership の付与・剥奪 (仕様書 v1.0 §2, §4.1, §4.2)
 *
 * 🔴 role を単一列として書き換えるのではなく、membership 行の追加・削除として扱う。
 *    account・顧客・分析履歴・同意・保存期限は作り直さない (§2)。
 * 🔴 誰が何を変更できるかは `decideMembershipEdit()` が決める。
 *    ここは判定結果を描くだけで、独自の条件分岐を足さない。
 * 🔴 §13「重い操作は確認画面と理由入力を設ける」に従い、理由を必須にする。
 *    入力した理由はそのまま §11 の変更監査 (role_change) に残る。
 *
 * 🔴 アカウントは**招待制** (吉田さん確定 2026-09-14)。
 *    メールアドレスを入れて招待し、本人がパスワードを設定してはじめて使える。
 *    招待した側はパスワードに触らない。招待メールの送信は backend の担当。
 *    招待できる範囲は付与できる範囲と同じ (`decideInvite()`)。
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ReasonField } from "@/components/ReasonField"
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
  decideInvite,
  decideMembershipEdit,
  hasMembership,
  INVITE_DENIED_LABEL,
  MEMBERSHIP_DENIED_LABEL,
  type MembershipTarget,
} from "@/lib/domain/scope"
import { ROLE_LABEL, type AdminAccount } from "@/lib/domain/types"

type Props = {
  /** この単位で扱う membership。店舗は店舗管理者・店舗スタッフの 2 件を渡す。 */
  targets: MembershipTarget[]
  /** 見出しに出す対象名(会社名・店舗名)。 */
  targetLabel: string
  children: React.ReactNode
}

export function MembershipDialog({ targets, targetLabel, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{targetLabel} の担当者</DialogTitle>
          <DialogDescription>
            既存アカウントの担当を付け外しするか、メールアドレスで招待します。
            招待された方がパスワードを設定するまで、そのアカウントは使えません。
            変更は監査に残ります。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {targets.map((target) => (
            <RoleSection
              key={`${target.kind}:${target.kind === "company" ? target.companyId : target.storeId}:${target.role}`}
              target={target}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RoleSection({ target }: { target: MembershipTarget }) {
  const { accounts, account, scope, changeMembership, inviteMember } = useSession()
  const [pick, setPick] = useState<string>("")
  const [reason, setReason] = useState("")
  /* 招待 */
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")

  const decision = decideMembershipEdit(scope, target)
  const editable = decision.kind === "allowed"

  const holders = useMemo(
    () => accounts.filter((a) => hasMembership(a, target)),
    [accounts, target]
  )
  const candidates = useMemo(
    () => accounts.filter((a) => !hasMembership(a, target)),
    [accounts, target]
  )

  const invite = decideInvite(scope, accounts, email, target)

  function submitInvite() {
    inviteMember(email.trim(), displayName.trim(), target, reason.trim())
    toast.success(`${email.trim()} を招待しました`, {
      description:
        "招待メールから本人がパスワードを設定すると使えるようになります。",
    })
    setEmail("")
    setDisplayName("")
    setReason("")
    setInviting(false)
  }

  function submit(
    targetAccountId: string,
    action: "grant" | "revoke",
    accountLabel: string
  ) {
    changeMembership(targetAccountId, target, action, reason.trim())
    toast.success(
      action === "grant"
        ? `${accountLabel} に${ROLE_LABEL[target.role]}を付与しました`
        : `${accountLabel} の${ROLE_LABEL[target.role]}を解除しました`,
      { description: "監査に role_change として記録しました" }
    )
    setPick("")
    setReason("")
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{ROLE_LABEL[target.role]}</h3>
        <Badge variant="outline" className="text-[10px]">
          {holders.length} 名
        </Badge>
      </div>

      {holders.length === 0 ? (
        <p className="text-xs text-amber-700">
          未設定です。
          {target.role === "company_admin"
            ? "契約はあるのに責任者が居ない状態です。"
            : null}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {holders.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm">
                  {a.displayName}
                  {a.status === "invited" ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-amber-300 px-1 py-0 text-[10px] text-amber-700"
                    >
                      招待中
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.email}
                  {a.status === "invited"
                    ? " ・パスワード未設定のため利用できません"
                    : ""}
                </p>
              </div>
              {editable ? (
                <RevokeButton
                  account={a}
                  isSelf={a.id === account.id}
                  reason={reason}
                  onConfirm={() => submit(a.id, "revoke", a.displayName)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="h-9 flex-1">
                <SelectValue placeholder="アカウントを選ぶ" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    付与できるアカウントがありません
                  </SelectItem>
                ) : (
                  candidates.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName}（{a.email}）
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-9"
              disabled={!pick || !reason.trim()}
              onClick={() => {
                const a = accounts.find((x) => x.id === pick)
                if (a) submit(a.id, "grant", a.displayName)
              }}
            >
              <PlusIcon /> 付与
            </Button>
          </div>
          <ReasonField
            value={reason}
            onChange={setReason}
            label="変更の理由"
          />

          {/*
            まだアカウントを持っていない人はここから招待する。
            🔴 パスワードは本人が設定する。招待した側は触らない。
          */}
          {inviting ? (
            <div className="space-y-2 rounded-md border p-2.5">
              <p className="text-xs font-medium">メールアドレスで招待</p>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="メールアドレス"
                className="h-9"
              />
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="表示名(任意)"
                className="h-9"
              />
              {email.trim() && invite.kind === "denied" ? (
                <p className="text-xs text-amber-700">
                  {INVITE_DENIED_LABEL[invite.reason]}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  招待された方がパスワードと 2FA を設定するまで、このアカウントは
                  使えません。パスワードはこちらでは設定しません。
                </p>
              )}
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInviting(false)
                    setEmail("")
                    setDisplayName("")
                  }}
                >
                  やめる
                </Button>
                <Button
                  size="sm"
                  disabled={invite.kind !== "allowed" || !reason.trim()}
                  onClick={submitInvite}
                >
                  <PlusIcon /> 招待する
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs"
              onClick={() => setInviting(true)}
            >
              アカウントが無い方をメールアドレスで招待する
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {MEMBERSHIP_DENIED_LABEL[decision.reason]}
        </p>
      )}
    </section>
  )
}

/**
 * 剥奪は元に戻すのに再付与が要るので、一段確認を挟む。
 * 🔴 自分の権限を自分で外すと画面から締め出されるので止める。
 */
function RevokeButton({
  account,
  isSelf,
  reason,
  onConfirm,
}: {
  account: AdminAccount
  isSelf: boolean
  reason: string
  onConfirm: () => void
}) {
  const [armed, setArmed] = useState(false)

  if (isSelf) {
    return (
      <span className="shrink-0 text-xs text-muted-foreground">
        自分の担当は外せません
      </span>
    )
  }

  if (!armed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-destructive hover:text-destructive"
        onClick={() => setArmed(true)}
      >
        解除
      </Button>
    )
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={!reason.trim()}
        title={!reason.trim() ? "理由を入力してください" : undefined}
        className="text-destructive hover:text-destructive"
        onClick={() => {
          onConfirm()
          setArmed(false)
        }}
      >
        {account.displayName} を解除
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setArmed(false)}>
        やめる
      </Button>
    </span>
  )
}
