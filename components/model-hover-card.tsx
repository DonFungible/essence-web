"use client"

import Image from "next/image"
import Link from "next/link"
import { MessageSquare, PictureInPicture, Trash2, MoreVertical } from "lucide-react"
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

interface ModelHoverCardProps {
  name: string
  // description: string; // Description is now part of ModelType, not directly used here
  imageUrl: string // This will now be the previewImageUrl or fallback
  followers: number | string
  posts: number | string // Represents 'generations' or similar concept
  isVerified?: boolean
  href: string
  modelId?: string // Add modelId for delete functionality
}

export default function ModelHoverCard({
  name,
  imageUrl, // This prop will receive the resolved image URL (preview or example)
  followers,
  posts,
  isVerified = false,
  href,
  modelId,
}: ModelHoverCardProps) {
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

  return (
    <div className="relative group">
      <Link
        href={href}
        className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded-xl"
      >
        <div className="relative w-full aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden shadow-lg transition-shadow duration-300 ease-in-out group-hover:shadow-2xl">
          <div className="absolute inset-0">
            <Image
              src={
                imageUrl || // imageUrl is now pre-resolved to preview or example
                `/placeholder.svg?width=300&height=400&query=model+image+${encodeURIComponent(
                  name
                )}`
              }
              alt={`Image for ${name}`}
              fill
              className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/50 to-transparent pointer-events-none" />

          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <div className="flex items-center mb-2">
              <h3 className="text-xl font-medium mr-1.5 text-white">{name}</h3>
              {/* isVerified logic can remain if you have a way to determine it */}
            </div>
            <div className="flex items-center text-xs text-slate-300">
              <div className="flex items-center mr-4">
                {/* Using PictureInPicture as a generic icon for "items" or "styles" */}
                <PictureInPicture className="w-3.5 h-3.5 mr-1" />
                <span>{followers}</span> {/* This could represent styles or a similar metric */}
              </div>
              <div className="flex items-center">
                <MessageSquare className="w-3.5 h-3.5 mr-1" />
                <span>{posts}</span> {/* This could represent generations */}
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Delete Button - Only show if modelId is provided */}
      {modelId && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
                  onClick={(e) => e.preventDefault()} // Prevent navigation when clicking dropdown
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-red-600 cursor-pointer">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Model
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Model</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{name}"? This action cannot be undone. All
                  associated image generations will also be hidden.
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
