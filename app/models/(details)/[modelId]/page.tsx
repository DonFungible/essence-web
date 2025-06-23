import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Cpu, Palette } from "lucide-react"

import ModelClientContent from "./model-client-content"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import { Button } from "@/components/ui/button"
import EditableDescription from "@/components/editable-description"
import { getModelById, type ModelType } from "@/lib/models-data"
import { getStyleReferenceImages } from "@/lib/style-reference-images"

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
  const { modelId } = await params
  const model = await findModelById(modelId)

  // Determine if this is a static model (can't be edited) or database model (can be edited)
  const isStaticModel = !!getModelById(modelId)

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

  // Fetch style reference images from Supabase storage bucket
  const styleReferenceImages = await getStyleReferenceImages(model.name)

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="max-w-7xl mx-auto">
            <header className="space-y-4 mb-8 relative">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  asChild
                  className="text-slate-600 my-auto absolute -translate-x-full left-0"
                >
                  <Link href="/models">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>

                <Cpu className="mr-3 h-8 w-8 text-slate-600" />
                <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
              </div>

              {/* Editable Description */}
              <div className="max-w-2xl">
                <EditableDescription
                  modelId={modelId}
                  description={model.description || ""}
                  placeholder="Add a description for this model..."
                  isStaticModel={isStaticModel}
                />
              </div>
            </header>

            {/* Style Reference Section */}
            <section className="mb-10">
              <div className="flex items-center mb-4">
                <h2 className="text-2xl font-semibold text-slate-700">Style Reference</h2>
                <span className="ml-2 text-sm text-slate-500">
                  ({styleReferenceImages.length} image{styleReferenceImages.length !== 1 ? "s" : ""}
                  )
                </span>
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

              {/* Show message when using default images */}
              {styleReferenceImages.length === 4 && styleReferenceImages[0].src.startsWith("/") && (
                <p className="text-xs text-slate-400 mt-2 italic">
                  No custom style images found. Upload images to assets/{model.name} bucket to show
                  model-specific examples.
                </p>
              )}
            </section>

            <ModelClientContent model={model} />
          </div>
        </main>
      </div>
    </div>
  )
}
