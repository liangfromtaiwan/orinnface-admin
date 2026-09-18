/**
 * 監査に残る操作の理由入力 (仕様書 v1.0 §13「重い操作は確認画面と理由入力」)
 *
 * 🔴 必須であることを**入力欄の側**で先に伝える。押せないボタンだけで伝えると、
 *    押してから初めて気づくことになる。
 * 🔴 入っていない間は枠を警告色にする。ダイアログの中で唯一の未入力を探させない。
 * 理由は §11 の変更監査にそのまま残るので、文面は操作の説明になっている必要がある。
 */

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function ReasonField({
  value,
  onChange,
  label = "理由",
  placeholder = "監査に残ります",
  hint,
}: {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  /** 何を書けばよいかの補足。必要なときだけ。 */
  hint?: string
}) {
  const empty = !value.trim()

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          必須
        </span>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-required
        className={cn("h-9", empty && "border-destructive/50")}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
