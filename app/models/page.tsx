import Link from "next/link"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import { models as exampleModelsData, type ModelType } from "@/lib/models-data" // Renamed to avoid conflict
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import ModelHoverCard from "@/components/model-hover-card" // Import the new card

export default async function ModelsPage() {
  let trainedModels: ModelType[] = []
  try {
    const { getTrainedModelsFromDatabase } = await import("@/lib/server-models")
    trainedModels = await getTrainedModelsFromDatabase()
  } catch (error) {
    console.error("Error loading trained models:", error)
    trainedModels = []
  }

  // Prepare data for ModelHoverCard
  const mapModelToCardProps = (model: ModelType, isCustom: boolean) => ({
    name: model.name,
    description: model.description, // Still passed, but not used by the card
    imageUrl: model.exampleImages[0] || `/placeholder.svg?width=300&height=400&query=${encodeURIComponent(model.name)}`,
    followers: Math.floor(Math.random() * (isCustom ? 1000 : 500)) + 50,
    posts: Math.floor(Math.random() * (isCustom ? 200 : 100)) + 10,
    isVerified: isCustom,
    href: `/models/${model.id}`,
  })

  const displayTrainedModels = trainedModels.map((model) => mapModelToCardProps(model, true))
  const displayExampleModels = exampleModelsData.map((model) => mapModelToCardProps(model, false))

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">Style Models</h1>
              </div>
              <Button asChild>
                <Link href="/train">
                  <Plus className="mr-2 h-4 w-4" />
                  Train New Model
                </Link>
              </Button>
            </div>

            {displayTrainedModels.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Your Trained Models</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {displayTrainedModels.map((props) => (
                    <ModelHoverCard key={props.href} {...props} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6">
                {displayTrainedModels.length > 0 ? "Example Models" : "Explore Models"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {displayExampleModels.map((props) => (
                  <ModelHoverCard key={props.href} {...props} />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
