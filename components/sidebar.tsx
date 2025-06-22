"use client"

import Link from "next/link"
import { useState } from "react"
import {
  LayoutGrid,
  Heart,
  FolderPlus,
  CuboidIcon as Cube,
  Sparkles,
  Cpu,
  Palette,
	Paintbrush,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const Sidebar = () => {
  const [assetsOpen, setAssetsOpen] = useState(true)

  return (
    <div className="w-64 bg-white p-4 space-y-6 border-r border-slate-200 flex flex-col">
      <div className="flex items-center space-x-2">
        <Paintbrush className="w-8 h-8 text-slate-800" />
        <h1 className="text-xl font-bold text-slate-800">essence</h1>
      </div>

      <nav className="flex-grow space-y-2 text-[16px]">
        <div>
					<Link href="/">
          <Button
            variant="ghost"
            className="w-full justify-between items-center text-slate-700 hover:bg-slate-100"
						>
            <div className="flex items-center space-x-2">
              <LayoutGrid className="w-5 h-5" />
              <span className="text-[16px]">Explore</span>
            </div>
          </Button>
						</Link>
        </div>

        <Link
          href="/models"
          className="flex items-center space-x-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-md"
        >
          <Cpu className="w-5 h-5" />
          <span>Models</span>
        </Link>

        <div>
          <Button
            variant="ghost"
            className="w-full justify-between items-center text-slate-700 hover:bg-slate-100"
            onClick={() => setAssetsOpen(!assetsOpen)}
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-[16px] text-slate-700 font-normal">IP Assets</span>
            </div>
          </Button>
          {/* Add asset sub-items if any, similar to explore */}
        </div>

        <Link href="#" className="flex items-center space-x-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-md">
          <Heart className="w-5 h-5" />
          <span className="text-[16px]">Likes</span>
        </Link>

        <div className="pt-4">
          <h2 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">My Creations</h2>
          <Link
            href="#" // This link would ideally go to a page listing all studio items
            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
          >
            <Palette className="w-5 h-5 text-slate-500" />
            <span>All Creations</span>
          </Link>
          <Link
            href="#"
            className="flex items-center space-x-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
          >
            <FolderPlus className="w-5 h-5 text-slate-500" />
            <span>New Folder</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}

export default Sidebar
