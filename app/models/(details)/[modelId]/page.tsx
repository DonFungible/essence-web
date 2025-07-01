"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Cpu, Palette, ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"

import ModelClientContent from "./model-client-content"
import StyleReferenceGrid from "./style-reference-grid"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import PromptBar from "@/components/prompt-bar"
import { Button } from "@/components/ui/button"
import EditableDescription from "@/components/editable-description"
import { type ModelType } from "@/lib/models-data"
import { useToast } from "@/hooks/use-toast"

interface Props {
  params: {
    modelId: string
  }
}

export default function ModelPage({ params }: Props) {
  const { toast } = useToast()
  const [model, setModel] = useState<ModelType | null>(null)
  const [styleReferenceImages, setStyleReferenceImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modelId, setModelId] = useState<string>("")
  useEffect(() => {
    async function loadData() {
      try {
        const resolvedParams = await params
        setModelId(resolvedParams.modelId)

        // Fetch model data from API
        const modelResponse = await fetch(`/api/models/${resolvedParams.modelId}`)
        if (modelResponse.ok) {
          console.log("modelResponse", modelResponse)
          const { data: foundModel } = await modelResponse.json()
          setModel(foundModel)

          if (foundModel) {
            // Fetch style reference images from API
            const imagesResponse = await fetch(`/api/models/${resolvedParams.modelId}/style-images`)
            if (imagesResponse.ok) {
              const { images } = await imagesResponse.json()
              setStyleReferenceImages(images || [])
            } else {
              console.error(
                "Failed to fetch style images:",
                imagesResponse.status,
                imagesResponse.statusText
              )
              setStyleReferenceImages([])
            }
          }
        }
      } catch (error) {
        console.error("Error loading model data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [params])

  console.log({ model })

  // For now, assume all models are database models (can be edited)
  // This could be enhanced to check if the model is from the static list
  const isStaticModel = false

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="text-lg text-slate-600">Loading model...</div>
          </main>
        </div>
      </div>
    )
  }

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

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl pb-32">
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

              {/* IP Asset ID Section */}
              {model.ipId && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <Palette className="w-4 h-4 mr-2 text-slate-500" />
                    <span className="text-sm font-medium text-slate-500">IP Asset ID:</span>
                  </div>
                  <code className="text-sm font-mono text-slate-700">{model.ipId}</code>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`https://aeneid.explorer.story.foundation/ipa/${model.ipId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Story Explorer
                    </Link>
                  </Button>
                </div>
              )}

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
            <section className="mb-10 rounded-xl border p-6 bg-slate-50">
              <div className="flex items-center mb-4">
                <h2 className="text-2xl font-semibold text-slate-700">Training Images</h2>
                <span className="ml-2 text-sm text-slate-500">
                  ({styleReferenceImages.length} image{styleReferenceImages.length !== 1 ? "s" : ""}
                  )
                </span>
              </div>

              <StyleReferenceGrid images={styleReferenceImages} modelName={model.name} />
            </section>

            <ModelClientContent model={model} />
          </div>
        </main>
        <PromptBar />
      </div>
    </div>
  )
}
