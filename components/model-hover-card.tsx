"use client"

import Image from "next/image"
import Link from "next/link"
import {
  MessageSquare,
  PictureInPicture,
  Trash2,
  MoreVertical,
  Upload,
  Link as LinkIcon,
  X,
  ExternalLink,
} from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDeleteModel } from "@/hooks/use-delete-model"
import { useUpdateModelPreviewImage } from "@/hooks/use-model-description"
import { useFileUpload } from "@/hooks/use-upload"
import { useToast } from "@/hooks/use-toast"
import { useState, useCallback } from "react"

interface ModelHoverCardProps {
  name: string
  // description: string; // Description is now part of ModelType, not directly used here
  imageUrl: string // This will now be the previewImageUrl or fallback
  followers: number | string
  posts: number | string // Represents 'generations' or similar concept
  isVerified?: boolean
  href: string
  modelId?: string // Add modelId for delete functionality
  ipId?: string // Story Protocol IP Asset ID
}

export default function ModelHoverCard({
  name,
  imageUrl, // This prop will receive the resolved image URL (preview or example)
  followers,
  posts,
  isVerified = false,
  href,
  modelId,
  ipId,
}: ModelHoverCardProps) {
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isPreviewImageDialogOpen, setPreviewImageDialogOpen] = useState(false)
  const [inputImageUrl, setInputImageUrl] = useState("")
  const [dragActive, setDragActive] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const deleteModel = useDeleteModel()
  const updatePreviewImage = useUpdateModelPreviewImage(modelId || "")
  const { uploadFile, uploading, progress } = useFileUpload()
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!modelId) return

    try {
      await deleteModel.mutateAsync(modelId)
      setDeleteDialogOpen(false)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [])

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!validImageTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG, PNG, WEBP, or GIF image.",
        variant: "destructive",
      })
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Image must be less than 5MB.",
        variant: "destructive",
      })
      return
    }

    try {
      // Create preview
      const fileUrl = URL.createObjectURL(file)
      setPreviewImage(fileUrl)

      // Use the existing upload hook
      const result = await uploadFile(file)

      // Update the model's preview image
      await updatePreviewImage.mutateAsync({
        preview_image_url: result.publicUrl,
      })

      toast({
        title: "Preview Image Updated",
        description: "The model preview image has been updated successfully.",
      })

      setPreviewImageDialogOpen(false)
      setPreviewImage(null)
      setInputImageUrl("")
    } catch (error) {
      console.error("Error uploading image:", error)
      toast({
        title: "Upload Failed",
        description: "Failed to update the preview image. Please try again.",
        variant: "destructive",
      })
      setPreviewImage(null)
    }
  }

  const handleUrlSubmit = async () => {
    if (!inputImageUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter an image URL.",
        variant: "destructive",
      })
      return
    }

    try {
      // Validate URL format
      new URL(inputImageUrl)

      await updatePreviewImage.mutateAsync({
        preview_image_url: inputImageUrl.trim(),
      })

      toast({
        title: "Preview Image Updated",
        description: "The model preview image has been updated successfully.",
      })

      setPreviewImageDialogOpen(false)
      setInputImageUrl("")
    } catch (error) {
      console.error("Error updating preview image:", error)
      toast({
        title: "Update Failed",
        description: "Failed to update the preview image. Please check the URL and try again.",
        variant: "destructive",
      })
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
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

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 hover:via-black/0 hover:from-black/0 to-transparent pointer-events-none" />

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

      {/* Action Buttons - Only show if modelId is provided */}
      {modelId && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-black/50 hover:bg-black/50 text-white"
                  onClick={(e) => e.preventDefault()} // Prevent navigation when clicking dropdown
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    setPreviewImageDialogOpen(true)
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Update Preview Image
                </DropdownMenuItem>
                {ipId && (
                  <DropdownMenuItem className="cursor-pointer" asChild>
                    <Link
                      href={`https://aeneid.explorer.story.foundation/ipa/${ipId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View on Story
                    </Link>
                  </DropdownMenuItem>
                )}
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

      {/* Preview Image Update Dialog */}
      <Dialog
        open={isPreviewImageDialogOpen}
        onOpenChange={(open) => {
          setPreviewImageDialogOpen(open)
          if (!open) {
            // Clean up when dialog closes
            setInputImageUrl("")
            if (previewImage && previewImage.startsWith("blob:")) {
              URL.revokeObjectURL(previewImage)
            }
            setPreviewImage(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Preview Image</DialogTitle>
            <DialogDescription>
              Upload a new image or provide a URL to update the model's preview image.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload Image</TabsTrigger>
              <TabsTrigger value="url">Image URL</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div
                className={`relative w-full h-40 border-2 border-dashed rounded-lg transition-colors ${
                  dragActive
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />

                {previewImage ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={previewImage}
                      alt="Preview"
                      fill
                      className="object-contain rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => {
                        setPreviewImage(null)
                        if (previewImage.startsWith("blob:")) {
                          URL.revokeObjectURL(previewImage)
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {uploading
                        ? `Uploading... ${progress}%`
                        : "Drag and drop an image here, or click to browse"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP, GIF up to 5MB</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image-url">Image URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="image-url"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={inputImageUrl}
                    onChange={(e) => setInputImageUrl(e.target.value)}
                    disabled={updatePreviewImage.isPending}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Enter a direct link to the image you want to use as the preview.
                </p>
              </div>

              <DialogFooter>
                <Button
                  onClick={handleUrlSubmit}
                  disabled={updatePreviewImage.isPending || !inputImageUrl.trim()}
                  className="w-full"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  {updatePreviewImage.isPending ? "Updating..." : "Update Preview"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
