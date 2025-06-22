"use client"

import type React from "react"
import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import { AlertCircle, ArrowLeft, FileArchiveIcon as FileZip, Loader2, Settings, UploadCloud, Wand2 } from "lucide-react"
import { useFileUpload } from "@/hooks/use-upload"

import { startTrainingJobOptimized, startTrainingJob } from "./actions"

type Step = "upload" | "configure"

// --- React Client Component ---

export default function TrainModelPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState("")
  const [isConsentGiven, setIsConsentGiven] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [useOptimizedUpload, setUseOptimizedUpload] = useState(true)
  
  // Upload state for optimized flow
  const { uploading, progress, uploadFile } = useFileUpload()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      
      // Validate file type
      if (!selectedFile.type.includes('zip') && !selectedFile.type.includes('application/zip')) {
        setFormError("Please upload a valid .zip file.")
        return
      }

      // Validate file size (100MB limit)
      if (selectedFile.size > 100 * 1024 * 1024) {
        setFormError("File size must be less than 100MB.")
        return
      }

      setFile(selectedFile)
      setFileName(selectedFile.name)
      setFormError(null)
      
      // Just store the file, don't upload yet
      console.log(`File selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024 / 1024)}MB)`)
    }
  }

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isConsentGiven) {
      setFormError("You must agree to the terms to start training.")
      return
    }

    if (!file) {
      setFormError("Please select a file to upload.")
      return
    }

    setIsLoading(true)
    setFormError(null)

    try {
      let result

      if (useOptimizedUpload && file) {
        // Optimized flow: Upload file now, then submit to Replicate
        console.log("🚀 Starting optimized upload and training flow...")
        
        // Step 1: Upload file to Supabase
        const uploadResult = await uploadFile(file, {
          onProgress: (progress) => {
            console.log(`Upload progress: ${progress}%`)
          },
          onError: (error) => {
            console.error('Upload error:', error)
            throw new Error(`Upload failed: ${error}`)
          }
        })

        console.log("✅ File uploaded successfully:", uploadResult.publicUrl)

        // Step 2: Get form data and submit to Replicate
        const formElement = document.getElementById("trainModelForm") as HTMLFormElement
        if (!formElement) {
          throw new Error("Form element not found")
        }
        const formData = new FormData(formElement)
        const triggerWord = formData.get("trigger_word") as string
        const captioning = formData.get("captioning") as string
        const trainingSteps = formData.get("training_steps") as string

        result = await startTrainingJobOptimized({
          publicUrl: uploadResult.publicUrl,
          storagePath: uploadResult.storagePath,
          originalFileName: fileName,
          triggerWord: triggerWord || "TOK",
          captioning: captioning || "automatic",
          trainingSteps: trainingSteps || "300"
        })
      } else if (file) {
        // Legacy flow: Upload via server action
        const formElement = document.getElementById("trainModelForm") as HTMLFormElement
        if (!formElement) {
          throw new Error("Form element not found")
        }
        const formData = new FormData(formElement)
        formData.append("file", file)
        result = await startTrainingJob(formData)
      } else {
        throw new Error("No file selected")
      }

      setIsLoading(false)

      if (result.success && result.jobId) {
        setIsModalOpen(false)
        router.push(`/train/status?jobId=${result.jobId}`)
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

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="max-w-3xl mx-auto">
            {!file && (
              <Card className="text-center">
                <CardHeader>
                  <CardTitle>Train a New Style Model</CardTitle>
                  <CardDescription>Start by uploading your dataset as a .zip file (up to 100MB).</CardDescription>
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
                      <p className="text-xs text-slate-500">ZIP file (up to 100MB, MIN 10 images recommended)</p>
                    </div>
                    <Input id="file-upload" type="file" className="hidden" accept=".zip" onChange={handleFileChange} />
                  </Label>
                  {formError && (
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
                  {file && <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <FileZip className="mr-2" />
                        Selected File
                      </CardTitle>
                      <CardDescription>
                        {fileName} • {Math.round(file.size / 1024 / 1024)}MB
                      </CardDescription>
                    </CardHeader>
                  </Card>}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Settings className="mr-2" /> Model Configuration
                      </CardTitle>
                      <CardDescription>Adjust the parameters for your fine-tuning job.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="trigger_word">Model Name (no spaces)</Label>
                        <Input
                          id="trigger_word"
                          name="trigger_word"
                          defaultValue="HRGIGER"
                          placeholder="e.g., myuniquestyle"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          A unique word to activate your model during generation.
                        </p>
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
                    </CardContent>
                  </Card>

                  <Button type="button" className="w-full" onClick={() => setIsModalOpen(true)} disabled={isLoading || !file}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    {isLoading ? "Uploading & Starting Training..." : "Review & Start Training"}
                  </Button>
                  {formError && (
                    <p className="mt-2 text-sm text-red-600 text-center">
                      <AlertCircle className="inline w-4 h-4 mr-1" />
                      {formError}
                    </p>
                  )}

                  <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Training & Data Usage</AlertDialogTitle>
                        <AlertDialogDescription>
                          Please review and agree to the following terms before starting the training process.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4 text-sm text-slate-600 space-y-3">
                        <ul className="list-disc list-inside space-y-2">
                          <li>You confirm you have the rights to use the uploaded images for AI model training.</li>
                          <li>
                            Your images will be used solely for the purpose of training your private model and will not
                            be shared.
                          </li>
                          <li>
                            As part of our commitment to creator rights, a hash of your images will be registered as
                            Intellectual Property on the <strong>Story blockchain</strong>. This creates a
                            verifiable, on-chain link between you and your dataset.
                          </li>
                        </ul>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="terms" onCheckedChange={(checked) => setIsConsentGiven(Boolean(checked))} />
                        <label
                          htmlFor="terms"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
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
                          <Button type="submit" form="trainModelForm" disabled={!isConsentGiven || isLoading || !file}>
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {uploading ? `Uploading... ${progress}%` : "Starting Training..."}
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
