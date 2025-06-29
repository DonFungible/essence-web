import { useState } from "react"

interface UploadFile {
  name: string
  size: number
  type: string
}

interface UploadUrl {
  fileName: string
  originalName: string
  storagePath: string
  uploadUrl: string
  publicUrl: string
  fileSize: number
  contentType: string
}

interface ZipUpload {
  fileName: string
  storagePath: string
  uploadUrl: string
  publicUrl: string
}

interface PresignedUrlResponse {
  success: boolean
  uploadUrls: UploadUrl[]
  zipUpload: ZipUpload
  trainingJobId: string
}

interface UploadProgress {
  fileIndex: number
  fileName: string
  progress: number
  status: "pending" | "uploading" | "completed" | "failed"
  error?: string
}

export function usePresignedUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [error, setError] = useState<string | null>(null)

  // Generate pre-signed URLs
  const generateUploadUrls = async (
    files: File[],
    trainingJobId: string
  ): Promise<PresignedUrlResponse> => {
    const fileData = files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }))

    const response = await fetch("/api/upload-presigned", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: fileData,
        trainingJobId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to generate upload URLs")
    }

    return response.json()
  }

  // Upload a single file using pre-signed URL
  const uploadFileToPresignedUrl = async (
    file: File,
    uploadUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress?.(progress)
        }
      })

      xhr.addEventListener("load", () => {
        if (xhr.status === 200 || xhr.status === 201) {
          resolve()
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      })

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed due to network error"))
      })

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload was aborted"))
      })

      xhr.open("PUT", uploadUrl)
      xhr.setRequestHeader("Content-Type", file.type)
      xhr.send(file)
    })
  }

  // Create ZIP file from uploaded files
  const createZipFile = async (files: File[]): Promise<Blob> => {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()

    // Add each file to the zip with clean naming
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const fileName = `image_${String(i + 1).padStart(3, "0")}_${cleanName}`
      zip.file(fileName, file)
    }

    // Generate the zip file
    return await zip.generateAsync({ type: "blob" })
  }

  // Upload multiple files with progress tracking
  const uploadFiles = async (
    files: File[],
    trainingJobId: string,
    onOverallProgress?: (progress: number) => void
  ): Promise<{
    uploadedFiles: UploadUrl[]
    zipFileInfo: ZipUpload & { fileSize: number }
  }> => {
    setIsUploading(true)
    setError(null)

    try {
      // Initialize progress tracking
      const initialProgress = files.map((file, index) => ({
        fileIndex: index,
        fileName: file.name,
        progress: 0,
        status: "pending" as const,
      }))
      setUploadProgress(initialProgress)

      // Generate pre-signed URLs
      console.log("🔐 Generating pre-signed URLs...")
      const { uploadUrls, zipUpload } = await generateUploadUrls(files, trainingJobId)

      // Upload individual files
      console.log(`📤 Uploading ${files.length} files...`)
      const uploadedFiles: UploadUrl[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const uploadUrl = uploadUrls[i]

        try {
          // Update progress to show uploading
          setUploadProgress((prev) =>
            prev.map((p) => (p.fileIndex === i ? { ...p, status: "uploading" as const } : p))
          )

          await uploadFileToPresignedUrl(file, uploadUrl.uploadUrl, (progress) => {
            setUploadProgress((prev) =>
              prev.map((p) => (p.fileIndex === i ? { ...p, progress } : p))
            )
          })

          // Mark as completed
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.fileIndex === i ? { ...p, status: "completed" as const, progress: 100 } : p
            )
          )

          uploadedFiles.push(uploadUrl)
          console.log(`✅ Uploaded ${file.name}`)

          // Update overall progress
          const overallProgress = Math.round(((i + 1) / (files.length + 1)) * 70) // 70% for individual files
          onOverallProgress?.(overallProgress)
        } catch (error) {
          console.error(`❌ Failed to upload ${file.name}:`, error)

          // Mark as failed
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.fileIndex === i
                ? {
                    ...p,
                    status: "failed" as const,
                    error: error instanceof Error ? error.message : "Upload failed",
                  }
                : p
            )
          )

          throw new Error(
            `Failed to upload ${file.name}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          )
        }
      }

      // Create and upload ZIP file
      console.log("📦 Creating ZIP file...")
      onOverallProgress?.(75)

      const zipBlob = await createZipFile(files)
      console.log(`📦 Created ZIP file: ${Math.round(zipBlob.size / 1024 / 1024)}MB`)

      console.log("📤 Uploading ZIP file...")
      await uploadFileToPresignedUrl(
        new File([zipBlob], zipUpload.fileName, { type: "application/zip" }),
        zipUpload.uploadUrl,
        (progress) => {
          const zipProgress = 75 + Math.round(progress * 0.25) // 25% for ZIP upload
          onOverallProgress?.(zipProgress)
        }
      )

      console.log("✅ ZIP file uploaded successfully")
      onOverallProgress?.(100)

      return {
        uploadedFiles,
        zipFileInfo: {
          ...zipUpload,
          fileSize: zipBlob.size,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed"
      setError(errorMessage)
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  // Process uploaded files (IP registration and training start)
  const processUploadedFiles = async (
    trainingJobId: string,
    uploadedFiles: UploadUrl[],
    zipFileInfo: ZipUpload & { fileSize: number }
  ) => {
    console.log("🔄 Processing uploaded files...", {
      trainingJobId,
      fileCount: uploadedFiles.length,
      zipSize: Math.round(zipFileInfo.fileSize / 1024 / 1024) + "MB",
    })

    const response = await fetch("/api/process-uploaded-files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trainingJobId,
        uploadedFiles,
        zipFileInfo,
      }),
    })

    console.log("📝 Process API response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json()
      console.error("❌ Process API error:", errorData)
      throw new Error(errorData.error || "Failed to process uploaded files")
    }

    const result = await response.json()
    console.log("✅ Process API success:", result)
    return result
  }

  return {
    isUploading,
    uploadProgress,
    error,
    uploadFiles,
    processUploadedFiles,
  }
}
