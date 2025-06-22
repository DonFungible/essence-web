import Sidebar from "@/components/sidebar"
import MainContent from "@/components/main-content"

export default function BrainwavePage() {
  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <MainContent />
    </div>
  )
}
