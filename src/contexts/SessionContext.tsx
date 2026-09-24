/**
 * 管理画面のログインセッションと実効スコープ (仕様書 v1.0 §2, §3)
 *
 * 視点切替は「どの組織を見ているか」で行う。誰でログインしているかで見える範囲は
 * すでに決まっているため、視点の主語は人ではなく組織にする。
 * 🔴 視点は**表示の絞り込み**であって権限ではない。本部が 1 社に絞っても
 *    operator の capability は失われない(scope はそのまま)。
 * 🔴 旧 orinnme-admin の ?company_id / ?type は v1.0 と非互換のため URL では持たない。
 * 🔴 ここでの絞り込みは表示用。実 API 接続時は同じ scope を query に渡し、
 *    Backend 側で membership / store_data_link / 対象 scope を再検証すること。
 */

import { useCallback, useMemo, useState, type ReactNode } from "react"

import { SessionContext, type SessionValue } from "@/contexts/session-context"
import {
  brandingCompanyIdFor,
  resolveBranding,
} from "@/lib/domain/branding"
import {
  addCareAsset,
  applyCareRequestAction,
  applyRightsCleared,
  applyDirectReplacement,
  careAssetIdFor,
  CARE_REQUEST_ACTION_LABEL,
  type CareRequestAction,
} from "@/lib/domain/care-catalog"
import {
  applyBaselineAction,
  applyBaselineDelete,
  applyBaselineEdit,
  applyPolicyAction,
  applyPolicyDelete,
  applyPolicyEdit,
  createBaselineDraft as buildBaselineDraft,
  createPolicyDraft as buildPolicyDraft,
  type RecommendationPose,
  type SetAction,
} from "@/lib/domain/recommendation"
import {
  DEFAULT_MUSCLE_TAGS,
  diffMuscleTags,
  type MuscleTagChange,
  type MuscleTagHistoryEntry,
  type MuscleTagMap,
} from "@/lib/domain/muscles"
import {
  applyCompanyStatusToStores,
  applyCreateCompany,
  applyCreateStore,
  applyUpdateCompany,
  applyUpdateStore,
  nextCompanyId,
  nextStoreId,
} from "@/lib/domain/organizations"
import {
  applyInvite,
  applyMembershipChange,
  membershipAuditLabel,
  resolveScope,
  viewScopeFor,
  visibleCustomerIds,
  type MembershipTarget,
} from "@/lib/domain/scope"
import type {
  AccountId,
  AdminAccount,
  Company,
  Store,
  AuditEvent,
  CareAssignment,
  CareVideoAsset,
  CompanyId,
  StoreId,
  DataSubjectId,
  RecommendationBaselineSet,
  RecommendationPolicySet,
} from "@/lib/domain/types"
import { CONTRACT_STATUS_LABEL } from "@/lib/domain/types"
import {
  adminAccounts as seededAccounts,
  analysisSessions,
  auditEvents as seededAuditEvents,
  baselineSets as seededBaselineSets,
  careAssets as seededCareAssets,
  careAssignments as seededCareAssignments,
  carePlaybacks,
  companies as seededCompanies,
  companyBrandings,
  customers,
  policySets as seededPolicySets,
  storeDataLinks,
  stores as seededStores,
} from "@/lib/mock/seed"

/** 差し替え履歴に残す catalog version。seed と同じ値を使う。 */
const CARE_CATALOG_VERSION = "cc-2026.08.1"

/**
 * 版操作の監査ラベル。
 * rollback は「元の版」と「新しく起きた draft」の両方を残す。どちらか片方だと
 * あとから追えない。
 */
function setActionAuditLabel(
  kind: "基準値" | "方針",
  version: string,
  action: SetAction,
  newVersion?: string
): string {
  switch (action) {
    case "activate":
      return `${kind} set ${version} を有効化`
    case "schedule":
      return `${kind} set ${version} の有効化を予約`
    case "rollback":
      return `${kind} set ${version} の値へ戻す draft ${newVersion ?? ""} を作成`
  }
}

/** 監査の 1 行に収まる長さで変更をまとめる。 */
function summarize(changes: MuscleTagChange[]): string {
  const added = changes.filter((c) => c.kind === "added").length
  const removed = changes.filter((c) => c.kind === "removed").length
  const renamed = changes.filter((c) => c.kind === "renamed").length
  return [
    added ? `追加 ${added}` : "",
    removed ? `削除 ${removed}` : "",
    renamed ? `改名 ${renamed}` : "",
  ]
    .filter(Boolean)
    .join(" / ")
}

/** 監査の request ID を seed と同じ桁で揃える。 */
function pad6(n: number): string {
  return String(n).padStart(6, "0")
}

export function SessionProvider({
  children,
  initialAccountId,
}: {
  children: ReactNode
  /**
   * 最初に見せるアカウント。`npm run smoke:render` が role ごとの分岐を
   * 描き分けるために使う。画面からの切替は switchAccount。
   */
  initialAccountId?: string
}) {
  const [accountId, setAccountId] = useState(
    initialAccountId ?? seededAccounts[0].id
  )
  /** 本部が 1 社に絞って見ているときだけ入る。undefined = 全社横断。 */
  const [viewCompanyId, setViewCompanyId] = useState<CompanyId | undefined>()
  /**
   * membership は画面から変わるので state で持つ。
   * 🔴 backend 未接続のため変更はリロードで消える。永続化はエンジニア側。
   */
  const [accounts, setAccounts] = useState<AdminAccount[]>(seededAccounts)
  const [addedAuditEvents, setAddedAuditEvents] = useState<AuditEvent[]>([])
  /** care の asset / assignment も画面から変わる。永続化は backend 側。 */
  const [careAssets, setCareAssets] = useState<CareVideoAsset[]>(seededCareAssets)
  const [careAssignments, setCareAssignments] = useState<CareAssignment[]>(
    seededCareAssignments
  )
  /** 推奨基準値・方針の版。draft 作成と状態遷移で動く。永続化は backend 側。 */
  const [baselineSets, setBaselineSets] =
    useState<RecommendationBaselineSet[]>(seededBaselineSets)
  const [policySets, setPolicySets] =
    useState<RecommendationPolicySet[]>(seededPolicySets)
  /** 動作ごとの関連筋肉タグ。結果画面に出る表示用の情報。 */
  const [muscleTags, setMuscleTags] = useState<MuscleTagMap>(DEFAULT_MUSCLE_TAGS)
  const [muscleTagHistory, setMuscleTagHistory] = useState<
    MuscleTagHistoryEntry[]
  >([])
  /*
    企業・店舗は本部が管理画面から追加する(吉田さん確定 2026-09-24)。
    🔴 解約・停止は消さずに状態を変える。顧客・分析履歴・同意・保存期限を
       作り直さないため (§2)。
  */
  const [companies, setCompanies] = useState<Company[]>(seededCompanies)
  const [stores, setStores] = useState<Store[]>(seededStores)

  /** アカウントを変えたら視点は全社横断に戻す(他社の視点を持ち越さない)。 */
  function switchAccount(id: string) {
    setAccountId(id)
    setViewCompanyId(undefined)
  }

  /**
   * §11 の変更監査を 1 件足す。画面で起きた操作は必ずここを通す。
   * 🔴 権限判定はどの操作でもここではしない。呼び出し側の decide... が行う。
   */
  const pushAudit = useCallback(
    (category: AuditEvent["category"], targetLabel: string, reason: string) => {
      setAddedAuditEvents((prev) => {
        const actor =
          seededAccounts.find((a) => a.id === accountId) ?? seededAccounts[0]
        return [
          ...prev,
          {
            id: `au_live_${prev.length + 1}`,
            category,
            actorAccountId: actor.id,
            actorName: actor.displayName,
            targetLabel,
            // 理由が任意の操作もあるので、空文字を残さない
            reason: reason.trim() || undefined,
            occurredAt: new Date().toISOString(),
            requestId: `req_live_${pad6(prev.length + 1)}`,
          },
        ]
      })
    },
    [accountId]
  )

  /**
   * 本部デフォルトの差し替え (§7.1)。
   * 🔴 権限判定は呼び出し側の decideCareReplacement()。ここは state と監査だけ。
   */
  const replaceCareAsset = useCallback(
    (videoCode: string, careAssetId: string, reason: string) => {
      const actor =
        seededAccounts.find((a) => a.id === accountId) ?? seededAccounts[0]
      const now = new Date().toISOString()
      setCareAssignments((prev) =>
        applyDirectReplacement(prev, {
          videoCode,
          careAssetId,
          actorName: actor.displayName,
          reason,
          now,
          catalogVersion: CARE_CATALOG_VERSION,
        })
      )
      pushAudit("care_replacement", `${videoCode} の care_asset_id を切り替え`, reason)
    },
    [accountId, pushAudit]
  )

  const addCareVideoAsset = useCallback(
    (input: {
      videoCode: string
      title: string
      provider: string
      durationSeconds: number
      rightsCleared: boolean
      sourceFileName?: string
    }) => {
      const now = new Date().toISOString()
      setCareAssets((prev) => addCareAsset(prev, { ...input, now }))
      pushAudit(
        "care_replacement",
        `${input.videoCode} に動画「${input.title}」(${input.provider})を追加`,
        input.rightsCleared ? "権利確認済として登録" : "権利確認は未完了"
      )
      return careAssetIdFor(input.videoCode, now)
    },
    [pushAudit]
  )

  /**
   * 🔴 可否は呼び出し側の decideInvite()。ここは state と監査だけ。
   *    招待メールの送信は backend の担当なので、この画面は state を進めるだけ。
   */
  const inviteMember = useCallback(
    (
      email: string,
      displayName: string,
      target: MembershipTarget,
      reason: string
    ) => {
      const now = new Date().toISOString()
      /*
        🔴 監査ラベルに新規アカウントの id が要るので、更新関数の中ではなく
           ここで結果を組み立てる。更新関数は StrictMode で 2 回呼ばれるため、
           中で副作用を起こすと監査が二重になる。
      */
      const result = applyInvite(accounts, { email, displayName, target, now })
      setAccounts(result.accounts)
      // 🔴 招待も担当の変更なので §11 の変更監査に残す
      pushAudit(
        "role_change",
        membershipAuditLabel(
          result.accountId,
          target,
          result.isNew ? "invite" : "grant"
        ),
        reason
      )
    },
    [accounts, pushAudit]
  )

  /**
   * 差し替え申請の審査 (§7.1)。
   * 🔴 可否は呼び出し側の decideCareRequestAction()。ここは state と監査だけ。
   */
  const reviewCareRequest = useCallback(
    (requestId: string, action: CareRequestAction, reason: string) => {
      const actor =
        seededAccounts.find((a) => a.id === accountId) ?? seededAccounts[0]
      const now = new Date().toISOString()
      /*
        🔴 監査ラベルに枠と範囲が要るので、更新関数の中ではなくここで対象を引く。
           更新関数は StrictMode で 2 回呼ばれるため、中で監査を積むと二重になる。
      */
      const target = careAssignments.find((a) => a.id === requestId)
      setCareAssignments((prev) =>
        applyCareRequestAction(prev, requestId, action, {
          actorName: actor.displayName,
          now,
          reason,
        })
      )
      if (!target) return
      pushAudit(
        "care_replacement",
        `${target.videoCode} の差し替え申請(${target.requestedBy})を${CARE_REQUEST_ACTION_LABEL[action]}`,
        reason
      )
    },
    [accountId, careAssignments, pushAudit]
  )

  /** 🔴 可否は呼び出し側の decideRightsClear()。ここは state と監査だけ。 */
  const clearCareAssetRights = useCallback(
    (careAssetId: string, reason: string) => {
      const actor =
        seededAccounts.find((a) => a.id === accountId) ?? seededAccounts[0]
      const now = new Date().toISOString()
      const target = careAssets.find((a) => a.id === careAssetId)
      setCareAssets((prev) =>
        applyRightsCleared(prev, careAssetId, { actorName: actor.displayName, now })
      )
      if (!target) return
      pushAudit(
        "care_replacement",
        `動画「${target.title}」(${target.provider})の権利を確認済にした`,
        reason
      )
    },
    [accountId, careAssets, pushAudit]
  )

  /* ---- 企業・店舗 (吉田さん確定 2026-09-24: V1 は本部が管理画面から追加) ---- */

  /*
    🔴 可否は呼び出し側の decideCreateCompany() / decideCreateStore()。
       ここは state と監査だけ。
    🔴 解約・停止した企業の店舗もまとめて止める。店舗だけ動いたままだと、
       契約が切れているのに撮影できる状態になる。
  */
  const createCompany = useCallback(
    (input: {
      name: string
      contractStatus: Company["contractStatus"]
      stores: { name: string; status: Store["status"] }[]
    }) => {
      const now = new Date().toISOString()
      const companyId = nextCompanyId(companies)
      setCompanies((prev) => applyCreateCompany(prev, { ...input, id: companyId }, now))
      setStores((prev) => {
        let next = prev
        for (const st of input.stores) {
          next = applyCreateStore(
            next,
            { id: nextStoreId(companyId, next), companyId, ...st },
            now
          )
        }
        return next
      })
      pushAudit(
        "organization_change",
        `企業「${input.name.trim()}」を追加(店舗 ${input.stores.length} 件)`,
        ""
      )
      return companyId
    },
    [companies, pushAudit]
  )

  const updateCompany = useCallback(
    (
      companyId: CompanyId,
      patch: { name?: string; contractStatus?: Company["contractStatus"] }
    ) => {
      const before = companies.find((c) => c.id === companyId)
      setCompanies((prev) => applyUpdateCompany(prev, companyId, patch))
      if (patch.contractStatus) {
        setStores((prev) =>
          applyCompanyStatusToStores(prev, companyId, patch.contractStatus!)
        )
      }
      if (!before) return
      const what = [
        patch.name && patch.name.trim() !== before.name
          ? `名称を「${patch.name.trim()}」へ`
          : "",
        patch.contractStatus && patch.contractStatus !== before.contractStatus
          ? `契約状態を ${CONTRACT_STATUS_LABEL[patch.contractStatus]} へ`
          : "",
      ]
        .filter(Boolean)
        .join(" / ")
      if (!what) return
      pushAudit("organization_change", `企業「${before.name}」の${what}変更`, "")
    },
    [companies, pushAudit]
  )

  const createStore = useCallback(
    (companyId: CompanyId, input: { name: string; status: Store["status"] }) => {
      const now = new Date().toISOString()
      const company = companies.find((c) => c.id === companyId)
      let storeId = ""
      setStores((prev) => {
        storeId = nextStoreId(companyId, prev)
        return applyCreateStore(prev, { id: storeId, companyId, ...input }, now)
      })
      pushAudit(
        "organization_change",
        `${company?.name ?? companyId} に店舗「${input.name.trim()}」を追加`,
        ""
      )
    },
    [companies, pushAudit]
  )

  const updateStore = useCallback(
    (storeId: StoreId, patch: { name?: string; status?: Store["status"] }) => {
      const before = stores.find((s) => s.id === storeId)
      setStores((prev) => applyUpdateStore(prev, storeId, patch))
      if (!before) return
      const what = [
        patch.name && patch.name.trim() !== before.name
          ? `名称を「${patch.name.trim()}」へ`
          : "",
        patch.status && patch.status !== before.status
          ? `状態を ${patch.status === "active" ? "営業中" : "閉店"} へ`
          : "",
      ]
        .filter(Boolean)
        .join(" / ")
      if (!what) return
      pushAudit("organization_change", `店舗「${before.name}」の${what}変更`, "")
    },
    [stores, pushAudit]
  )

  /* ---- 筋肉タグ ---- */

  /*
    🔴 1 件ずつではなく、編集した結果をまとめて保存する。可否は画面側の
       decideAddMuscleTag()。ここは state と履歴・監査だけ。
    ⚠️ 監査カテゴリに「表示設定の変更」が無いため policy_change を借りている。
       §11 のカテゴリ一覧に足すべきか QUESTIONS_FOR_YOSHIDA.md #23 で確認中。
  */
  const saveMuscleTags = useCallback(
    (next: MuscleTagMap) => {
      const actor =
        seededAccounts.find((a) => a.id === accountId) ?? seededAccounts[0]
      const now = new Date().toISOString()
      const changes = diffMuscleTags(muscleTags, next)
      if (changes.length === 0) return

      setMuscleTags(next)
      setMuscleTagHistory((prev) => [
        {
          id: `mtl_${prev.length + 1}`,
          at: now,
          by: actor.displayName,
          changes,
        },
        ...prev,
      ])
      pushAudit("policy_change", `筋肉タグを変更(${summarize(changes)})`, "")
    },
    [accountId, muscleTags, pushAudit]
  )

  /* ---- 推奨基準値・方針 (§8) ---- */

  /**
   * 🔴 可否は呼び出し側の decideDraftCreate()。ここは state と監査だけ。
   * 🔴 作れるのは draft。active を書き換える経路はどこにも用意しない。
   */
  const createBaselineDraft = useCallback(
    (input: {
      values: { poseCode: RecommendationPose; baseline: number }[]
      note?: string
    }) => {
      const actor =
        seededAccounts.find((a) => a.id === accountId) ?? seededAccounts[0]
      const now = new Date().toISOString()
      /*
        🔴 監査ラベルに新しい version 番号が要る。更新関数は StrictMode で
           2 回呼ばれるので、中で採番すると監査とずれる。ここで確定させる。
      */
      const next = buildBaselineDraft(baselineSets, {
        ...input,
        actorName: actor.displayName,
        now,
      })
      setBaselineSets(next)
      pushAudit(
        "baseline_change",
        `基準値 set ${next[0].version} を draft として作成`,
        input.note?.trim() || "draft 作成"
      )
    },
    [accountId, baselineSets, pushAudit]
  )

  const createPolicyDraft = useCallback(
    (input: {
      tieBreak: string
      missingValueHandling: string
      fallback: string
      note?: string
    }) => {
      const actor =
        seededAccounts.find((a) => a.id === accountId) ?? seededAccounts[0]
      const now = new Date().toISOString()
      const next = buildPolicyDraft(policySets, {
        ...input,
        actorName: actor.displayName,
        now,
      })
      setPolicySets(next)
      pushAudit(
        "policy_change",
        `方針 set ${next[0].version} を draft として作成`,
        input.note?.trim() || "draft 作成"
      )
    },
    [accountId, policySets, pushAudit]
  )

  /** 🔴 可否は呼び出し側の decideSetEdit()。ここは state と監査だけ。 */
  const updateBaselineDraft = useCallback(
    (
      version: string,
      input: {
        values: { poseCode: RecommendationPose; baseline: number }[]
        note?: string
      }
    ) => {
      const now = new Date().toISOString()
      setBaselineSets((prev) => applyBaselineEdit(prev, version, input, { now }))
      pushAudit(
        "baseline_change",
        `基準値セット ${version} の中身を編集`,
        input.note?.trim() || "下書きの編集"
      )
    },
    [pushAudit]
  )

  const updatePolicyDraft = useCallback(
    (
      version: string,
      input: {
        tieBreak: string
        missingValueHandling: string
        fallback: string
        note?: string
      }
    ) => {
      const now = new Date().toISOString()
      setPolicySets((prev) => applyPolicyEdit(prev, version, input, { now }))
      pushAudit(
        "policy_change",
        `方針セット ${version} の中身を編集`,
        input.note?.trim() || "下書きの編集"
      )
    },
    [pushAudit]
  )

  /** 🔴 可否は呼び出し側の decideSetDelete()。ここは state と監査だけ。 */
  const deleteBaselineDraft = useCallback(
    (version: string, reason: string) => {
      setBaselineSets((prev) => applyBaselineDelete(prev, version))
      // 🔴 消した記録は §11 の deletion に残す(消した事実まで消さない)
      pushAudit("deletion", `基準値セット ${version} を削除`, reason)
    },
    [pushAudit]
  )

  const deletePolicyDraft = useCallback(
    (version: string, reason: string) => {
      setPolicySets((prev) => applyPolicyDelete(prev, version))
      pushAudit("deletion", `方針セット ${version} を削除`, reason)
    },
    [pushAudit]
  )

  /**
   * 🔴 可否は呼び出し側の decideSetAction()。ここは state と監査だけ。
   * 🔴 rollback は監査カテゴリも rollback にする (§11 に別項目として挙がっている)。
   */
  const runBaselineAction = useCallback(
    (version: string, action: SetAction, reason: string, scheduledAt?: string) => {
      const actor =
        seededAccounts.find((a) => a.id === accountId) ?? seededAccounts[0]
      const now = new Date().toISOString()
      const next = applyBaselineAction(baselineSets, version, action, {
        actorName: actor.displayName,
        now,
        scheduledAt,
      })
      setBaselineSets(next)
      pushAudit(
        action === "rollback" ? "rollback" : "baseline_change",
        setActionAuditLabel("基準値", version, action, next[0]?.version),
        reason
      )
    },
    [accountId, baselineSets, pushAudit]
  )

  const runPolicyAction = useCallback(
    (version: string, action: SetAction, reason: string, scheduledAt?: string) => {
      const actor =
        seededAccounts.find((a) => a.id === accountId) ?? seededAccounts[0]
      const now = new Date().toISOString()
      const next = applyPolicyAction(policySets, version, action, {
        actorName: actor.displayName,
        now,
        scheduledAt,
      })
      setPolicySets(next)
      pushAudit(
        action === "rollback" ? "rollback" : "policy_change",
        setActionAuditLabel("方針", version, action, next[0]?.version),
        reason
      )
    },
    [accountId, policySets, pushAudit]
  )

  /** 🔴 可否は呼び出し側の decideMembershipEdit()。ここは state と監査だけ。 */
  const changeMembership = useCallback(
    (
      targetAccountId: AccountId,
      target: MembershipTarget,
      action: "grant" | "revoke",
      reason: string
    ) => {
      setAccounts((prev) =>
        applyMembershipChange(prev, targetAccountId, target, action)
      )
      pushAudit(
        "role_change",
        membershipAuditLabel(targetAccountId, target, action),
        reason
      )
    },
    [pushAudit]
  )

  const value = useMemo<SessionValue>(() => {
    const account = accounts.find((a) => a.id === accountId) ?? accounts[0]
    const scope = resolveScope(account, stores)

    const scopedStores = scope.crossCompany
      ? stores
      : stores.filter((s) => scope.storeIds.includes(s.id))

    const scopedCompanies = scope.crossCompany
      ? companies
      : companies.filter(
          (c) =>
            c.id === scope.companyId ||
            scopedStores.some((s) => s.companyId === c.id)
        )

    /*
      視点として選べる企業。本部は全契約企業から選び、
      それ以外は所属企業に固定される(選択肢は 1 件)。
      本部(internal)は契約企業ではないので選択肢に出さない。
    */
    const viewableCompanies = scopedCompanies.filter((c) => c.kind === "partner")

    /*
      実際に見ている企業。
      店舗管理者・店舗スタッフは scope に companyId を持たないため店舗から引き直す。
    */
    const effectiveCompanyId = scope.crossCompany
      ? viewCompanyId
      : brandingCompanyIdFor(scope, stores)

    const viewStores = effectiveCompanyId
      ? scopedStores.filter((s) => s.companyId === effectiveCompanyId)
      : scopedStores

    /*
      本部が 1 社に絞ったときは、その企業の店舗に連携している顧客だけに絞る。
      権限そのものは operator のままなので scope は書き換えない。
    */
    const viewScope = viewScopeFor(scope, effectiveCompanyId, stores)

    const allIds = customers.map((c) => c.dataSubjectId)
    const allowedIds = new Set<DataSubjectId>(
      visibleCustomerIds(viewScope, allIds, storeDataLinks)
    )

    return {
      account,
      scope,
      accounts,
      switchAccount,
      changeMembership,
      inviteMember,
      auditEvents: [...seededAuditEvents, ...addedAuditEvents],
      careAssets,
      careAssignments,
      replaceCareAsset,
      addCareVideoAsset,
      reviewCareRequest,
      clearCareAssetRights,
      createCompany,
      updateCompany,
      createStore,
      updateStore,
      muscleTags,
      muscleTagHistory,
      saveMuscleTags,
      baselineSets,
      policySets,
      createBaselineDraft,
      createPolicyDraft,
      updateBaselineDraft,
      updatePolicyDraft,
      deleteBaselineDraft,
      deletePolicyDraft,
      runBaselineAction,
      runPolicyAction,
      viewCompanyId: effectiveCompanyId,
      viewableCompanies,
      setViewCompany: setViewCompanyId,
      // 🔴 管理画面の surface。B2C は企業設定を受けない
      branding: resolveBranding("admin", effectiveCompanyId, companyBrandings),
      companies: effectiveCompanyId
        ? scopedCompanies.filter((c) => c.id === effectiveCompanyId)
        : scopedCompanies,
      stores: viewStores,
      customers: customers.filter((c) => allowedIds.has(c.dataSubjectId)),
      analysisSessions: analysisSessions.filter((s) =>
        allowedIds.has(s.dataSubjectId)
      ),
      carePlaybacks: carePlaybacks.filter((p) => allowedIds.has(p.dataSubjectId)),
      storeDataLinks,
      totalCustomerCount: customers.length,
    }
  }, [
    accountId,
    viewCompanyId,
    accounts,
    addedAuditEvents,
    changeMembership,
    inviteMember,
    careAssets,
    careAssignments,
    replaceCareAsset,
    addCareVideoAsset,
    reviewCareRequest,
    clearCareAssetRights,
    companies,
    stores,
    createCompany,
    updateCompany,
    createStore,
    updateStore,
    muscleTags,
    muscleTagHistory,
    saveMuscleTags,
    baselineSets,
    policySets,
    createBaselineDraft,
    createPolicyDraft,
    updateBaselineDraft,
    updatePolicyDraft,
    deleteBaselineDraft,
    deletePolicyDraft,
    runBaselineAction,
    runPolicyAction,
  ])

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}
