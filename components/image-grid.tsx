"use client"
import Link from "next/link" // Added Link import
import { Heart, Copy, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import SafeImage from "./safe-image"

const images = [
  {
    id: 1,
    title: "Gallery Image 1",
    src: "/gallery/mj1.png",
    alt: "Gallery artwork 1",
    aspect: "portrait",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 13,
    title: "Gallery Image 2",
    src: "/gallery/mj13.png",
    alt: "Gallery artwork 2",
    aspect: "landscape",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 3,
    title: "Gallery Image 3",
    src: "/gallery/mj3.png",
    alt: "Gallery artwork 3",
    aspect: "portrait",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 4,
    title: "Gallery Image 4",
    src: "/gallery/mj4.png",
    alt: "Gallery artwork 4",
    aspect: "landscape",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 5,
    title: "Gallery Image 5",
    src: "/gallery/mj5.png",
    alt: "Gallery artwork 5",
    aspect: "landscape",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 6,
    title: "Gallery Image 6",
    src: "/gallery/mj6.png",
    alt: "Gallery artwork 6",
    aspect: "portrait",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 7,
    title: "Gallery Image 7",
    src: "/gallery/mj7.png",
    alt: "Gallery artwork 7",
    aspect: "landscape",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 8,
    title: "Gallery Image 8",
    src: "/gallery/mj8.png",
    alt: "Gallery artwork 8",
    aspect: "portrait",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 9,
    title: "Gallery Image 9",
    src: "/gallery/mj9.png",
    alt: "Gallery artwork 9",
    aspect: "landscape",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 10,
    title: "Gallery Image 10",
    src: "/gallery/mj10.png",
    alt: "Gallery artwork 10",
    aspect: "portrait",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 11,
    title: "Gallery Image 11",
    src: "/gallery/mj11.png",
    alt: "Gallery artwork 11",
    aspect: "landscape",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 12,
    title: "Gallery Image 12",
    src: "/gallery/mj12.png",
    alt: "Gallery artwork 12",
    aspect: "portrait",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 2,
    title: "Gallery Image 13",
    src: "/gallery/mj2.png",
    alt: "Gallery artwork 13",
    aspect: "landscape",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 14,
    title: "Gallery Image 13",
    src: "/gallery/mj14.png",
    alt: "Gallery artwork 14",
    aspect: "landscape",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
  {
    id: 15,
    title: "Gallery Image 13",
    src: "/gallery/mj15.png",
    alt: "Gallery artwork 15",
    aspect: "landscape",
    author: "Name",
    description: "AI-generated artwork from the gallery collection.",
    model: "Essence 3.0",
  },
]

// Exporting images array and type for use in the detail page
export type ImageType = (typeof images)[0]
export const getImageById = (id: number): ImageType | undefined => {
  return images.find((img) => img.id === id)
}

const ImageGridItem = ({ image }: { image: (typeof images)[0] }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Link href={`/image/${image.id}`} passHref>
      <div
        className="relative rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-lg transition-shadow duration-300 h-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <SafeImage
          src={image.src || "/placeholder.svg"}
          alt={image.alt}
          width={image.aspect === "portrait" ? 400 : 600}
          height={image.aspect === "portrait" ? 600 : 400}
          className="w-full h-full object-contain"
          unoptimized
        />
        {isHovered && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex flex-col justify-end p-3 transition-opacity duration-300">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white font-medium px-2 py-1 rounded">{image.author}</p>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-white hover:bg-white/20 hover:text-white"
                >
                  <Type className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-white hover:bg-white/20 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-white hover:bg-white/20 hover:text-white"
                >
                  <Heart className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

const ImageGrid = () => {
  // Masonry layout using flexbox columns
  const columnCount = {
    mobile: 1,
    tablet: 2,
    desktop: 5,
  }

  // Distribute images across columns
  const distributeImages = (imageList: ImageType[], cols: number) => {
    const columns: ImageType[][] = Array.from({ length: cols }, () => [])

    imageList.forEach((image: ImageType, index: number) => {
      const columnIndex = index % cols
      columns[columnIndex].push(image)
    })

    return columns
  }

  const mobileColumns = distributeImages(images, columnCount.mobile)
  const tabletColumns = distributeImages(images, columnCount.tablet)
  const desktopColumns = distributeImages(images, columnCount.desktop)

  return (
    <>
      {/* Mobile Layout */}
      <div className="flex gap-4 sm:hidden">
        {mobileColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-4 flex-1">
            {column.map((image: ImageType) => (
              <div key={image.id} className="mb-4">
                <ImageGridItem image={image} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Tablet Layout */}
      <div className="hidden sm:flex md:hidden gap-4">
        {tabletColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-4 flex-1">
            {column.map((image: ImageType) => (
              <div key={image.id} className="mb-4">
                <ImageGridItem image={image} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex gap-2">
        {desktopColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-2 flex-1">
            {column.map((image: ImageType) => (
              <div key={image.id} className="">
                <ImageGridItem image={image} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

export default ImageGrid
