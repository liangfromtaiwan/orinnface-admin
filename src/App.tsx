import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="p-8 space-y-4">
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  )
}

export default App
