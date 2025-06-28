"use client"

import type React from "react"
import { useState, type FormEvent, useRef } from "react" // Added useRef
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea" // Added Textarea
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import {
  AlertCircle,
  ArrowLeft,
  FileArchiveIcon as FileZip,
  ImageIcon,
  Loader2,
  Settings,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react"
import { useFileUpload } from "@/hooks/use-upload"
import Image from "next/image" // Added Next Image for preview

import { startTrainingJobOptimized, createTrainingJobForImages } from "./actions"

// --- React Client Component ---

export default function TrainModelPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState("")
  const [images, setImages] = useState<File[]>([]) // New state for multiple images
  const [uploadType, setUploadType] = useState<"zip" | "images" | null>(null) // Track upload type

  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null) // New state for preview image file
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null) // New state for preview image src for display
  const previewImageInputRef = useRef<HTMLInputElement>(null) // Ref for preview image input

  const [isConsentGiven, setIsConsentGiven] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const {
    uploading: datasetUploading,
    progress: datasetProgress,
    uploadFile: uploadDatasetFile,
    uploadMultipleImages: uploadMultipleImagesFile,
  } = useFileUpload()
  const {
    uploading: previewUploading,
    progress: previewProgress,
    uploadFile: uploadPreviewImageFile,
  } = useFileUpload()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files)

      if (fileList.length === 1) {
        const selectedFile = fileList[0] as File

        // Check if it's a zip file
        if (selectedFile.type.includes("zip") || selectedFile.type.includes("application/zip")) {
          if (selectedFile.size > 2000 * 1024 * 1024) {
            setFormError("ZIP file size must be less than 2GB.")
            return
          }
          setFile(selectedFile)
          setFileName(selectedFile.name)
          setImages([])
          setUploadType("zip")
          setFormError(null)
          return
        }
      }

      // Check if all files are images
      const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
      const imageFiles = fileList as File[]
      const invalidFiles = imageFiles.filter((file) => !validImageTypes.includes(file.type))

      if (invalidFiles.length > 0) {
        setFormError("All files must be images (JPG, PNG, WEBP, GIF) or a single ZIP file.")
        return
      }

      // Check minimum images requirement
      if (imageFiles.length < 5) {
        setFormError("At least 5 images are required for training.")
        return
      }

      // Check individual file sizes
      const oversizedFiles = imageFiles.filter((file) => file.size > 10 * 1024 * 1024)
      if (oversizedFiles.length > 0) {
        setFormError(`Some images are too large. Maximum size is 10MB per image.`)
        return
      }

      // Check total size
      const totalSize = imageFiles.reduce((sum, file) => sum + file.size, 0)
      if (totalSize > 500 * 1024 * 1024) {
        setFormError("Total images size exceeds 500MB limit.")
        return
      }

      setImages(imageFiles)
      setFile(null)
      setFileName("")
      setUploadType("images")
      setFormError(null)
    }
  }

  const handlePreviewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
      if (!validImageTypes.includes(selectedFile.type)) {
        setFormError("Invalid preview image type. Use JPG, PNG, WEBP or GIF.")
        return
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        // 5MB limit for preview
        setFormError("Preview image size must be less than 5MB.")
        return
      }
      setPreviewImageFile(selectedFile)
      setPreviewImageSrc(URL.createObjectURL(selectedFile))
      setFormError(null)
    }
  }

  const clearPreviewImage = () => {
    setPreviewImageFile(null)
    setPreviewImageSrc(null)
    if (previewImageInputRef.current) {
      previewImageInputRef.current.value = "" // Reset file input
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAllFiles = () => {
    setFile(null)
    setFileName("")
    setImages([])
    setUploadType(null)
    setFormError(null)
    // Reset file input
    const fileInput = document.getElementById("file-upload") as HTMLInputElement
    if (fileInput) {
      fileInput.value = ""
    }
  }

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isConsentGiven) {
      setFormError("You must agree to the terms to start training.")
      return
    }
    if (!file && images.length === 0) {
      setFormError("Please select a dataset file or images to upload.")
      return
    }

    setIsLoading(true)
    setFormError(null)

    try {
      let result
      const formElement = document.getElementById("trainModelForm") as HTMLFormElement
      if (!formElement) throw new Error("Form element not found")

      const formData = new FormData(formElement) // Contains trigger_word, description, etc.
      const triggerWord = formData.get("trigger_word") as string
      const description = formData.get("description") as string | null
      const captioning = formData.get("captioning") as string
      const trainingSteps = formData.get("training_steps") as string

      // Upload preview image first if present
      let previewImageUrl: string | undefined = undefined
      if (previewImageFile) {
        console.log("🚀 Uploading preview image...")
        const previewUploadResult = await uploadPreviewImageFile(previewImageFile)
        previewImageUrl = previewUploadResult.publicUrl
        console.log("✅ Preview image uploaded:", previewImageUrl)
      }

      // Upload dataset (handle both zip file and multiple images)
      let datasetUploadResult: { publicUrl: string; storagePath: string; fileName: string }
      let originalFileName: string
      let trainingJobId: string | undefined

      if (uploadType === "zip" && file) {
        console.log("🚀 Uploading ZIP dataset file...")
        datasetUploadResult = await uploadDatasetFile(file)
        originalFileName = fileName
        console.log("✅ ZIP dataset uploaded successfully:", datasetUploadResult.publicUrl)
      } else if (uploadType === "images" && images.length > 0) {
        // For individual images, create training job first to get ID
        console.log("🚀 Creating training job for individual images...")
        const trainingJobResult = await createTrainingJobForImages({
          triggerWord: triggerWord || "TOK",
          captioning: captioning || "automatic",
          trainingSteps: trainingSteps || "300",
          previewImageUrl: previewImageUrl,
          description: description,
          imageCount: images.length,
        })

        if (!trainingJobResult.success) {
          throw new Error(trainingJobResult.error || "Failed to create training job")
        }

        trainingJobId = trainingJobResult.trainingJobId
        console.log(`✅ Training job created with ID: ${trainingJobId}`)

        console.log(`🚀 Uploading ${images.length} images and creating ZIP...`)
        datasetUploadResult = await uploadMultipleImagesFile(images, { trainingJobId })
        originalFileName = `${images.length}-images-dataset.zip`
        console.log("✅ Images uploaded and zipped successfully:", datasetUploadResult.publicUrl)
      } else {
        throw new Error("Invalid upload type or missing files")
      }

      result = await startTrainingJobOptimized({
        publicUrl: datasetUploadResult.publicUrl,
        storagePath: datasetUploadResult.storagePath,
        originalFileName: originalFileName,
        triggerWord: triggerWord || "TOK",
        captioning: captioning || "automatic",
        trainingSteps: trainingSteps || "300",
        previewImageUrl: previewImageUrl, // Pass new field
        description: description, // Pass new field
        hasIndividualImages: uploadType === "images",
        individualImagesCount: uploadType === "images" ? images.length : 0,
      })

      setIsLoading(false)
      if (result.success && result.jobId) {
        setIsModalOpen(false)
        router.push(`/models`)
      } else {
        setFormError(result.error || "Failed to start training job. Please try again.")
        setIsModalOpen(false)
      }
    } catch (error) {
      setIsLoading(false)
      setFormError(error instanceof Error ? error.message : "An unexpected error occurred")
      setIsModalOpen(false)
    }
  }

  const currentUploading = datasetUploading || previewUploading
  const currentProgress = datasetUploading
    ? datasetProgress
    : previewUploading
    ? previewProgress
    : 0
  const uploadMessage = datasetUploading
    ? uploadType === "images"
      ? `Creating ZIP from ${images.length} images... ${datasetProgress}%`
      : `Uploading Dataset... ${datasetProgress}%`
    : previewUploading
    ? `Uploading Preview... ${previewProgress}%`
    : "Starting Training..."

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="max-w-3xl mx-auto">
            {!file && images.length === 0 && (
              // Initial dataset upload card
              <Card className="">
                <CardHeader>
                  <CardTitle>Train a New Style Model</CardTitle>
                  <CardDescription>
                    Upload your dataset as a .zip file (up to 2GB) or select multiple images
                    (minimum 5, max 10MB each).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-50"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-10 h-10 mb-3 text-slate-400" />
                      <p className="mb-2 text-sm text-slate-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-slate-500 text-center">
                        ZIP file (up to 2GB) or multiple images (JPG, PNG, WEBP, GIF)
                        <br />
                        Minimum 5 images required • Maximum 10MB per image
                      </p>
                    </div>
                    <Input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept=".zip,image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      onChange={handleFileChange}
                    />
                  </Label>
                  {formError &&
                    !file &&
                    images.length === 0 && ( // Show error only if no files selected yet
                      <p className="mt-2 text-sm text-red-600">
                        <AlertCircle className="inline w-4 h-4 mr-1" />
                        {formError}
                      </p>
                    )}
                </CardContent>
              </Card>
            )}

            <form id="trainModelForm" onSubmit={handleFormSubmit}>
              <div className="space-y-6">
                {file && uploadType === "zip" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileZip className="mr-2" />
                          Selected ZIP Dataset
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={clearAllFiles}>
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        {fileName} • {Math.round(file.size / 1024 / 1024)}MB
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}

                {images.length > 0 && uploadType === "images" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <ImageIcon className="mr-2" />
                          Selected Images ({images.length})
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={clearAllFiles}>
                          <X className="h-4 w-4 mr-1" />
                          Remove All
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        Total size:{" "}
                        {Math.round(images.reduce((sum, img) => sum + img.size, 0) / 1024 / 1024)}MB
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {images.map((image, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square relative rounded-lg overflow-hidden border">
                              <Image
                                src={URL.createObjectURL(image)}
                                alt={`Preview ${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 truncate">{image.name}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Preview Image Upload Section */}
                {/* <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ImageIcon className="mr-2" /> Optional: Preview Image
                    </CardTitle>
                    <CardDescription>
                      Upload an image (JPG, PNG, WEBP, GIF, max 5MB) to represent your model on its
                      card.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {previewImageSrc ? (
                      <div className="relative group w-48 h-48 mx-auto">
                        <Image
                          src={previewImageSrc || "/placeholder.svg"}
                          alt="Preview"
                          layout="fill"
                          objectFit="cover"
                          className="rounded-md"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={clearPreviewImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Label
                        htmlFor="preview-image-upload"
                        className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-slate-50"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadCloud className="w-8 h-8 mb-3 text-slate-400" />
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold">Click to upload preview</span>
                          </p>
                        </div>
                        <Input
                          id="preview-image-upload"
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handlePreviewImageChange}
                          ref={previewImageInputRef}
                        />
                      </Label>
                    )}
                  </CardContent>
                </Card> */}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Settings className="mr-2" /> Model Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="trigger_word">Model Name / Trigger Word</Label>
                      <Input
                        id="trigger_word"
                        name="trigger_word"
                        defaultValue=""
                        placeholder="e.g., MyUniqueStyle, ArtByHRGIGER"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        A unique word to activate your model. No spaces.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="description">Optional: Model Description</Label>
                      <Textarea
                        id="description"
                        name="description"
                        placeholder="Describe your model's style, subject, or best use cases (max 200 characters)."
                        maxLength={2000}
                        className="h-24"
                      />
                    </div>
                    <div>
                      <Label htmlFor="training_steps">Training Steps</Label>
                      <Select name="training_steps" defaultValue="300">
                        <SelectTrigger>
                          <SelectValue placeholder="Select training steps" />
                        </SelectTrigger>
                        <SelectContent>
                          {[149, 300, 400, 500, 600, 700, 800, 900, 1000].map((s) => (
                            <SelectItem key={s} value={String(s)}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Hidden captioning field, assuming default or future UI */}
                    <input type="hidden" name="captioning" value="automatic" />
                  </CardContent>
                </Card>

                {formError && ( // General form error display
                  <p className="mt-2 text-sm text-red-600 text-center">
                    <AlertCircle className="inline w-4 h-4 mr-1" />
                    {formError}
                  </p>
                )}

                <Button
                  type="button"
                  className="w-full"
                  onClick={() => setIsModalOpen(true)}
                  disabled={isLoading || (!file && images.length === 0)}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? "Processing..." : "Review & Start Training"}
                </Button>

                <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Training & Data Usage</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="py-4 text-sm text-slate-600 space-y-3">
                      {/* Terms unchanged */}
                      <ul className="list-disc list-inside space-y-2">
                        <li>
                          You confirm you have the rights to use the uploaded images for AI model
                          training.
                        </li>
                        <li>
                          Your images will be used solely for the purpose of training your private
                          model and will not be shared.
                        </li>
                        <li>
                          As part of our commitment to creator rights, a hash of your images will be
                          registered as Intellectual Property on the{" "}
                          <strong>Story blockchain</strong>. This creates a verifiable, on-chain
                          link between you and your dataset.
                        </li>
                      </ul>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="terms"
                        onCheckedChange={(checked) => setIsConsentGiven(Boolean(checked))}
                      />
                      <label htmlFor="terms" className="text-sm font-medium">
                        I have read and agree to the terms and conditions.
                      </label>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => {
                          setIsModalOpen(false)
                          setIsLoading(false)
                        }}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <Button
                          type="submit"
                          form="trainModelForm"
                          disabled={!isConsentGiven || isLoading || (!file && images.length === 0)}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {currentUploading ? uploadMessage : "Starting Training..."}
                            </>
                          ) : (
                            "Agree & Start Training"
                          )}
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
            <div className="mt-8 text-center">
              <Link href="/models" className="text-sm text-slate-600 hover:text-slate-800">
                <ArrowLeft className="inline w-4 h-4 mr-1" /> Back to All Models
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
