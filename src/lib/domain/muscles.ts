/**
 * 動作ごとの関連筋肉タグ
 *
 * 🔴 ユーザー向け結果画面で、各動作のカードの下に出るタグ (2026-09-21 確認)。
 *    どの筋肉に効く動作なのかを本人に伝えるためのもので、推奨の順位や判定には
 *    使わない(表示だけ)。
 * 🔴 本部が編集できる(使用者確定 2026-09-22)。監修の見直しで名前や本数が変わる
 *    ためで、コードに埋めてしまうとそのたびにリリースが要る。
 * ⚠️ 仕様書 v1.0 にも AI推奨 v1.2 にも、このタグの記述は見つかっていない。
 *    正本がどこかは QUESTIONS_FOR_YOSHIDA.md #23 で確認中。
 */

import type { PoseCode } from "./types"

export type MusclePose = Exclude<PoseCode, "neutral">

export type MuscleTagMap = Record<MusclePose, string[]>

/** 結果画面に出ていた並びをそのまま初期値にする。 */
export const DEFAULT_MUSCLE_TAGS: MuscleTagMap = {
  smile: ["頬骨筋", "口輪筋"],
  pucker: ["口輪筋", "口角下制筋"],
  jaw_open: ["口角下制筋", "咬筋"],
  eye_open: ["眼輪筋"],
  brow_furrow: ["前頭筋", "皺眉筋"],
}

/**
 * 画面に出す説明文。
 * 🔴 吉田さん確定 2026-09-24 の文言をそのまま使う。言い換えない。
 */
export const MUSCLE_TAG_DESCRIPTION =
  "その動作に関係する筋肉を示す表示用タグ"

/**
 * 1 動作に付けられるタグの上限。
 * ⚠️ **暫定**。4 件という数は吉田さん 2026-09-24 時点で「未確定」。画面のカード幅に
 *    収まる数として置いているだけなので、決まったら差し替える。
 */
export const MAX_TAGS_PER_POSE = 4

export type MuscleTagDenial =
  /** 本部以外。 */
  | "not_operator"
  /** 同じ動作に同じ名前が既にある。 */
  | "duplicate"
  /** 上限に達している。 */
  | "too_many"
  /** 空文字・空白だけ。 */
  | "empty"

export const MUSCLE_TAG_DENIAL_LABEL: Record<MuscleTagDenial, string> = {
  not_operator: "筋肉タグを編集できるのは本部だけです。",
  duplicate: "同じ筋肉がすでに登録されています。",
  too_many: `1 つの動作に付けられるのは ${MAX_TAGS_PER_POSE} 件までです(この上限は暫定)。`,
  empty: "筋肉名を入力してください。",
}

export type MuscleTagDecision =
  | { kind: "allowed" }
  | { kind: "denied"; reason: MuscleTagDenial }

/**
 * タグを足せるか。
 * 🔴 可否はここだけで決める。画面側で role を直接見て分岐しない。
 */
export function decideAddMuscleTag(
  canEdit: boolean,
  current: string[],
  name: string
): MuscleTagDecision {
  if (!canEdit) return { kind: "denied", reason: "not_operator" }
  const trimmed = name.trim()
  if (!trimmed) return { kind: "denied", reason: "empty" }
  if (current.includes(trimmed)) return { kind: "denied", reason: "duplicate" }
  if (current.length >= MAX_TAGS_PER_POSE) {
    return { kind: "denied", reason: "too_many" }
  }
  return { kind: "allowed" }
}

export function addMuscleTag(
  tags: MuscleTagMap,
  pose: MusclePose,
  name: string
): MuscleTagMap {
  const trimmed = name.trim()
  const current = tags[pose]
  if (decideAddMuscleTag(true, current, trimmed).kind !== "allowed") return tags
  return { ...tags, [pose]: [...current, trimmed] }
}

export function removeMuscleTag(
  tags: MuscleTagMap,
  pose: MusclePose,
  name: string
): MuscleTagMap {
  return { ...tags, [pose]: tags[pose].filter((t) => t !== name) }
}

/**
 * 名前を変える。
 * 🔴 同じ筋肉が複数の動作に付いている(口輪筋・口角下制筋)。1 か所だけ直すと
 *    画面上で同じ筋肉が 2 つの名前で出てしまうため、**全動作をまとめて**直す。
 */
export function renameMuscleTag(
  tags: MuscleTagMap,
  from: string,
  to: string
): MuscleTagMap {
  const trimmed = to.trim()
  if (!trimmed) return tags
  const out = {} as MuscleTagMap
  for (const [pose, list] of Object.entries(tags) as [MusclePose, string[]][]) {
    // 改名先が既にある動作では重複させない
    const renamed = list.map((t) => (t === from ? trimmed : t))
    out[pose] = [...new Set(renamed)]
  }
  return out
}

/** 今使われている筋肉名の一覧(重複なし・出現順)。 */
export function allMuscleNames(tags: MuscleTagMap): string[] {
  return [...new Set(Object.values(tags).flat())]
}

/* ------------------------------------------------------------------ *
 * 変更の確認と履歴 (吉田さん確定 2026-09-24)
 *
 * 🔴 保存する前に「何が変わるか」を出す。タグはユーザーの結果画面に出るので、
 *    押した瞬間に反映されると、意図しない変更に気付けない。
 * 🔴 変更は履歴に残す。誰がいつ何を変えたかを後から追えるようにする。
 * ------------------------------------------------------------------ */

export type MuscleTagChange =
  | { kind: "added"; pose: MusclePose; name: string }
  | { kind: "removed"; pose: MusclePose; name: string }
  | { kind: "renamed"; from: string; to: string; poses: MusclePose[] }

/**
 * 2 つの状態の差分。
 * 🔴 改名は「全動作で同時に消えて足された」形に見えるので、先に拾ってから
 *    追加・削除を数える。そうしないと 1 回の改名が「削除 2 + 追加 2」に見える。
 */
export function diffMuscleTags(
  before: MuscleTagMap,
  after: MuscleTagMap
): MuscleTagChange[] {
  const poses = Object.keys(before) as MusclePose[]
  const removedBy = new Map<string, MusclePose[]>()
  const addedBy = new Map<string, MusclePose[]>()

  for (const pose of poses) {
    for (const name of before[pose]) {
      if (!after[pose].includes(name)) {
        removedBy.set(name, [...(removedBy.get(name) ?? []), pose])
      }
    }
    for (const name of after[pose]) {
      if (!before[pose].includes(name)) {
        addedBy.set(name, [...(addedBy.get(name) ?? []), pose])
      }
    }
  }

  const changes: MuscleTagChange[] = []

  // 消えた名前と足された名前が同じ動作の集合なら、改名とみなす
  for (const [from, fromPoses] of removedBy) {
    for (const [to, toPoses] of addedBy) {
      const same =
        fromPoses.length === toPoses.length &&
        fromPoses.every((p) => toPoses.includes(p))
      if (same) {
        changes.push({ kind: "renamed", from, to, poses: fromPoses })
        removedBy.delete(from)
        addedBy.delete(to)
        break
      }
    }
  }

  for (const [name, list] of removedBy) {
    for (const pose of list) changes.push({ kind: "removed", pose, name })
  }
  for (const [name, list] of addedBy) {
    for (const pose of list) changes.push({ kind: "added", pose, name })
  }
  return changes
}

export type MuscleTagHistoryEntry = {
  id: string
  at: string
  by: string
  changes: MuscleTagChange[]
}
