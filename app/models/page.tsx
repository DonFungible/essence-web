import Link from "next/link"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import type { ModelType } from "@/lib/models-data" // Removed exampleModelsData
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, Filter, SortAsc, ImageOff } from "lucide-react"
import ModelHoverCard from "@/components/model-hover-card"
import { getTrainedModelsFromDatabase, getTrainingModelsFromDatabase } from "@/lib/server-models" // Direct import
import { getFirstStyleReferenceImage } from "@/lib/style-reference-images"
import TrainingModelCard from "@/components/training-model-card"

export default async function ModelsPage() {
  let trainedModels: ModelType[] = []
  let trainingModels: ModelType[] = []

  try {
    // Fetch trained, training, and pending models in parallel
    const [trained, training] = await Promise.all([
      getTrainedModelsFromDatabase(),
      getTrainingModelsFromDatabase(),
    ])
    trainedModels = trained
    trainingModels = training
  } catch (error) {
    console.error("Error loading models:", error)
    // Set error state to show in UI
    trainedModels = []
    trainingModels = []
  }

  // Function to get image URL with style reference fallback
  const getModelImageUrl = async (model: ModelType): Promise<string> => {
    // First try preview image
    if (model.previewImageUrl) {
      return model.previewImageUrl
    }

    // Then try example images
    if (model.exampleImages && model.exampleImages.length > 0) {
      return model.exampleImages[0]
    }

    // Try to get first style reference image from storage
    try {
      const styleImage = await getFirstStyleReferenceImage(model.name)
      if (styleImage) {
        return styleImage
      }
    } catch (error) {
      console.error(`Error getting style reference image for ${model.name}:`, error)
    }

    // Fall back to placeholder
    return `/placeholder.svg?width=300&height=400&query=${encodeURIComponent(model.name)}`
  }

  // Map models to card props with async image resolution
  const displayModels = await Promise.all(
    trainedModels.map(async (model) => ({
      name: model.name,
      imageUrl: await getModelImageUrl(model),
      followers: model.styles.length || 0, // Example: number of styles/tags
      posts: model.metrics.find((m) => m.name === "Generations")?.value || 0, // Example: number of generations if tracked
      isVerified: model.status === "succeeded", // Example: "succeeded" models are "verified"
      href: `/models/${model.id}`, // model.id is now replicate_job_id or dbId
      description: model.description || "",
      modelId: model.dbId || model.id, // Pass the database ID for delete functionality
    }))
  )

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="mx-auto">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">Your Style Models</h1>
                <p className="text-slate-500 mt-1">
                  Browse and manage your custom trained style models.
                </p>
              </div>
              <Button asChild>
                <Link href="/train">
                  <Plus className="mr-2 h-4 w-4" />
                  Train New Model
                </Link>
              </Button>
            </div>

            {/* Search and Filter Bar */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search your models by name or trigger word..."
                    className="pl-10 bg-slate-50 border-slate-200 focus:bg-white"
                    // Add onChange handler for actual search functionality
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Select>
                    <SelectTrigger className="w-full sm:w-[140px] bg-slate-50 border-slate-200">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="succeeded">Completed</SelectItem>
                      <SelectItem value="processing">Training</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      {/* Add other relevant statuses */}
                    </SelectContent>
                  </Select>
                  {/* Add more filters if needed, e.g., by base model, date range */}
                  <Select>
                    <SelectTrigger className="w-full sm:w-[140px] bg-slate-50 border-slate-200">
                      <SortAsc className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="name_asc">Name A-Z</SelectItem>
                      <SelectItem value="name_desc">Name Z-A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {/* Completed Models Section */}

            {displayModels.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {displayModels.map((props) => (
                  <ModelHoverCard key={props.href} {...props} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-slate-300 rounded-lg">
                <ImageOff className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-2 text-lg font-medium text-slate-700">No Models Yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                  You haven&apos;t trained any models. Get started by training your first one!
                </p>
                <Button asChild className="mt-6">
                  <Link href="/train">
                    <Plus className="mr-2 h-4 w-4" />
                    Train New Model
                  </Link>
                </Button>
              </div>
            )}

            {/* Training Models Section */}
            {trainingModels.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center mb-6">
                  <h2 className="text-2xl font-semibold text-slate-800">Currently Training</h2>
                  <span className="ml-2 text-sm text-slate-500">
                    ({trainingModels.length} model{trainingModels.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {await Promise.all(
                    trainingModels.map(async (model) => (
                      <TrainingModelCard
                        key={model.id}
                        name={model.name}
                        description={model.description}
                        imageUrl={await getModelImageUrl(model)}
                        status={model.status || "unknown"}
                        trainingSteps={
                          model.metrics.find((m) => m.name === "Training Steps")?.value
                        }
                        captioning={model.styles.find((s) => s.includes("captioning")) || undefined}
                        createdAt={model.createdAt || new Date().toISOString()}
                        href={`/models/${model.id}`}
                        modelId={model.dbId || model.id}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
