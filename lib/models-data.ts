export const models = [
  {
    id: "essence-2-5",
    name: "Essence 2.5",
    version: "2.5 (Stable)",
    description:
      "A versatile and robust model trained for high-fidelity photorealism and artistic styles. Excels at complex scenes, lighting, and textures.",
    trainingData: {
      size: "1.2M+ images",
      sources: ["Unsplash", "ArtStation", "Licensed Datasets"],
    },
    styles: ["Photorealism", "Cinematic", "Surrealism", "Ansel Adams", "Studio Ghibli"],
    metrics: [
      { name: "Coherence", value: 95 },
      { name: "Style Adherence", value: 92 },
      { name: "Prompt Following", value: 88 },
      { name: "Speed", value: 75 },
    ],
    exampleImages: ["/surreal-landscape-mirror.png", "/pastel-architecture-horse.png", "/vintage-white-car.png"],
  },
  {
    id: "essence-3-0-alpha",
    name: "Essence 3.0 Alpha",
    version: "3.0 (Alpha)",
    description:
      "The next generation of Essence. Features improved prompt understanding and faster generation times. May produce unexpected results.",
    trainingData: {
      size: "2.5M+ images & text pairs",
      sources: ["Proprietary V3 Dataset", "Common Crawl (filtered)"],
    },
    styles: ["Abstract", "Minimalist", "Sci-Fi", "Zaha Hadid", "Cyberpunk"],
    metrics: [
      { name: "Coherence", value: 91 },
      { name: "Style Adherence", value: 85 },
      { name: "Prompt Following", value: 94 },
      { name: "Speed", value: 90 },
    ],
    exampleImages: ["/futuristic-helmet.png", "/minimalist-brushed-metal.png", "/abstract-sci-fi-cityscape.png"],
  },
  {
    id: "anime-v4",
    name: "Anime V4",
    version: "4.1 (Production)",
    description:
      "Specialized model for generating high-quality anime and manga-style illustrations. Strong understanding of character design, dynamic poses, and vibrant color palettes.",
    trainingData: {
      size: "800K+ curated illustrations",
      sources: ["Danbooru (SFW)", "Pixiv (SFW)", "Licensed Artist Works"],
    },
    styles: ["Modern Anime", "90s Retro", "Manga (B&W)", "Chibi", "Makoto Shinkai"],
    metrics: [
      { name: "Coherence", value: 96 },
      { name: "Style Adherence", value: 98 },
      { name: "Prompt Following", value: 85 },
      { name: "Speed", value: 80 },
    ],
    exampleImages: ["/anime-fantasy-landscape.png", "/placeholder-rfmi4.png", "/chibi-anime-ramen.png"],
  },
]

export type ModelType = (typeof models)[0]

export const getModelById = (id: string): ModelType | undefined => {
  return models.find((m) => m.id === id)
}
