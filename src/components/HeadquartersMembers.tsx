/**
 * 本部メンバー (吉田さん確定 2026-09-24)
 *
 * > 本部は開始時は吉田1名ですが、後から担当者を追加できるようにしてください。
 * > 各自の個別アカウントで、2段階認証を必須とします。
 *
 * 🔴 増やせるのは本部だけ。本部以外にはこの区画自体を出さない。
 * 🔴 **アカウントは 1 人 1 つ**。共有アカウントを作らない。監査で「誰がやったか」が
 *    分からなくなるため (§11)。招待はメールアドレス単位なので、同じアドレスを
 *    再招待してもアカウントは作り直さず担当だけ足す。
 * 🔴 operator は 2FA 必須 (§2)。ただし設定するのは**本人**なので、招待直後は未設定。
 *    未設定のまま使われると困るので、一覧で分かるようにする。
 * 🔴 自分の担当は自分で外せない。外すと本部の操作ができる人が居なくなりうる。
 */

import { useState } from "react"
import { toast } from "sonner"

import { ChevronRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { InfoHint } from "@/components/InfoHint"
import { isReasonEnough } from "@/components/reason-rules"
import { useSession } from "@/contexts/session-context"
import { formatDate } from "@/lib/domain/kpi"
import {
  decideInvite,
  INVITE_DENIED_LABEL,
  isEmailLike,
  type MembershipTarget,
} from "@/lib/domain/scope"
import { ROLE_REQUIRES_2FA } from "@/lib/domain/types"

export function HeadquartersMembers() {
  const { scope, account, accounts, companies, inviteMember, changeMembership } =
    useSession()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [armed, setArmed] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  /* 契約企業のカードと同じ開閉にする。既定は閉じた状態 */
  const [open, setOpen] = useState(false)

  // 本部にも内部的に company がある。role だけが違う
  const hq = companies.find((c) => c.kind === "internal")
  if (!scope.crossCompany || !hq) return null

  const target: MembershipTarget = {
    kind: "company",
    companyId: hq.id,
    role: "operator",
  }
  const members = accounts.filter((a) =>
    a.organizationMemberships.some(
      (m) => m.companyId === hq.id && m.role === "operator"
    )
  )
  const invite = decideInvite(scope, accounts, email, target)
  const canInvite = email.trim() !== "" && invite.kind === "allowed"

  /* 🔴 2 段階認証が未設定の人は、閉じたままでも分かるようにする (§2) */
  const missing2fa = members.filter(
    (m) => ROLE_REQUIRES_2FA.operator && !m.twoFactorEnabled
  ).length

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card className="gap-0 overflow-hidden py-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            aria-label={`本部メンバーの一覧を${open ? "閉じる" : "開く"}`}
          >
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="font-medium">本部メンバー</span>
              <span className="text-xs text-muted-foreground">
                全企業・全店舗を横断
              </span>
            </div>

            {/* 閉じたままでも人数と 2FA の状況が分かるよう、要約は常に出す */}
            <dl className="flex shrink-0 items-baseline gap-4 text-xs text-muted-foreground">
              <div className="flex items-baseline gap-1">
                <dt>人数</dt>
                <dd className="w-6 text-right tabular-nums text-foreground">
                  {members.length}
                </dd>
              </div>
              {missing2fa > 0 ? (
                <div className="flex items-baseline gap-1">
                  <dt>2段階認証 未設定</dt>
                  <dd className="w-6 text-right tabular-nums text-destructive">
                    {missing2fa}
                  </dd>
                </div>
              ) : null}
            </dl>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
      <div className="space-y-3 border-t px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            アカウントは 1 人 1 つにしてください。共有すると、監査に残る「誰がやったか」
            が分からなくなります。
            <InfoHint label="本部メンバーについて">
              <p>
                全企業・全店舗を横断して操作できる担当者です。増やせるのは本部だけです。
              </p>
              <p className="mt-1">
                2 段階認証は必須ですが、設定するのはご本人です。招待した直後は未設定の
                状態から始まります。
              </p>
            </InfoHint>
          </p>
        <ul className="space-y-1">
          {members.map((m) => {
            const isSelf = m.id === account.id
            const needs2fa = ROLE_REQUIRES_2FA.operator && !m.twoFactorEnabled
            return (
              <li key={m.id} className="space-y-1 border-b pb-1.5 last:border-0">
                <span className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-medium">{m.displayName}</span>
                  <span className="text-xs text-muted-foreground">{m.email}</span>
                  {m.status === "invited" ? (
                    <Badge
                      variant="outline"
                      className="border-amber-300 px-1 py-0 text-[10px] text-amber-700"
                    >
                      招待中
                    </Badge>
                  ) : null}
                  {/* 🔴 2FA 必須なのに未設定であることを隠さない (§2) */}
                  {needs2fa ? (
                    <Badge
                      variant="outline"
                      className="border-destructive/50 px-1 py-0 text-[10px] text-destructive"
                    >
                      2段階認証 未設定
                    </Badge>
                  ) : null}
                  {m.invitedAt ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      招待 {formatDate(m.invitedAt)}
                    </span>
                  ) : null}
                  {isSelf ? (
                    <span className="text-xs text-muted-foreground">
                      自分の担当は外せません
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => {
                        setArmed(armed === m.id ? null : m.id)
                        setReason("")
                      }}
                    >
                      {armed === m.id ? "やめる" : "外す"}
                    </button>
                  )}
                </span>
                {armed === m.id ? (
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
                        !isReasonEnough(reason)
                          ? "理由を入力してください"
                          : undefined
                      }
                      onClick={() => {
                        changeMembership(m.id, target, "revoke", reason.trim())
                        toast.success(`${m.displayName} を本部から外しました`)
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

        <div className="space-y-1 border-t pt-3">
          <p className="text-sm font-medium">本部メンバーを招待</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="メールアドレス"
              className="h-9 w-64"
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="お名前（任意）"
              className="h-9 w-48"
            />
            <Button
              size="sm"
              className="h-9"
              disabled={!canInvite}
              title={
                email.trim() && invite.kind === "denied"
                  ? INVITE_DENIED_LABEL[invite.reason]
                  : undefined
              }
              onClick={() => {
                inviteMember(
                  email.trim(),
                  name.trim(),
                  target,
                  "本部メンバーとして招待"
                )
                toast.success(`${email.trim()} を本部メンバーに招待しました`, {
                  description:
                    "ご本人がパスワードと 2 段階認証を設定するまで利用できません。",
                })
                setEmail("")
                setName("")
              }}
            >
              招待する
            </Button>
          </div>
          {/* 🔴 弾いた理由は入力欄の側に出す */}
          {email.trim() && invite.kind === "denied" ? (
            <p className="text-xs text-destructive">
              {INVITE_DENIED_LABEL[invite.reason]}
            </p>
          ) : email.trim() && !isEmailLike(email) ? (
            <p className="text-xs text-destructive">
              メールアドレスの形式が正しくありません
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              アカウントは 1 人 1 つにしてください。パスワードと 2 段階認証は
              ご本人が設定します。
            </p>
          )}
        </div>
      </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
