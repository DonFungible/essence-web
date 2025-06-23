import Link from "next/link"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import { models as exampleModelsData, type ModelType } from "@/lib/models-data" // Renamed to avoid conflict
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Filter, SortAsc } from "lucide-react"
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
    imageUrl:
      model.exampleImages[0] ||
      `/placeholder.svg?width=300&height=400&query=${encodeURIComponent(model.name)}`,
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
          <div className="mx-auto">
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
                {/* Search and Filter Bar */}
                <div className="mb-6 space-y-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        placeholder="Search your models..."
                        className="pl-10 bg-slate-50 border-slate-200 focus:bg-white"
                      />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3">
                      <Select>
                        <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="training">Training</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select>
                        <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                          <SelectValue placeholder="Style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Styles</SelectItem>
                          <SelectItem value="photorealistic">Photorealistic</SelectItem>
                          <SelectItem value="artistic">Artistic</SelectItem>
                          <SelectItem value="anime">Anime</SelectItem>
                          <SelectItem value="abstract">Abstract</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select>
                        <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                          <SortAsc className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest First</SelectItem>
                          <SelectItem value="oldest">Oldest First</SelectItem>
                          <SelectItem value="name">Name A-Z</SelectItem>
                          <SelectItem value="popular">Most Popular</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {displayTrainedModels.map((props) => (
                    <ModelHoverCard key={props.href} {...props} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
