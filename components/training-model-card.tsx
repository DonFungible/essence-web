"use client"

import Image from "next/image"
import Link from "next/link"
import { Clock, Cpu, Loader2, MoreVertical, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { useDeleteModel } from "@/hooks/use-delete-model"
import { useState } from "react"

interface TrainingModelCardProps {
  name: string
  description: string
  imageUrl: string
  status: string
  trainingSteps?: number | string
  captioning?: string
  createdAt: string
  href: string
  modelId?: string // Add modelId for delete functionality
}

export default function TrainingModelCard({
  name,
  description,
  imageUrl,
  status,
  trainingSteps,
  captioning,
  createdAt,
  href,
  modelId,
}: TrainingModelCardProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const deleteModel = useDeleteModel()

  const handleDelete = async () => {
    if (!modelId) return

    try {
      await deleteModel.mutateAsync(modelId)
      setDeleteDialogOpen(false)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMinutes = Math.floor(diffMs / (1000 * 60))

      if (diffHours > 0) {
        return `${diffHours}h ago`
      } else if (diffMinutes > 0) {
        return `${diffMinutes}m ago`
      } else {
        return "Just now"
      }
    } catch {
      return "Recently"
    }
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
      case "queued":
      case "submitted":
        return { label: "Pending", variant: "outline" as const, icon: Clock }
      case "starting":
        return { label: "Starting", variant: "secondary" as const, icon: Clock }
      case "processing":
        return { label: "Training", variant: "default" as const, icon: Loader2 }
      default:
        return { label: status, variant: "outline" as const, icon: Cpu }
    }
  }

  const statusDisplay = getStatusDisplay(status)
  const StatusIcon = statusDisplay.icon

  return (
    <div className="relative group">
      <Link
        href={href}
        className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded-xl"
      >
        <div className="relative w-full aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden shadow-sm transition-all duration-300 ease-in-out group-hover:shadow-lg group-hover:border-slate-400">
          {/* Training overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 z-10" />

          {/* Background image (preview or placeholder) */}
          <div className="absolute inset-0 opacity-30">
            <Image
              src={imageUrl}
              alt={`Training preview for ${name}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </div>

          {/* Content */}
          <div className="absolute inset-0 z-20 p-5 flex flex-col justify-between text-slate-700">
            <div className="flex items-start justify-between">
              <Badge variant={statusDisplay.variant} className="flex items-center gap-1">
                <StatusIcon
                  className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`}
                />
                {statusDisplay.label}
              </Badge>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-800 line-clamp-1">{name}</h3>

              {description && <p className="text-xs text-slate-600 line-clamp-2">{description}</p>}

              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  {trainingSteps && (
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {trainingSteps} steps
                    </span>
                  )}
                  {captioning && <span className="truncate">{captioning}</span>}
                </div>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Delete Button - Only show if modelId is provided */}
      {modelId && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30">
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-white/80 hover:bg-white text-slate-700"
                  onClick={(e) => e.preventDefault()} // Prevent navigation when clicking dropdown
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-red-600 cursor-pointer">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Training
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Training Job</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the training for "{name}"? This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteModel.isPending}
                >
                  {deleteModel.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
