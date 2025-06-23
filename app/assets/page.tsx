import type React from "react"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import AssetsView from "@/components/assets-view"
import { getAssets } from "@/lib/assets-data"

// Define CSS variables for dynamic sticky top positioning
const topBarHeight = "64px"

export default async function AssetsPage() {
  const initialAssets = await getAssets()

  return (
    <div
      className="flex h-screen"
      style={{ "--top-bar-height": topBarHeight } as React.CSSProperties}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        {/* Changed main background to bg-slate-50 to match the parent wrapper */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-slate-800">Assets Library</h1>
            <p className="text-slate-600">Browse, select, and manage your creative assets.</p>
          </div>
          <AssetsView initialAssets={initialAssets} />
        </main>
      </div>
    </div>
  )
}
