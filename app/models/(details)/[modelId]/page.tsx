import SafeImage from "@/components/safe-image"
import Link from "next/link"
import { getModelById, type ModelType } from "@/lib/models-data"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Cpu, Database, Palette, BarChart2, ExternalLink } from "lucide-react"
import dynamic from "next/dynamic"
import { ImageGenerationForm } from "./image-generation-form"

interface ModelDetailPageProps {
  params: {
    modelId: string
  }
}

async function findModelById(modelId: string): Promise<ModelType | null> {
  // First try static models
  const staticModel = getModelById(modelId)
  if (staticModel) {
    return staticModel
  }

  // Then try database models - only import server functions when needed
  try {
    const { getTrainedModelsFromDatabase } = await import("@/lib/server-models")
    const trainedModels = await getTrainedModelsFromDatabase()
    return trainedModels.find(model => model.id === modelId) || null
  } catch (error) {
    console.error('Error loading database models:', error)
    return null
  }
}

export default async function ModelDetailPage({ params }: ModelDetailPageProps) {
  const { modelId } = await params
  const model = await findModelById(modelId)

  if (!model) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-100">
          <TopBar />
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <h1 className="text-2xl font-semibold text-slate-700 mb-4">Model not found</h1>
            <Button asChild>
              <Link href="/models">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Models
              </Link>
            </Button>
          </div>
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
          <div className="max-w-7xl mx-auto">
            <Button variant="outline" asChild className="mb-6 text-slate-600 hover:bg-slate-50">
              <Link href="/models">
                <ArrowLeft className="mr-2 h-4 w-4" /> All Models
              </Link>
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Model Info */}
              <div className="space-y-6">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center text-3xl">
                      <Cpu className="mr-3 h-8 w-8 text-slate-500" />
                      {model.name}
                    </CardTitle>
                    <Badge variant="secondary" className="w-fit">
                      {model.version}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600">{model.description}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Database className="mr-2 h-5 w-5 text-slate-500" />
                      Training Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-700">
                      Trained on <span className="font-semibold">{model.trainingData.size}</span> from sources like{" "}
                      {model.trainingData.sources.join(", ")}.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Palette className="mr-2 h-5 w-5 text-slate-500" />
                      Key Styles & Artists
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {model.styles.map((style) => (
                      <Badge key={style} variant="outline">
                        {style}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <BarChart2 className="mr-2 h-5 w-5 text-slate-500" />
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {model.metrics.map((metric) => (
                      <div key={metric.name}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-slate-600">{metric.name}</span>
                          <span className="text-sm font-bold text-slate-700">{metric.value}%</span>
                        </div>
                        <Progress value={metric.value} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Example Images & Model Info */}
              <div className="space-y-6">
                {/* Model Output Info for Database Models */}
                {/* Check if it's a database model (long alphanumeric ID like Replicate job ID) */}
                {model.id.length > 20 && (
                  <Card className="shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <ExternalLink className="mr-2 h-5 w-5 text-blue-500" />
                        Replicate Model Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600 mb-3">This is a custom trained model available on Replicate.</p>
                      <Button variant="outline" asChild className="w-full">
                        <Link href={`https://replicate.com/p/${model.id}`} target="_blank">
                          View on Replicate <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Image Generation - Only for Database Models */}
                {model.id.length > 20 && (
                  <ImageGenerationForm 
                    modelId={model.id} 
                    triggerWord={(model as any).trigger_word}
                  />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
