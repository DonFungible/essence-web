"use client"

import { useState } from "react"
import AssetItem from "./asset-item"
import { Button } from "@/components/ui/button"
import { ImageIcon } from "lucide-react"
import type { Asset } from "@/lib/assets-data"

interface AssetGridProps {
  assets: Asset[] // Changed from initialAssets to assets, assuming filtering might happen before this component
}

export default function AssetGrid({ assets }: AssetGridProps) {
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  // isLoading state might be managed by a parent component if assets are fetched/filtered there
  // const [isLoading, setIsLoading] = useState(false);

  const handleSelectAsset = (assetId: string) => {
    setSelectedAssets((prevSelected) => {
      const newSelected = new Set(prevSelected)
      if (newSelected.has(assetId)) {
        newSelected.delete(assetId)
      } else {
        newSelected.add(assetId)
      }
      console.log("Selected assets:", Array.from(newSelected))
      return newSelected
    })
  }

  const handleCompileSelected = () => {
    if (selectedAssets.size === 0) {
      alert("Please select at least one asset to compile.")
      return
    }
    const selectedAssetDetails = assets.filter((asset) => selectedAssets.has(asset.id))
    console.log("Compiling selected assets:", selectedAssetDetails)
    alert(`Compiling ${selectedAssets.size} assets. Check console for details.`)
  }

  // Assuming loading state is handled by parent if assets are fetched/filtered there
  // if (isLoading) { ... }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-center p-4 border border-dashed rounded-lg border-slate-300">
        <ImageIcon className="h-12 w-12 text-slate-400 mb-4" />
        <h3 className="text-xl font-semibold text-slate-700 mb-1">No Assets Found</h3>
        <p className="text-slate-500">No assets match your current filters, or your library is empty.</p>
      </div>
    )
  }

  return (
    <div>
      {selectedAssets.size > 0 && (
        <div className="mb-6 p-4 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-between sticky top-[calc(var(--top-bar-height,64px)+var(--filter-bar-height,120px))] z-20 shadow-sm">
          {/* Adjusted sticky top value if TopBar and FilterBar have fixed heights */}
          <p className="text-sm font-medium text-slate-700">
            {selectedAssets.size} asset{selectedAssets.size === 1 ? "" : "s"} selected
          </p>
          <Button onClick={handleCompileSelected} size="sm" variant="default">
            Compile Selected Images
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {assets.map((asset) => (
          <AssetItem
            key={asset.id}
            asset={asset}
            isSelected={selectedAssets.has(asset.id)}
            onSelectToggle={handleSelectAsset}
          />
        ))}
      </div>
    </div>
  )
}
