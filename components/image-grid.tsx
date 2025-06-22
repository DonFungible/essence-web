"use client"
import Link from "next/link" // Added Link import
import { Heart, Copy, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import SafeImage from "./safe-image"

const images = [
  {
    id: 1,
    title: "Mirrored Monolith",
    src: "/surreal-landscape-mirror.png",
    alt: "Surreal landscape with a mirrored monolith",
    aspect: "portrait",
    author: "Alex Doe",
    description:
      "A reflective monolith stands tall in a serene, grassy landscape under a clear sky, creating a surreal juxtaposition of nature and artificiality.",
    model: "Essence 2.5",
  },
  {
    id: 2,
    title: "Cybernetic Visor",
    src: "/futuristic-helmet.png",
    alt: "Futuristic helmet with a glowing red visor",
    aspect: "landscape",
    author: "Tran Mau Tri Tam",
    description:
      "Sleek, dark futuristic helmet design featuring a prominent red glowing visor. The overall aesthetic is minimalist and high-tech.",
    model: "Essence 3.0 Alpha",
  },
  {
    id: 3,
    title: "Pastel Architecture",
    src: "/pastel-architecture-horse.png",
    alt: "Architectural detail with a horse",
    aspect: "portrait",
    author: "Maria Lin",
    description:
      "A study of form and color in architecture, featuring pastel-colored walls and a lone horse. The composition highlights geometric shapes and soft lighting.",
    model: "Essence 2.5",
  },
  {
    id: 4,
    title: "Brushed Metal Device",
    src: "/minimalist-brushed-metal.png",
    alt: "Minimalist object with brushed metal texture",
    aspect: "landscape",
    author: "John Smith",
    description:
      "A close-up shot of a minimalist device with a brushed metal finish. The design emphasizes clean lines and subtle details.",
    model: "Essence Custom",
  },
  {
    id: 5,
    title: "Classic Coupe",
    src: "/vintage-white-car.png",
    alt: "Vintage car render",
    aspect: "landscape",
    author: "Jane Roe",
    description:
      "A 3D render of a classic white coupe, showcasing its timeless design and smooth curves. The lighting is soft, highlighting the car's form.",
    model: "Essence 2.5",
  },
  {
    id: 6,
    title: "Foam Heart",
    src: "/placeholder-wj196.png",
    alt: "Abstract coffee foam art",
    aspect: "landscape",
    author: "Unknown Artist",
    description:
      "An abstract macro shot of coffee foam, with patterns resembling a heart shape. The texture and tones create an organic, warm feel.",
    model: "Essence 2.0",
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
          className="w-full h-full object-cover"
          unoptimized
        />
        {isHovered && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex flex-col justify-end p-3 transition-opacity duration-300">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white font-medium bg-black/30 px-2 py-1 rounded">{image.author}</p>
              <div className="flex space-x-1">
                <Button variant="ghost" size="icon" className="w-7 h-7 text-white hover:bg-white/20 hover:text-white">
                  <Type className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-white hover:bg-white/20 hover:text-white">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-white hover:bg-white/20 hover:text-white">
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
  // This is a simplified grid. A true masonry layout would require more complex CSS or a library.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
      {images.map((image, index) => (
        <div
          key={image.id}
          className={`
            ${index === 0 ? "md:col-span-1 md:row-span-2" : ""}
            ${index === 1 ? "md:col-span-2 md:row-span-1" : ""}
            ${index === 2 ? "md:col-span-1 md:row-span-2" : ""}
            ${index === 3 ? "md:col-span-1 md:row-span-1" : ""}
            ${index === 4 ? "md:col-span-2 md:row-span-1" : ""}
            ${index === 5 ? "md:col-span-1 md:row-span-1" : ""}
          `}
        >
          <ImageGridItem image={image} />
        </div>
      ))}
    </div>
  )
}

export default ImageGrid
