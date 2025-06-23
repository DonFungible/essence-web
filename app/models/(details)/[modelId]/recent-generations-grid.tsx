"use client"

import Link from "next/link"
import { useRecentGenerations, type GenerationRecord } from "@/hooks/use-image-generation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import SafeImage from "@/components/safe-image" // Assuming you have this component
import { AlertTriangle, ImageIcon, Loader2, CheckCircle, XCircle, Clock } from "lucide-react"

interface RecentGenerationsGridProps {
  modelId: string
  modelName: string
}

const getStatusBadgeVariant = (status: GenerationRecord["status"]) => {
  switch (status) {
    case "succeeded":
      return "success"
    case "failed":
      return "destructive"
    case "processing":
      return "secondary"
    case "pending":
      return "outline"
    default:
      return "default"
  }
}

const getStatusIcon = (status: GenerationRecord["status"]) => {
  switch (status) {
    case "succeeded":
      return <CheckCircle className="w-3 h-3" />
    case "failed":
      return <XCircle className="w-3 h-3" />
    case "processing":
      return <Loader2 className="w-3 h-3 animate-spin" />
    case "pending":
      return <Clock className="w-3 h-3" />
    default:
      return <Clock className="w-3 h-3" />
  }
}

export default function RecentGenerationsGrid({ modelId, modelName }: RecentGenerationsGridProps) {
  const { data: generations, isLoading, isError, error } = useRecentGenerations(modelId)

  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-semibold text-slate-700 mb-4">
          Recent Generations for {modelName}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="w-full aspect-square" />
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold text-red-600">Error loading generations</h3>
        <p className="text-slate-500">
          {(error as Error)?.message || "Could not fetch recent image generations."}
        </p>
      </div>
    )
  }

  if (!generations || generations.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-lg">
        <ImageIcon className="mx-auto h-12 w-12 text-slate-400 mb-4" />
        <h3 className="text-xl font-semibold text-slate-700">No generations yet for {modelName}</h3>
        <p className="text-slate-500">Be the first to generate an image with this model!</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-700 mb-6">
        Recent Generations by {modelName}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {generations.map((gen) => (
          <Link key={gen.id} href={`/image/${gen.id}`} passHref>
            <Card className="overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300 group h-full flex flex-col">
              <div className="aspect-square bg-slate-100 flex items-center justify-center relative">
                {gen.supabase_image_url || gen.image_url ? (
                  <SafeImage
                    src={gen.supabase_image_url || gen.image_url!}
                    alt={`Generated image for prompt: ${gen.prompt}`}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                    unoptimized // Assuming these might be external URLs or direct blob URLs
                  />
                ) : (
                  <div className="text-slate-400 p-4 text-center">
                    {gen.status === "pending" || gen.status === "processing" ? (
                      <Loader2 className="h-10 w-10 mx-auto mb-2 animate-spin text-blue-500" />
                    ) : (
                      <ImageIcon className="h-10 w-10 mx-auto mb-2" />
                    )}
                    {gen.status === "pending" || gen.status === "processing"
                      ? "Processing..."
                      : "No image"}
                  </div>
                )}
              </div>
              <CardContent className="p-4 flex-grow flex flex-col justify-between">
                <div>
                  <p
                    className="text-sm text-slate-700 font-medium truncate group-hover:whitespace-normal group-hover:overflow-visible"
                    title={gen.prompt}
                  >
                    {gen.prompt}
                  </p>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {new Date(gen.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
