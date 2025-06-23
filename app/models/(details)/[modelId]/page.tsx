import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Cpu, Palette } from "lucide-react"

import ModelClientContent from "./model-client-content"
import { QueryProvider } from "@/components/query-provider"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import { Button } from "@/components/ui/button"
import { getModelById, type ModelType } from "@/lib/models-data"

interface Props {
  params: {
    modelId: string
  }
}

// --- fetch model (static list first, then DB) ---
async function findModelById(id: string): Promise<ModelType | null> {
  const staticModel = getModelById(id)
  if (staticModel) return staticModel

  try {
    const { getTrainedModelsFromDatabase } = await import("@/lib/server-models")
    const trained = await getTrainedModelsFromDatabase()
    return trained.find((m) => m.id === id) || null
  } catch (err) {
    console.error("Error loading DB models:", err)
    return null
  }
}

export default async function ModelPage({ params }: Props) {
  const model = await findModelById(params.modelId)

  if (!model) {
    return (
      <div className="flex h-screen bg-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <h1 className="text-2xl font-semibold text-slate-700 mb-4">Model not found</h1>
            <Button asChild>
              <Link href="/models">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Models
              </Link>
            </Button>
          </main>
        </div>
      </div>
    )
  }

  // Hardcoded style reference images - replace with model-specific images if available
  const styleReferenceImages = [
    { src: "/abstract-product.png", alt: "Abstract product style example" },
    { src: "/anime-fantasy-landscape.png", alt: "Anime fantasy landscape style example" },
    { src: "/vintage-white-car.png", alt: "Vintage white car style example" },
    { src: "/minimalist-animation.png", alt: "Minimalist animation style example" },
  ]

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="max-w-7xl mx-auto">
            <Button variant="outline" asChild className="mb-6 text-slate-600 hover:bg-slate-50">
              <Link href="/models">
                <ArrowLeft className="mr-2 h-4 w-4" /> All Models
              </Link>
            </Button>

            <header className="space-y-2 mb-8">
              <div className="flex items-center">
                <Cpu className="mr-3 h-8 w-8 text-slate-600" />
                <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
              </div>
              {model.description && <p className="text-slate-600 max-w-2xl">{model.description}</p>}
            </header>

            {/* Style Reference Section */}
            <section className="mb-10">
              <div className="flex items-center mb-4">
                <Palette className="mr-2 h-6 w-6 text-slate-500" />
                <h2 className="text-2xl font-semibold text-slate-700">Style Reference</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {styleReferenceImages.map((img, index) => (
                  <div
                    key={index}
                    className="aspect-square relative rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                  >
                    <Image
                      src={img.src || "/placeholder.svg"}
                      alt={img.alt}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 25vw, 200px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>

            <QueryProvider>
              <ModelClientContent model={model} />
            </QueryProvider>
          </div>
        </main>
      </div>
    </div>
  )
}
