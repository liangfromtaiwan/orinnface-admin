export function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-medium">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">仮ページ — 後日実装</p>
    </div>
  )
}
