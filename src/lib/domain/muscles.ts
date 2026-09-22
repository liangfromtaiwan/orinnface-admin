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

/** 1 動作に付けられるタグの上限。画面のカード幅に収まる数。 */
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
  too_many: `1 つの動作に付けられるのは ${MAX_TAGS_PER_POSE} 件までです。`,
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
