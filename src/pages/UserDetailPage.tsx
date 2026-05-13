import { useParams } from "react-router-dom"
import { Placeholder } from "./_placeholder"

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <Placeholder title={`ユーザー詳細 (ID: ${id ?? "—"})`} />
}
