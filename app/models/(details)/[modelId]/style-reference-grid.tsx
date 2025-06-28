"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, ChevronUp, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type StyleReferenceImage } from "@/lib/style-reference-images"

interface StyleReferenceGridProps {
  images: StyleReferenceImage[]
  modelName: string
}

export default function StyleReferenceGrid({ images, modelName }: StyleReferenceGridProps) {
  const [showAll, setShowAll] = useState(false)

  // Determine how many images to show initially
  const initialDisplayCount = 12
  const shouldShowToggle = images.length > initialDisplayCount
  const displayImages = shouldShowToggle && !showAll ? images.slice(0, initialDisplayCount) : images

  if (images.length === 0) {
    return (
      <div className="text-center py-8">
        <Palette className="mx-auto h-12 w-12 text-slate-300 mb-4" />
        <p className="text-slate-500">No style reference images available</p>
      </div>
    )
  }

  const isDefaultImages = images[0].src.startsWith("/")
  const isTrainingImages = !isDefaultImages && images[0].alt.includes("training image")

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {displayImages.map((img, index) => (
          <div
            key={index}
            className="aspect-square relative rounded-lg overflow-hidden hover:shadow-xl transition-shadow group cursor-pointer"
          >
            <Image
              src={img.src || "/placeholder.svg"}
              alt={img.alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
              className="object-cover group-hover:scale-105 transition-transform duration-200"
            />
            {/* Overlay with image number for large sets */}
            {images.length > 12 && (
              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Show More/Less Button */}
      {shouldShowToggle && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShowAll(!showAll)} className="gap-2">
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show All {images.length} Images
              </>
            )}
          </Button>
        </div>
      )}

      {/* Info Messages */}
      {isDefaultImages && (
        <p className="text-xs text-slate-400 italic">
          No custom style images found. Upload images to assets/{modelName} bucket to show
          model-specific examples.
        </p>
      )}

      {isTrainingImages && (
        <p className="text-xs text-slate-600 italic">
          ✨ These are the actual training images used to create this model.
        </p>
      )}
    </div>
  )
}
