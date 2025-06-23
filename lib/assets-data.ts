export interface Asset {
  id: string
  name: string
  src: string
  alt: string
  tags?: string[]
  category?: string // Added category for potential filtering
}

export const mockAssets: Asset[] = [
  {
    id: "asset_001",
    name: "Cybernetic Bloom",
    src: "/cybernetic-flower.png", // Assuming this exists in public
    alt: "A metallic flower with glowing circuits",
    tags: ["sci-fi", "nature", "cybernetic"],
    category: "Illustrations",
  },
  {
    id: "asset_002",
    name: "Forest Spirit",
    src: "/placeholder-gipm3.png", // Assuming this exists in public
    alt: "A glowing creature in an enchanted forest",
    tags: ["fantasy", "nature", "spirit"],
    category: "Illustrations",
  },
  {
    id: "asset_003",
    name: "Retro Gadget",
    src: "/vintage-handheld-device.png", // Assuming this exists in public
    alt: "A colorful retro handheld gaming device",
    tags: ["retro", "tech", "gaming"],
    category: "Photos",
  },
  {
    id: "asset_004",
    name: "Abstract Waves",
    src: "/abstract-blue-waves.png", // Assuming this exists in public
    alt: "An abstract pattern of flowing blue waves",
    tags: ["abstract", "pattern", "blue"],
    category: "Vectors",
  },
  {
    id: "asset_005",
    name: "Steampunk Gear",
    src: "/placeholder-cx8qr.png", // Assuming this exists in public
    alt: "A detailed steampunk-style gear mechanism",
    tags: ["steampunk", "mechanical", "vintage"],
    category: "Photos",
  },
  {
    id: "asset_006",
    name: "Cosmic Nebula",
    src: "/placeholder-q9ew9.png", // Assuming this exists in public
    alt: "A colorful and vibrant cosmic nebula",
    tags: ["space", "celestial", "colorful"],
    category: "Photos",
  },
  {
    id: "asset_007",
    name: "Urban Graffiti",
    src: "/placeholder-6i601.png",
    alt: "Stylized graffiti art on a brick wall",
    tags: ["urban", "art", "street"],
    category: "Illustrations",
  },
  {
    id: "asset_008",
    name: "Minimalist Sculpture",
    src: "/placeholder-a1r30.png",
    alt: "A white minimalist sculpture on a plain background",
    tags: ["minimalist", "art", "sculpture"],
    category: "Vectors",
  },
  {
    id: "asset_009",
    name: "Vintage Car",
    src: "/vintage-white-car.png", // Assuming this exists in public
    alt: "A classic white vintage car",
    tags: ["vintage", "car", "classic"],
    category: "Photos",
  },
  {
    id: "asset_010",
    name: "Anime Landscape",
    src: "/anime-fantasy-landscape.png", // Assuming this exists in public
    alt: "A vibrant anime-style fantasy landscape",
    tags: ["anime", "fantasy", "landscape"],
    category: "Illustrations",
  },
]

export async function getAssets(): Promise<Asset[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 50))
  return mockAssets
}
