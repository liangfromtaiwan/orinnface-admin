import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// birthDate("YYYY-MM-DD") → 今日時点の満年齢
export function calculateAge(birthDate: string): number {
  const today = new Date()
  const [y, m, d] = birthDate.split("-").map(Number)
  let age = today.getFullYear() - y
  const beforeBirthday =
    today.getMonth() + 1 < m ||
    (today.getMonth() + 1 === m && today.getDate() < d)
  if (beforeBirthday) age--
  return age
}
