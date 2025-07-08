"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronDown, ChevronUp, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type StyleReferenceImage } from "@/lib/style-reference-images"

interface StyleReferenceGridProps {
  images: StyleReferenceImage[]
  modelName: string
}

// Custom IP Asset Icon Component
function IPAssetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M15.4425 5.12514C17.8684 2.39703 22.1316 2.39703 24.5575 5.12514C25.6393 6.34163 27.1625 7.07516 28.7881 7.16245C32.4335 7.3582 35.0916 10.6913 34.4712 14.2889C34.1946 15.8931 34.5708 17.5414 35.5161 18.8667C37.6359 21.8389 36.6873 25.9951 33.4878 27.7532C32.0611 28.5372 31.007 29.859 30.5602 31.4243C29.5581 34.9349 25.7172 36.7846 22.3478 35.3792C20.8453 34.7526 19.1547 34.7526 17.6522 35.3792C14.2828 36.7846 10.4419 34.9349 9.43984 31.4243C8.99302 29.859 7.93893 28.5372 6.51223 27.7532C3.31269 25.9952 2.36406 21.8389 4.48394 18.8667C5.42921 17.5414 5.80541 15.8931 5.52879 14.2889C4.90844 10.6913 7.56645 7.3582 11.2119 7.16245C12.8375 7.07516 14.3607 6.34163 15.4425 5.12514Z"
        fill="white"
      />
      <path
        d="M15.3444 14.73V25.5H12.8394V14.73H15.3444ZM20.1631 21.75V25.5H17.6581V14.73H24.4381C26.9731 14.73 28.6381 15.93 28.6381 18.24C28.6381 20.535 26.9731 21.75 24.4381 21.75H20.1631ZM20.1631 19.65H24.3031C25.4881 19.65 26.1631 19.125 26.1631 18.24C26.1631 17.355 25.4881 16.845 24.3031 16.845H20.1631V19.65Z"
        fill="#1C1C1C"
      />
    </svg>
  )
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
        {displayImages.map((img, index) => {
          const ImageContent = (
            <>
              <Image
                src={img.src || "/placeholder.svg"}
                alt={img.alt}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                className="object-cover group-hover:scale-105 transition-transform duration-200"
              />
              {/* IP Asset indicator for registered images */}
              {img.ipId && (
                <div className="absolute top-2 right-2 text-white text-xs px-0 py-0 rounded flex items-center gap-1">
                  <IPAssetIcon className="w-8 h-8" />
                </div>
              )}
            </>
          )

          return img.ipId ? (
            <Link
              key={index}
              href={`https://aeneid.explorer.story.foundation/ipa/${img.ipId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square relative rounded-lg overflow-hidden hover:shadow-xl transition-shadow group cursor-pointer"
            >
              {ImageContent}
            </Link>
          ) : (
            <div
              key={index}
              className="aspect-square relative rounded-lg overflow-hidden hover:shadow-xl transition-shadow group cursor-pointer"
            >
              {ImageContent}
            </div>
          )
        })}
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
        <div className="space-y-1">
          <p className="text-xs text-slate-600 italic">
            ✨ These are the actual training images used to create this model.
          </p>
          {displayImages.some((img) => img.ipId) && (
            <p className="text-xs text-slate-500 italic">
              🔗 Images with{" "}
              <span className="inline-flex items-center gap-1 px-1 rounded">
                <IPAssetIcon className="w-3 h-3" />
              </span>{" "}
              badges are registered as IP assets. Click to view on Story Explorer.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
