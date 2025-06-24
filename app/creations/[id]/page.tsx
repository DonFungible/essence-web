"use client"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, User, Info, Cpu, Tag, Clock, Zap, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Sidebar from "@/components/sidebar" // Re-using sidebar for consistent layout
import TopBar from "@/components/top-bar" // Re-using topbar
import { useGalleryImage } from "@/hooks/use-gallery-images"
import { useGeneration } from "@/hooks/use-image-generation"
import { useModel } from "@/hooks/use-model-description"

interface ImageDetailPageProps {
  params: {
    id: string
  }
}

export default function ImageDetailPage({ params }: ImageDetailPageProps) {
  // Determine if this is a gallery image (numeric ID) or generated image (UUID)
  const isGalleryImage = !isNaN(Number(params.id))
  const galleryImageId = isGalleryImage ? Number.parseInt(params.id, 10) : null
  const generationId = !isGalleryImage ? params.id : null

  // Fetch appropriate data based on image type
  const {
    data: galleryImage,
    isLoading: galleryLoading,
    error: galleryError,
  } = useGalleryImage(galleryImageId!)
  const {
    data: generatedImage,
    isLoading: generationLoading,
    error: generationError,
  } = useGeneration(generationId)

  // Fetch model details for generated images to get model name
  const { data: modelData, isLoading: modelLoading } = useModel(generatedImage?.model_id || "")

  const isLoading = isGalleryImage ? galleryLoading : generationLoading || modelLoading
  const error = isGalleryImage ? galleryError : generationError
  const imageData = isGalleryImage ? galleryImage : generatedImage

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="text-slate-500">Loading image...</div>
          </main>
        </div>
      </div>
    )
  }

  if (error || !imageData) {
    return (
      <div className="flex h-screen bg-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <h1 className="text-2xl font-semibold text-slate-700 mb-4">
              {error ? "Error loading image" : "Image not found"}
            </h1>
            <p className="text-slate-500 mb-6">
              {error
                ? (error as Error).message
                : "Sorry, we couldn't find the image you're looking for."}
            </p>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Go back to Explore
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="max-w-6xl mx-auto">
            <Button variant="outline" asChild className="mb-6 text-slate-600 hover:bg-slate-50">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Explore
              </Link>
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Image Display Column */}
              <div className="lg:col-span-2 rounded-xl overflow-hidden shadow-xl">
                {!isGalleryImage &&
                generatedImage &&
                (generatedImage.status === "pending" || generatedImage.status === "processing") &&
                !generatedImage.supabase_image_url &&
                !generatedImage.image_url ? (
                  // Show processing state for generated images without image URL
                  <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-purple-50 flex flex-col items-center justify-center">
                    <Clock className="w-16 h-16 text-blue-500 animate-pulse mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                      {generatedImage.status === "pending"
                        ? "Queued for generation..."
                        : "Generating image..."}
                    </h3>
                    <p className="text-slate-500 text-center px-4">
                      This usually takes 30-60 seconds. The page will update automatically when
                      complete.
                    </p>
                  </div>
                ) : (
                  <Image
                    src={
                      isGalleryImage
                        ? galleryImage?.src || "/placeholder.svg"
                        : generatedImage?.supabase_image_url || "/placeholder.svg"
                    }
                    alt={
                      isGalleryImage
                        ? galleryImage?.alt || "Gallery image"
                        : `Generated image: ${generatedImage?.prompt || "AI generated"}`
                    }
                    width={1200} // Larger width for detail view
                    height={
                      isGalleryImage
                        ? galleryImage?.aspect === "portrait"
                          ? 1800
                          : 800
                        : generatedImage?.aspect_ratio === "9:16"
                        ? 1800
                        : 800
                    }
                    className="w-full h-auto object-contain bg-slate-50"
                  />
                )}
              </div>

              {/* Details Column */}
              <div className="lg:col-span-1 space-y-6">
                <div className="p-6 bg-slate-50 rounded-xl shadow-lg">
                  <h1 className="text-3xl font-bold text-slate-800 mb-3">
                    {isGalleryImage
                      ? galleryImage?.title
                      : generatedImage?.prompt?.slice(0, 50) + "..." || "Generated Image"}
                  </h1>

                  <div className="flex items-center text-sm text-slate-600 mb-4">
                    <User className="w-4 h-4 mr-2 text-slate-500" />
                    <span>
                      {isGalleryImage ? `Created by: ${galleryImage?.author}` : "AI Generated"}
                    </span>
                  </div>

                  {/* Status Badge for Generated Images */}
                  {!isGalleryImage && generatedImage && (
                    <div className="mb-4">
                      <Badge
                        variant={
                          generatedImage.status === "succeeded"
                            ? "default"
                            : generatedImage.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        className="flex items-center gap-1 w-fit"
                      >
                        {generatedImage.status === "processing" && (
                          <Clock className="w-3 h-3 animate-pulse" />
                        )}
                        {generatedImage.status === "succeeded" && <Zap className="w-3 h-3" />}
                        {generatedImage.status.charAt(0).toUpperCase() +
                          generatedImage.status.slice(1)}
                      </Badge>
                    </div>
                  )}

                  <div className="space-y-1 mb-5">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                      <Info className="w-4 h-4 mr-2" />
                      {isGalleryImage ? "Description" : "Prompt"}
                    </h2>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      {isGalleryImage ? galleryImage?.description : generatedImage?.prompt}
                    </p>
                    {!isGalleryImage &&
                      generatedImage?.full_prompt &&
                      generatedImage.full_prompt !== generatedImage.prompt && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                            View full prompt
                          </summary>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {generatedImage.full_prompt}
                          </p>
                        </details>
                      )}
                  </div>

                  <div className="space-y-1 mb-5">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                      <Cpu className="w-4 h-4 mr-2" />
                      Style Model
                    </h2>
                    <Badge variant="secondary" className="text-sm">
                      {isGalleryImage
                        ? galleryImage?.model
                        : modelData?.trigger_word || modelData?.name || "Custom Model"}
                    </Badge>
                  </div>

                  {/* Model ID for Generated Images */}
                  {!isGalleryImage && generatedImage && (
                    <div className="space-y-1 mb-5">
                      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                        <Tag className="w-4 h-4 mr-2" />
                        Model ID
                      </h2>
                      <p className="text-slate-700 text-xs font-mono bg-slate-100 p-2 rounded border">
                        {generatedImage.model_id}
                      </p>
                    </div>
                  )}

                  {/* Generation Parameters for Generated Images */}
                  {!isGalleryImage && generatedImage && (
                    <div className="space-y-3 mb-5">
                      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                        <Palette className="w-4 h-4 mr-2" />
                        Generation Settings
                      </h2>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Aspect Ratio:</span>
                          <span className="text-slate-700">{generatedImage.aspect_ratio}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Format:</span>
                          <span className="text-slate-700">{generatedImage.output_format}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Safety:</span>
                          <span className="text-slate-700">{generatedImage.safety_tolerance}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Strength:</span>
                          <span className="text-slate-700">{generatedImage.finetune_strength}</span>
                        </div>
                        {generatedImage.seed && (
                          <div className="flex justify-between col-span-2">
                            <span className="text-slate-500">Seed:</span>
                            <span className="text-slate-700">{generatedImage.seed}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags - Static for now, could be made dynamic */}
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                      <Tag className="w-4 h-4 mr-2" />
                      Tags
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {isGalleryImage ? (
                        <>
                          <Badge variant="outline">Gallery</Badge>
                          <Badge variant="outline">Curated</Badge>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline">AI Generated</Badge>
                          <Badge variant="outline">{generatedImage?.aspect_ratio}</Badge>
                          {generatedImage?.raw && <Badge variant="outline">Raw</Badge>}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadata Section */}
                <div className="p-6 bg-slate-50 rounded-xl shadow-lg space-y-3">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    Details
                  </h2>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Created:</span>
                      <span className="text-slate-700">
                        {new Date(
                          isGalleryImage
                            ? galleryImage?.created_at || new Date().toISOString()
                            : generatedImage?.created_at || new Date().toISOString()
                        ).toLocaleDateString()}
                      </span>
                    </div>

                    {!isGalleryImage && generatedImage?.generation_time_seconds && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Generation Time:</span>
                        <span className="text-slate-700">
                          {generatedImage.generation_time_seconds}s
                        </span>
                      </div>
                    )}

                    {!isGalleryImage && generatedImage?.replicate_prediction_id && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Prediction ID:</span>
                        <span className="text-slate-700 font-mono text-xs">
                          {generatedImage.replicate_prediction_id.slice(0, 8)}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-xl shadow-lg space-y-3">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </h2>
                  <Button
                    className="w-full"
                    disabled={!isGalleryImage && generatedImage?.status !== "succeeded"}
                  >
                    Download Image
                  </Button>
                  <Button variant="outline" className="w-full">
                    Add to Collection
                  </Button>
                  {!isGalleryImage && (
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/models/${generatedImage?.model_id}`}>View Model</Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-300 hover:border-red-400"
                  >
                    Report Image
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
