"use client"

import Link from "next/link"
import { useRecentGenerations, type GenerationRecord } from "@/hooks/use-image-generation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import SafeImage from "@/components/safe-image" // Assuming you have this component
import {
  AlertTriangle,
  ImageIcon,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  Trash2,
} from "lucide-react"
import { useDeleteGeneration } from "@/hooks/use-delete-model"
import { useState } from "react"

interface RecentGenerationsGridProps {
  modelId: string
  modelName: string
}

function GenerationDeleteButton({ generation }: { generation: GenerationRecord }) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const deleteGeneration = useDeleteGeneration()

  const handleDelete = async () => {
    try {
      await deleteGeneration.mutateAsync(generation.id)
      setDeleteDialogOpen(false)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  return (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-red-600 cursor-pointer">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Image
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image Generation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this generated image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteGeneration.isPending}
            >
              {deleteGeneration.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
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
      <h2 className="text-2xl font-semibold text-slate-700 mb-6">Recent Generations</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {generations.map((gen) => (
          <div key={gen.id} className="relative group">
            <Link href={`/creations/${gen.id}`} passHref>
              <Card className="overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300 group h-full flex flex-col">
                <div className="aspect-square bg-slate-100 flex items-center justify-center relative">
                  {gen.supabase_image_url ? (
                    <SafeImage
                      src={gen.supabase_image_url}
                      alt={`Generated image for prompt: ${gen.prompt}`}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover"
                      unoptimized // Assuming these might be external URLs or direct blob URLs
                    />
                  ) : (
                    <div className="text-slate-400 p-4 text-center">
                      {gen.error_message ? (
                        <div className="text-red-500">
                          <XCircle className="h-10 w-10 mx-auto mb-2" />
                          <p className="text-xs font-medium">
                            {gen.error_message.includes("NSFW")
                              ? "Generation failed due to potential NSFW"
                              : "Generation failed"}
                          </p>
                        </div>
                      ) : gen.status === "pending" || gen.status === "processing" ? (
                        <div className="text-blue-500">
                          <Loader2 className="h-10 w-10 mx-auto mb-2 animate-spin" />
                          <p className="text-xs">Processing...</p>
                        </div>
                      ) : (
                        <div>
                          <ImageIcon className="h-10 w-10 mx-auto mb-2" />
                          <p className="text-xs">No image</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <CardContent className="p-4 flex-grow flex flex-col justify-between">
                  <div className="flex justify-between">
                    <p
                      className="text-sm text-slate-700 font-medium truncate group-hover:whitespace-normal group-hover:overflow-visible"
                      title={gen.prompt}
                    >
                      {gen.prompt}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(gen.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <GenerationDeleteButton generation={gen} />
          </div>
        ))}
      </div>
    </div>
  )
}
