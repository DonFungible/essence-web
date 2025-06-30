"use client"

import type React from "react"
import { useState, type FormEvent, useRef, useEffect, useMemo, useCallback } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
  CheckCircle,
  FileArchiveIcon as FileZip,
  ImageIcon,
  Loader2,
  Settings,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react"
import { useFileUpload } from "@/hooks/use-upload"
import { usePresignedUpload } from "@/hooks/use-presigned-upload"
import Image from "next/image"
import { usePrivy } from "@privy-io/react-auth"

import { startTrainingJobOptimized, createTrainingJobForImages, checkUserCanTrain } from "./actions"
import { useStoryIPRegistration } from "@/hooks/use-story-ip-registration"
import { zeroAddress } from "viem"

// Progress tracking types
interface TrainingProgress {
  stage: "consent" | "upload" | "registration" | "training" | "complete"
  uploadProgress: number
  registrationProgress: {
    total: number
    completed: number
    current?: string
    zipProgress?: boolean
  } | null
  trainingStarted: boolean
  error?: string
}

// Image metadata type
interface ImageMetadata {
  name: string
  description: string
}

export default function TrainModelPage() {
  const router = useRouter()
  const { authenticated, user } = usePrivy()

  const [images, setImages] = useState<File[]>([])
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata[]>([])

  // Memoize image URLs to prevent flickering
  const imageUrls = useMemo(() => {
    return images.map((file) => URL.createObjectURL(file))
  }, [images])

  // Cleanup URLs when component unmounts or images change
  useEffect(() => {
    return () => {
      imageUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imageUrls])

  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null)
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null)
  const previewImageInputRef = useRef<HTMLInputElement>(null)

  const [isConsentGiven, setIsConsentGiven] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress>({
    stage: "consent",
    uploadProgress: 0,
    registrationProgress: null,
    trainingStarted: false,
  })
  const [balanceCheckLoading, setBalanceCheckLoading] = useState(false)
  const [balanceCheckResult, setBalanceCheckResult] = useState<{
    canTrain: boolean
    reason?: string
    balance?: string
    isWhitelisted?: boolean
  } | null>(null)
  const [ipRegistrationMethod, setIPRegistrationMethod] = useState<"backend" | "wallet">("backend")

  const {
    uploading: previewUploading,
    progress: previewProgress,
    uploadFile: uploadPreviewImageFile,
  } = useFileUpload()
  const {
    registerTrainingImages,
    isRegistering: isRegisteringIP,
    error: ipRegistrationError,
    registrationProgress,
  } = useStoryIPRegistration()

  // New pre-signed upload hook
  const {
    isUploading: isPresignedUploading,
    uploadProgress: presignedUploadProgress,
    error: presignedUploadError,
    uploadFiles,
    processUploadedFiles,
  } = usePresignedUpload()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files)

      // Check if all files are images
      const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
      const imageFiles = fileList as File[]
      const invalidFiles = imageFiles.filter((file) => !validImageTypes.includes(file.type))

      if (invalidFiles.length > 0) {
        setFormError("All files must be images (JPG, PNG, WEBP, GIF).")
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
      // Initialize metadata with default values
      setImageMetadata(
        imageFiles.map(() => ({
          name: "",
          description: "",
        }))
      )
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
      previewImageInputRef.current.value = ""
    }
  }

  const removeImage = useCallback(
    (index: number) => {
      // Revoke URL for the removed image
      if (imageUrls[index]) {
        URL.revokeObjectURL(imageUrls[index])
      }

      setImages((prev) => prev.filter((_, i) => i !== index))
      // Also remove from metadata
      setImageMetadata((prev) => prev.filter((_, i) => i !== index))
    },
    [imageUrls]
  )

  const clearAllFiles = () => {
    setImages([])
    setImageMetadata([])
    setFormError(null)
    setBalanceCheckResult(null)
    const fileInput = document.getElementById("file-upload") as HTMLInputElement
    if (fileInput) {
      fileInput.value = ""
    }
  }

  const checkUserBalance = async () => {
    if (!authenticated || !user?.wallet?.address) {
      setFormError("Please connect your wallet to proceed with training.")
      return false
    }

    setBalanceCheckLoading(true)
    setFormError(null)

    try {
      const result = await checkUserCanTrain(user.wallet.address)
      setBalanceCheckResult(result)

      if (!result.canTrain) {
        setFormError(result.reason || "Insufficient balance for IP registration")
        return false
      }

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to check wallet balance"
      setFormError(errorMessage)
      return false
    } finally {
      setBalanceCheckLoading(false)
    }
  }

  const handleReviewTraining = async () => {
    // Basic validation
    if (images.length === 0) {
      setFormError("Please select images to upload.")
      return
    }

    // Check wallet connection
    if (!authenticated || !user?.wallet?.address) {
      setFormError("Please connect your wallet to proceed with training.")
      return
    }

    // Only check balance if using connected wallet for IP registration
    if (ipRegistrationMethod === "wallet") {
      if (!balanceCheckResult || !balanceCheckResult.canTrain) {
        const canProceed = await checkUserBalance()
        if (!canProceed) {
          return
        }
      }
    }

    // Reset progress and open modal
    setTrainingProgress({
      stage: "consent",
      uploadProgress: 0,
      registrationProgress: null,
      trainingStarted: false,
    })
    setIsModalOpen(true)
  }

  const handleStartTraining = async () => {
    if (!isConsentGiven) {
      setFormError("You must agree to the terms to start training.")
      return
    }

    // Move to upload stage
    setTrainingProgress((prev) => ({
      ...prev,
      stage: "upload",
    }))

    try {
      const formElement = document.getElementById("trainModelForm") as HTMLFormElement
      if (!formElement) throw new Error("Form element not found")

      const formData = new FormData(formElement)
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

      if (images.length > 0) {
        // Handle individual images with new pre-signed URL approach
        console.log("🚀 Creating training job for individual images...")

        const trainingJobResult = await createTrainingJobForImages({
          triggerWord: triggerWord || "TOK",
          captioning: captioning || "automatic",
          trainingSteps: trainingSteps || "300",
          previewImageUrl: previewImageUrl,
          description: description,
          imageCount: images.length,
          userWalletAddress: user?.wallet?.address || zeroAddress,
          ipRegistrationMethod: ipRegistrationMethod,
        })

        if (!trainingJobResult.success) {
          throw new Error(trainingJobResult.error || "Failed to create training job")
        }

        const trainingJobId = trainingJobResult.trainingJobId
        console.log(`✅ Training job created with ID: ${trainingJobId}`)

        if (ipRegistrationMethod === "backend") {
          // Use pre-signed URL approach for backend method
          setTrainingProgress((prev) => ({
            ...prev,
            stage: "upload",
            registrationProgress: { total: images.length, completed: 0 },
          }))

          console.log(`🚀 Starting presigned URL upload process for ${images.length} images...`)

          try {
            // Upload files using pre-signed URLs
            console.log("📤 Starting file uploads...")
            const nftMetadata = images.map((file, index) => ({
              name: imageMetadata[index]?.name?.trim() || file.name,
              description: imageMetadata[index]?.description?.trim() || undefined,
            }))
            const { uploadedFiles, zipFileInfo } = await uploadFiles(
              images,
              trainingJobId,
              (progress) => {
                console.log(`📊 Upload progress: ${progress}%`)
                setTrainingProgress((prev) => ({
                  ...prev,
                  uploadProgress: progress,
                }))
              },
              nftMetadata
            )

            console.log(`✅ All files uploaded successfully - ${uploadedFiles.length} files`)

            // Move to registration stage
            setTrainingProgress((prev) => ({
              ...prev,
              stage: "registration",
              uploadProgress: 100,
              registrationProgress: { total: images.length, completed: 0 },
            }))

            console.log("🔐 Starting IP registration and training process...")

            // Start progress simulation for registration with timeout protection
            let progressCounter = 0
            const maxProgress = images.length

            const progressInterval = setInterval(() => {
              progressCounter++
              setTrainingProgress((prev) => {
                if (
                  prev.registrationProgress &&
                  prev.registrationProgress.completed < images.length
                ) {
                  const nextCompleted = Math.min(
                    prev.registrationProgress.completed + 1,
                    images.length
                  )
                  return {
                    ...prev,
                    registrationProgress: {
                      ...prev.registrationProgress,
                      completed: nextCompleted,
                      current: `Registering image ${nextCompleted} of ${images.length}...`,
                    },
                  }
                }
                return prev
              })

              // Prevent infinite progress - clear after reasonable time
              if (progressCounter > maxProgress + 3) {
                clearInterval(progressInterval)
                console.log("⚠️ Progress simulation timeout reached")
              }
            }, 2500) // Update every 2.5 seconds

            // Process uploaded files (IP registration and training start) - this runs in background
            const result = await processUploadedFiles(
              trainingJobId,
              uploadedFiles,
              zipFileInfo,
              nftMetadata
            )

            // Clear the progress interval
            clearInterval(progressInterval)

            console.log("🎯 Process result:", result)

            if (result.success) {
              // Complete registration and move to training
              setTrainingProgress((prev) => ({
                ...prev,
                stage: "training",
                registrationProgress: {
                  total: images.length,
                  completed: images.length,
                  current: "IP registration complete",
                },
                trainingStarted: true,
              }))

              console.log("✅ Training started successfully!")

              // Auto-redirect after 5 seconds
              setTimeout(() => {
                setIsModalOpen(false)
                router.push(`/models`)
              }, 5000)
            } else {
              setTrainingProgress((prev) => ({
                ...prev,
                error: result.error || "Failed to start training",
              }))
            }
          } catch (error) {
            console.error("❌ Upload/processing error:", error)

            // More detailed error handling
            let errorMessage = "Upload failed"
            if (error instanceof Error) {
              errorMessage = error.message
              console.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
              })
            }

            setTrainingProgress((prev) => ({
              ...prev,
              error: errorMessage,
            }))
          }
        } else {
          // Wallet method - not yet updated for presigned upload system
          setTrainingProgress((prev) => ({
            ...prev,
            stage: "registration",
          }))

          console.log(`🚀 Wallet method IP registration not yet implemented...`)

          // Wallet method would require updating the client-side IP registration
          // to work with the new presigned upload flow
          setTrainingProgress((prev) => ({
            ...prev,
            error:
              "Wallet method not yet supported with new upload system. Please use backend method.",
          }))
        }
      } else {
        throw new Error("No images selected for training")
      }
    } catch (error) {
      setTrainingProgress((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }))
    }
  }

  // Update progress from IP registration hook
  useEffect(() => {
    if (registrationProgress) {
      setTrainingProgress((prev) => ({
        ...prev,
        registrationProgress,
      }))
    }
  }, [registrationProgress])

  // Update progress from upload hooks
  useEffect(() => {
    if (previewUploading) {
      setTrainingProgress((prev) => ({
        ...prev,
        uploadProgress: previewProgress,
      }))
    }
  }, [previewUploading, previewProgress])

  const renderModalContent = () => {
    if (trainingProgress.stage === "consent") {
      return (
        <>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Training & Data Usage</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-4 text-sm text-slate-600 space-y-3">
            <ul className="list-disc list-inside space-y-2">
              <li>
                You confirm you have the rights to use the uploaded images for AI model training.
              </li>
              <li>
                Your images will be used solely for the purpose of training your private model and
                will not be shared.
              </li>
              <li>
                As part of our commitment to creator rights, your images will be registered as
                Intellectual Property on the <strong>Story blockchain</strong>. This creates a
                verifiable, on-chain link between you and your dataset.
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
                setIsConsentGiven(false)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <Button onClick={handleStartTraining} disabled={!isConsentGiven || images.length === 0}>
              Agree & Start Training
            </Button>
          </AlertDialogFooter>
        </>
      )
    }

    // Progress stages
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>Training Progress</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="py-6 space-y-6">
          {trainingProgress.error ? (
            <div className="text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <div>
                <h3 className="font-medium text-red-900">Training Failed</h3>
                <p className="text-sm text-red-600 mt-1">{trainingProgress.error}</p>
              </div>
            </div>
          ) : trainingProgress.trainingStarted ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <div>
                <h3 className="font-medium text-green-900">Training Started!</h3>
                <p className="text-sm text-slate-600 mt-2">
                  Your model is being trained. It may take up to 30 minutes.
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  You will be redirected back to explore other models in the meantime.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upload Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {trainingProgress.stage === "upload"
                      ? "📤 Uploading Images"
                      : ["registration", "training", "complete"].includes(trainingProgress.stage)
                      ? "✅ Images Uploaded"
                      : "⏳ Upload Pending"}
                  </span>
                  {trainingProgress.stage === "upload" && (
                    <span className="text-sm text-slate-500">
                      {trainingProgress.uploadProgress}%
                    </span>
                  )}
                </div>
                <Progress
                  value={
                    trainingProgress.stage === "upload"
                      ? trainingProgress.uploadProgress
                      : ["registration", "training", "complete"].includes(trainingProgress.stage)
                      ? 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              {/* Registration Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {trainingProgress.stage === "registration"
                      ? "🔐 Registering IP Assets"
                      : trainingProgress.stage === "training" ||
                        trainingProgress.stage === "complete"
                      ? "✅ IP Assets Registered"
                      : "⏳ IP Registration Pending"}
                  </span>
                  {trainingProgress.registrationProgress && (
                    <span className="text-sm text-slate-500">
                      {trainingProgress.registrationProgress.completed}/
                      {trainingProgress.registrationProgress.total}
                    </span>
                  )}
                </div>
                <Progress
                  value={
                    trainingProgress.registrationProgress
                      ? (trainingProgress.registrationProgress.completed /
                          trainingProgress.registrationProgress.total) *
                        100
                      : trainingProgress.stage === "training" ||
                        trainingProgress.stage === "complete"
                      ? 100
                      : 0
                  }
                  className="h-2"
                />
                {trainingProgress.registrationProgress?.current && (
                  <p className="text-xs text-slate-500">
                    {trainingProgress.registrationProgress.current}
                  </p>
                )}
              </div>

              {/* ZIP Creation Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {trainingProgress.stage === "registration" &&
                    trainingProgress.registrationProgress?.zipProgress
                      ? "📦 Creating Training Dataset"
                      : trainingProgress.stage === "training" ||
                        trainingProgress.stage === "complete"
                      ? "✅ Dataset Created"
                      : "⏳ Dataset Pending"}
                  </span>
                </div>
                <Progress
                  value={
                    trainingProgress.stage === "registration" &&
                    trainingProgress.registrationProgress?.zipProgress
                      ? 100
                      : trainingProgress.stage === "training" ||
                        trainingProgress.stage === "complete"
                      ? 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              {/* Training Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {trainingProgress.stage === "training"
                      ? "🚀 Starting Training"
                      : "⏳ Training Pending"}
                  </span>
                </div>
                <Progress value={trainingProgress.stage === "training" ? 50 : 0} className="h-2" />
                {trainingProgress.stage === "training" && (
                  <p className="text-xs text-slate-500">Submitting to training queue...</p>
                )}
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          {trainingProgress.trainingStarted ? (
            <Button
              onClick={() => {
                setIsModalOpen(false)
                router.push("/models")
              }}
            >
              Continue to Models
            </Button>
          ) : trainingProgress.error ? (
            <Button
              onClick={() => {
                setIsModalOpen(false)
                setTrainingProgress({
                  stage: "consent",
                  uploadProgress: 0,
                  registrationProgress: null,
                  trainingStarted: false,
                })
                setIsConsentGiven(false)
              }}
            >
              Try Again
            </Button>
          ) : (
            <div className="flex items-center space-x-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Please wait...</span>
            </div>
          )}
        </AlertDialogFooter>
      </>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="max-w-6xl mx-auto pb-8">
            {!images.length && (
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
                  {formError && !images.length && (
                    <p className="mt-2 text-sm text-red-600">
                      <AlertCircle className="inline w-4 h-4 mr-1" />
                      {formError}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {images.length > 0 && (
              <form id="trainModelForm">
                <div className="space-y-6">
                  {images.length > 0 && (
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
                          {Math.round(
                            images.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024
                          )}
                          MB
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                          {images.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="space-y-4">
                              {/* Image Preview */}
                              <div className="relative group">
                                <div className="aspect-square relative rounded-lg overflow-hidden border max-w-[480px] mx-auto">
                                  <Image
                                    src={imageUrls[index]}
                                    alt={`Preview ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeImage(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 text-center">
                                  {Math.round(file.size / 1024)}KB •{" "}
                                  {file.type.split("/")[1].toUpperCase()}
                                </p>
                              </div>

                              {/* Metadata Inputs */}
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-sm font-medium">IP Name</Label>
                                  <Input
                                    value={imageMetadata[index]?.name || ""}
                                    onChange={(e) => {
                                      const newMetadata = [...imageMetadata]
                                      newMetadata[index] = {
                                        ...newMetadata[index],
                                        name: e.target.value,
                                      }
                                      setImageMetadata(newMetadata)
                                    }}
                                    placeholder={file.name}
                                    className="mt-1"
                                  />
                                  <p className="text-xs text-slate-500 mt-1">
                                    Leave empty to use filename: {file.name}
                                  </p>
                                </div>

                                <div>
                                  <Label className="text-sm font-medium">
                                    IP Description (Optional)
                                  </Label>
                                  <Textarea
                                    value={imageMetadata[index]?.description || ""}
                                    onChange={(e) => {
                                      const newMetadata = [...imageMetadata]
                                      newMetadata[index] = {
                                        ...newMetadata[index],
                                        description: e.target.value,
                                      }
                                      setImageMetadata(newMetadata)
                                    }}
                                    placeholder="Describe this image for the NFT metadata..."
                                    rows={3}
                                    maxLength={500}
                                    className="mt-1 resize-none"
                                  />
                                  <p className="text-xs text-slate-500 mt-1">
                                    {imageMetadata[index]?.description?.length || 0}/500 characters
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

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

                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="advanced-settings">
                          <AccordionTrigger className="text-sm">Advanced Settings</AccordionTrigger>
                          <AccordionContent className="space-y-4 pt-2">
                            <div>
                              <Label htmlFor="ip_registration">IP Registration Method</Label>
                              <RadioGroup
                                value={ipRegistrationMethod}
                                onValueChange={(value) =>
                                  setIPRegistrationMethod(value as "backend" | "wallet")
                                }
                                className="mt-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="backend" id="backend" />
                                  <Label htmlFor="backend" className="text-sm font-normal">
                                    Use backend wallet (recommended)
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="wallet" id="wallet" />
                                  <Label htmlFor="wallet" className="text-sm font-normal">
                                    Register IP with connected wallet (coming soon)
                                  </Label>
                                </div>
                              </RadioGroup>
                              <p className="text-xs text-slate-500 mt-1">
                                Backend wallet: Faster, automatic registration. Connected wallet:
                                You own the IP assets.
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>

                      <input type="hidden" name="captioning" value="automatic" />
                    </CardContent>
                  </Card>

                  {formError && (
                    <p className="mt-2 text-sm text-red-600 text-center">
                      <AlertCircle className="inline w-4 h-4 mr-1" />
                      {formError}
                    </p>
                  )}

                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleReviewTraining}
                    disabled={balanceCheckLoading || images.length === 0}
                  >
                    {balanceCheckLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    {balanceCheckLoading ? "Processing..." : "Review & Start Training"}
                  </Button>

                  {/* Combined Modal */}
                  <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <AlertDialogContent className="max-w-md">
                      {renderModalContent()}
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </form>
            )}

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
