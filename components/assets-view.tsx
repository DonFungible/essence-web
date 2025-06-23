"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, ImageIcon as ImageIconLucide, Shapes, PaletteIcon, TagIcon } from "lucide-react" // Renamed ImageIcon to avoid conflict
import AssetGrid from "./asset-grid" // Import AssetGrid
import type { Asset } from "@/lib/assets-data" // Use Asset type from lib

const assetFilterCategories = [
  { name: "All", icon: Filter },
  { name: "Photos", icon: ImageIconLucide },
  { name: "Vectors", icon: Shapes },
  { name: "Illustrations", icon: PaletteIcon },
  { name: "Icons", icon: TagIcon },
]

export default function AssetsView({ initialAssets }: { initialAssets: Asset[] }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")

  const handleFilterClick = (filterName: string) => {
    setActiveFilter(filterName)
    console.log("Active filter:", filterName)
    // Placeholder for actual filtering logic based on category/tags
  }

  const filteredAssets = useMemo(() => {
    let result = initialAssets

    // Search filter (by name or tags)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (asset) =>
          asset.name.toLowerCase().includes(term) || asset.tags?.some((tag) => tag.toLowerCase().includes(term)),
      )
    }

    // Category filter (placeholder - needs actual logic if assets have categories or tags matching filter names)
    if (activeFilter !== "All") {
      // Example: if assets had a 'category' property:
      // result = result.filter((asset) => asset.category === activeFilter);
      // Or if filtering by tags:
      // result = result.filter(asset => asset.tags?.includes(activeFilter.toLowerCase()));
      console.log(`Filtering by ${activeFilter} - (actual filtering logic to be implemented)`)
    }

    return result
  }, [initialAssets, searchTerm, activeFilter])

  return (
    <div className="space-y-6">
      {/* Filter Bar Section */}
      <div className="sticky top-[var(--top-bar-height,64px)] bg-slate-100 py-4 z-10 shadow-sm rounded-lg">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <Input
                type="search"
                placeholder="Search assets by name or tag..."
                className="pl-10 w-full bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
              {assetFilterCategories.map((filter) => (
                <Button
                  key={filter.name}
                  variant={activeFilter === filter.name ? "default" : "outline"}
                  size="sm"
                  className={`flex-shrink-0 ${
                    activeFilter === filter.name
                      ? "bg-slate-700 hover:bg-slate-800 text-white"
                      : "bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                  onClick={() => handleFilterClick(filter.name)}
                >
                  <filter.icon className="mr-2 h-4 w-4" />
                  {filter.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Asset Grid Section */}
      <AssetGrid assets={filteredAssets} />
    </div>
  )
}
