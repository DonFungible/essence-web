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

  // Validate presigned URL response
  const validateUploadResponse = (response: PresignedUrlResponse): void => {
    if (!response.success) {
      throw new Error("Upload URL generation failed")
    }

    if (!response.uploadUrls || !Array.isArray(response.uploadUrls)) {
      throw new Error("Invalid upload URLs response")
    }

    if (!response.zipUpload) {
      throw new Error("Missing ZIP upload configuration")
    }

    // Validate each upload URL
    for (const upload of response.uploadUrls) {
      if (!upload.uploadUrl || !upload.publicUrl) {
        throw new Error(`Invalid upload configuration for ${upload.originalName}`)
      }

      try {
        new URL(upload.uploadUrl)
        new URL(upload.publicUrl)
      } catch (error) {
        throw new Error(`Malformed URL for ${upload.originalName}`)
      }
    }

    // Validate ZIP upload URL
    try {
      new URL(response.zipUpload.uploadUrl)
      new URL(response.zipUpload.publicUrl)
    } catch (error) {
      throw new Error("Malformed ZIP upload URL")
    }
  }

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

    console.log(`🔐 Requesting upload URLs for ${files.length} files...`)

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
      console.error("❌ Upload URL generation failed:", errorData)
      throw new Error(errorData.error || "Failed to generate upload URLs")
    }

    const result = await response.json()

    // Validate the response before returning
    try {
      validateUploadResponse(result)
      console.log(`✅ Generated and validated ${result.uploadUrls.length} upload URLs`)
    } catch (validationError) {
      console.error("❌ Upload URL validation failed:", validationError)
      throw validationError
    }

    return result
  }

  // Upload a single file using pre-signed URL
  const uploadFileToPresignedUrl = async (
    file: File,
    uploadUrl: string,
    onProgress?: (progress: number) => void,
    maxRetries: number = 3
  ): Promise<void> => {
    let lastError: Error | null = null

    // Pre-resolve DNS to avoid SSL handshake issues
    try {
      const url = new URL(uploadUrl)
      console.log(`🔍 Pre-resolving DNS for ${url.hostname}`)
      // Trigger DNS resolution by making a HEAD request (will likely fail but resolves DNS)
      fetch(`https://${url.hostname}/health`, { method: "HEAD", mode: "no-cors" }).catch(() => {})
    } catch (e) {
      // Ignore DNS pre-resolution errors
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Upload attempt ${attempt}/${maxRetries} for ${file.name}`)

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          let progressReported = false
          let sslErrorDetected = false

          // Set timeout to 5 minutes for large files
          const timeout = 5 * 60 * 1000 // 5 minutes
          const timeoutId = setTimeout(() => {
            xhr.abort()
            reject(new Error(`Upload timeout after ${timeout / 1000} seconds`))
          }, timeout)

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100)
              onProgress?.(progress)
              progressReported = true
            }
          })

          xhr.addEventListener("load", () => {
            clearTimeout(timeoutId)
            if (xhr.status === 200 || xhr.status === 201) {
              console.log(`✅ Upload successful for ${file.name} (${xhr.status})`)
              resolve()
            } else {
              const errorMsg = `Upload failed with HTTP ${xhr.status}: ${xhr.statusText}`
              console.error(`❌ ${errorMsg}`)
              reject(new Error(errorMsg))
            }
          })

          xhr.addEventListener("error", (event) => {
            clearTimeout(timeoutId)
            console.error(`❌ Network error for ${file.name}:`, event)

            // Try to provide more specific error information
            let errorMessage = "Upload failed due to network error"

            // Check for SSL-specific errors
            if (xhr.readyState === XMLHttpRequest.UNSENT) {
              errorMessage = "Upload failed: Could not initiate request"
            } else if (xhr.readyState === XMLHttpRequest.OPENED) {
              errorMessage = "Upload failed: Connection could not be established"
              sslErrorDetected = true
            } else if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
              errorMessage = "Upload failed: Server rejected the request"
            } else if (xhr.readyState === XMLHttpRequest.LOADING) {
              errorMessage = "Upload failed: Connection lost during upload"
            }

            // Add progress information if available
            if (progressReported) {
              errorMessage += " (upload was in progress)"
            }

            // Add SSL-specific guidance
            if (sslErrorDetected || errorMessage.includes("connection")) {
              errorMessage +=
                " - This may be an SSL/TLS connection issue. Try disabling VPN, checking firewall settings, or switching networks."
            }

            reject(new Error(errorMessage))
          })

          xhr.addEventListener("abort", () => {
            clearTimeout(timeoutId)
            reject(new Error("Upload was cancelled or timed out"))
          })

          // Configure XHR for better SSL compatibility
          xhr.open("PUT", uploadUrl)

          // Set headers for better compatibility
          xhr.setRequestHeader("Content-Type", file.type)

          // Add user agent for better server compatibility
          xhr.setRequestHeader("User-Agent", "EssenceWeb-Upload/1.0")

          // Force HTTP/1.1 for better compatibility (some SSL issues are HTTP/2 related)
          try {
            xhr.setRequestHeader("Connection", "keep-alive")
          } catch (e) {
            // Ignore if browser doesn't allow this header
          }

          console.log(`📡 Starting upload for ${file.name} (${Math.round(file.size / 1024)}KB)`)
          console.log(`🔗 Upload URL domain: ${new URL(uploadUrl).hostname}`)

          xhr.send(file)
        })

        // If we get here, upload was successful
        console.log(`✅ Upload completed for ${file.name}`)
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`❌ Upload attempt ${attempt} failed for ${file.name}:`, lastError.message)

        // Check if this is an SSL-related error
        const isSSLError =
          lastError.message.includes("SSL") ||
          lastError.message.includes("TLS") ||
          lastError.message.includes("connection") ||
          lastError.message.includes("handshake")

        // If this isn't the last attempt, wait before retrying
        if (attempt < maxRetries) {
          // For SSL errors, use longer delays and suggest network changes
          const baseDelay = isSSLError ? 5000 : 2000 // 5s for SSL errors, 2s for others
          const delayMs = baseDelay * Math.pow(2, attempt - 1)

          if (isSSLError) {
            console.log(`🔒 SSL/TLS error detected. Consider:`)
            console.log(`   - Disabling VPN or proxy`)
            console.log(`   - Switching to a different network`)
            console.log(`   - Checking firewall/antivirus settings`)
            console.log(`   - Using a different browser`)
          }

          console.log(`⏳ Waiting ${delayMs}ms before retry...`)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }

    // If all retries failed, throw the last error with additional context
    const finalError = new Error(
      `Failed to upload ${file.name} after ${maxRetries} attempts: ${lastError?.message}`
    )

    // Add specific guidance for SSL errors
    if (
      lastError?.message &&
      (lastError.message.includes("SSL") || lastError.message.includes("connection"))
    ) {
      finalError.message +=
        "\n\nThis appears to be an SSL/TLS connection issue. Try:\n" +
        "1. Disable VPN or proxy temporarily\n" +
        "2. Switch to a different network (mobile hotspot)\n" +
        "3. Check firewall/antivirus settings\n" +
        "4. Try a different browser\n" +
        "5. Clear browser SSL cache"
    }

    throw finalError
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
    onOverallProgress?: (progress: number) => void,
    metadata?: Array<{ name: string; description?: string }>
  ): Promise<{
    uploadedFiles: UploadUrl[]
    zipFileInfo: ZipUpload & { fileSize: number }
    metadata?: Array<{ name: string; description?: string }>
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
        metadata,
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
    zipFileInfo: ZipUpload & { fileSize: number },
    metadata?: Array<{ name: string; description?: string }>
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
        metadata,
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
