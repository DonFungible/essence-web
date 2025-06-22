"use client"

import type React from "react"

import { useState } from "react"
import SafeImage from "@/components/safe-image"
import Link from "next/link"
import { getModelById } from "@/lib/models-data"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Cpu, Database, Palette, BarChart2, Sparkles, Send } from "lucide-react"

interface ModelDetailPageProps {
  params: {
    modelId: string
  }
}

export default function ModelDetailPage({ params }: ModelDetailPageProps) {
  const model = getModelById(params.modelId)
  const [generatedImages, setGeneratedImages] = useState<string[]>(model?.exampleImages || [])
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const prompt = formData.get("prompt") as string
    if (!prompt) return

    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      const newImage = `/placeholder.svg?height=512&width=512&query=${encodeURIComponent(prompt)}`
      setGeneratedImages((prev) => [newImage, ...prev])
      setIsLoading(false)
    }, 1500)
  }

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

              {/* Right Column: Generation */}
              <div className="space-y-6">
                <Card className="shadow-xl sticky top-6">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Sparkles className="mr-2 h-5 w-5 text-green-500" />
                      Generate with {model.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleGenerate} className="flex items-center gap-2">
                      <Input
                        name="prompt"
                        placeholder="e.g., A cat in a spacesuit"
                        className="flex-1"
                        disabled={isLoading}
                      />
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          "Generating..."
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" /> Generate
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {generatedImages.map((src, index) => (
                    <div key={index} className="rounded-lg overflow-hidden aspect-square relative group">
                      <SafeImage
                        src={src || "/placeholder.svg"}
                        alt={`Generated image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white text-xs p-2 text-center">A generated image</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
