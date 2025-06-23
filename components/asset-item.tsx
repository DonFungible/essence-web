"use client"

import type React from "react"

import Image from "next/image"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Asset } from "@/lib/assets-data"

interface AssetItemProps {
  asset: Asset
  isSelected: boolean
  onSelectToggle: (assetId: string) => void
}

export default function AssetItem({ asset, isSelected, onSelectToggle }: AssetItemProps) {
  const handleCardClick = () => {
    onSelectToggle(asset.id)
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    // Prevent card click from firing when checkbox is clicked directly
    e.stopPropagation()
    onSelectToggle(asset.id)
  }

  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer transition-all duration-200 ease-in-out",
        isSelected ? "ring-2 ring-blue-500 shadow-lg" : "hover:shadow-md",
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0 relative">
        <div className="absolute top-2 right-2 z-10">
          <Checkbox
            id={`select-${asset.id}`}
            checked={isSelected}
            onCheckedChange={() => onSelectToggle(asset.id)}
            onClick={handleCheckboxClick} // Added to handle direct checkbox click
            aria-label={`Select ${asset.name}`}
            className="bg-white/80 hover:bg-white border-slate-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
          />
        </div>
        <div className="aspect-video relative">
          <Image
            src={asset.src || "/placeholder.svg"}
            alt={asset.alt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={cn(
              "object-cover transition-transform duration-300 ease-in-out",
              isSelected ? "scale-105" : "group-hover:scale-105",
            )}
            priority={asset.id === "asset_001" || asset.id === "asset_002"} // Prioritize first few images
          />
        </div>
        {isSelected && <div className="absolute inset-0 bg-blue-500 bg-opacity-20 pointer-events-none" />}
      </CardContent>
      <div className="p-3 bg-white">
        <h3 className="font-medium text-sm text-slate-700 truncate" title={asset.name}>
          {asset.name}
        </h3>
        {asset.tags && asset.tags.length > 0 && (
          <p className="text-xs text-slate-500 truncate">{asset.tags.join(", ")}</p>
        )}
      </div>
    </Card>
  )
}
