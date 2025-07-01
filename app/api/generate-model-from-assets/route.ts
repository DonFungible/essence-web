import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"
import Replicate from "replicate"
import { mintAndRegisterIP, isStoryConfigured, getSPGNftContract } from "@/lib/story-protocol"

// Validate environment variables at startup
function validateEnvironment() {
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }

  return required
}

// Create authenticated Supabase client with proper error handling
function createAuthenticatedSupabaseClient() {
  try {
    const env = validateEnvironment()

    return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    })
  } catch (error) {
    console.error("Failed to create Supabase client:", error)
    throw new Error("Database connection failed. Please check server configuration.")
  }
}

// Enhanced upload function with robust retry logic and proper authentication
async function uploadToSupabaseRobust(
  bucket: string,
  path: string,
  data: ArrayBuffer,
  contentType: string,
  maxRetries: number = 5
) {
  const baseDelay = 3000 // Start with 3 seconds
  const maxDelay = 30000 // Max 30 seconds between retries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `📤 Upload attempt ${attempt}/${maxRetries} for ${path} (${Math.round(
          data.byteLength / 1024
        )}KB)`
      )

      // Create fresh authenticated client for each attempt
      const supabase = createAuthenticatedSupabaseClient()

      // Perform the upload with timeout protection
      const uploadPromise = supabase.storage.from(bucket).upload(path, data, {
        contentType,
        upsert: false,
      })

      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Upload timeout")), 120000)
      )

      const { error } = (await Promise.race([uploadPromise, timeoutPromise])) as any

      if (!error) {
        console.log(`✅ Upload successful for ${path}`)
        return { success: true }
      }

      console.warn(`Upload attempt ${attempt}/${maxRetries} failed with Supabase error:`, error)

      // If it's a duplicate file error, treat as success
      if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
        console.log(`✅ File already exists, treating as success: ${path}`)
        return { success: true }
      }

      // If it's an auth error, don't retry immediately
      if (error.message?.includes("authorization") || error.message?.includes("auth")) {
        console.error(`❌ Authentication error on attempt ${attempt}:`, error.message)
        if (attempt === 1) {
          // Try to recreate client and retry once
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }
      }
    } catch (err) {
      console.warn(`Upload attempt ${attempt}/${maxRetries} failed with exception:`, err)

      // For network errors, add extra recovery time
      if (
        err instanceof Error &&
        (err.message.includes("EPIPE") || err.message.includes("ECONNRESET"))
      ) {
        console.log(`🔄 Network error detected, adding recovery delay...`)
      }
    }

    // Calculate delay with exponential backoff and jitter
    if (attempt < maxRetries) {
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
      const jitter = Math.random() * 1000 // Add up to 1 second of jitter
      const totalDelay = exponentialDelay + jitter

      console.log(
        `⏳ Waiting ${Math.round(totalDelay)}ms before retry (attempt ${
          attempt + 1
        }/${maxRetries})...`
      )
      await new Promise((resolve) => setTimeout(resolve, totalDelay))

      // Add extra delay for network recovery after multiple failures
      if (attempt >= 2) {
        console.log(`🔄 Network recovery delay: 5 seconds...`)
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }

  return { success: false, error: new Error(`Upload failed after ${maxRetries} attempts`) }
}

// Helper function for large files with enhanced retry strategy
async function uploadLargeFile(
  bucket: string,
  path: string,
  data: ArrayBuffer,
  contentType: string
) {
  const fileSize = data.byteLength
  const chunkSize = 5 * 1024 * 1024 // 5MB chunks

  console.log(`📦 Processing file: ${path} (${Math.round(fileSize / 1024 / 1024)}MB)`)

  // For large files, use more retries
  const retries = fileSize > chunkSize ? 7 : 5
  return await uploadToSupabaseRobust(bucket, path, data, contentType, retries)
}

// Helper function to validate upload success
async function validateUpload(bucket: string, path: string) {
  try {
    const supabase = createAuthenticatedSupabaseClient()

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path.split("/").slice(0, -1).join("/"))

    if (error) {
      console.warn(`Validation failed for ${path}:`, error)
      return false
    }

    const fileName = path.split("/").pop()
    const fileExists = data?.some((file) => file.name === fileName)

    if (fileExists) {
      console.log(`✅ Upload validation successful for ${path}`)
      return true
    } else {
      console.warn(`❌ Upload validation failed - file not found: ${path}`)
      return false
    }
  } catch (error) {
    console.warn(`Validation error for ${path}:`, error)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    // Validate environment at the start
    validateEnvironment()

    const { selectedAssets, modelConfig } = await req.json()

    if (!selectedAssets || !Array.isArray(selectedAssets) || selectedAssets.length === 0) {
      return NextResponse.json({ error: "No assets selected" }, { status: 400 })
    }

    if (!modelConfig || !modelConfig.trigger_word) {
      return NextResponse.json(
        { error: "Model configuration missing trigger word" },
        { status: 400 }
      )
    }

    console.log(`🚀 Starting model generation with ${selectedAssets.length} assets`)
    console.log(`📦 Model config:`, modelConfig)

    // Create authenticated Supabase client
    const supabase = createAuthenticatedSupabaseClient()

    // Extract IP IDs and image URLs from selected assets
    const ipIds: string[] = []
    const imageUrls: string[] = []

    for (const asset of selectedAssets) {
      if (asset.ipId) {
        ipIds.push(asset.ipId)
      }
      if (asset.src) {
        imageUrls.push(asset.src)
      }
    }

    if (ipIds.length === 0) {
      return NextResponse.json(
        { error: "No valid IP IDs found in selected assets" },
        { status: 400 }
      )
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "No valid image URLs found in selected assets" },
        { status: 400 }
      )
    }

    // Check minimum images requirement
    if (imageUrls.length < 5) {
      return NextResponse.json(
        { error: "At least 5 images are required for training." },
        { status: 400 }
      )
    }

    console.log(`🔐 Found ${ipIds.length} IP IDs and ${imageUrls.length} image URLs`)

    // Create training job record first
    const { data: trainingJob, error: dbError } = await supabase
      .from("training_jobs")
      .insert({
        trigger_word: modelConfig.trigger_word,
        description: modelConfig.description || null,
        training_steps: parseInt(modelConfig.training_steps) || 300,
        captioning: "automatic",
        status: "pending",
        story_parent_ip_ids: ipIds, // Store the parent IP IDs
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json(
        { error: `Failed to create training job: ${dbError.message}` },
        { status: 500 }
      )
    }

    const trainingJobId = trainingJob.id
    console.log(`✅ Training job created: ${trainingJobId}`)

    // Download and process images like working implementation
    const imageData: { name: string; buffer: ArrayBuffer }[] = []

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i]
      const asset = selectedAssets[i]

      try {
        console.log(`📤 Downloading image ${i + 1}/${imageUrls.length}: ${imageUrl}`)

        const response = await fetch(imageUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; EssenceWebApp/1.0)",
          },
        })

        if (!response.ok) {
          console.error(`Failed to download image: ${imageUrl} (${response.status})`)
          continue
        }

        const imageBuffer = await response.arrayBuffer()
        const cleanName = (asset.name || `image_${i + 1}`)
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .substring(0, 100)

        imageData.push({
          name: cleanName,
          buffer: imageBuffer,
        })

        console.log(`✅ Downloaded: ${cleanName} (${Math.round(imageBuffer.byteLength / 1024)}KB)`)
      } catch (error) {
        console.error(`Error downloading image ${imageUrl}:`, error)
        continue
      }
    }

    if (imageData.length === 0) {
      return NextResponse.json(
        { error: "Failed to download any images. Please check image URLs." },
        { status: 400 }
      )
    }

    if (imageData.length < 5) {
      return NextResponse.json(
        {
          error: `Only ${imageData.length} images downloaded successfully. At least 5 required.`,
        },
        { status: 400 }
      )
    }

    console.log(`✅ Successfully downloaded ${imageData.length} images`)

    // Create ZIP file exactly like working implementation
    console.log(`📦 Creating ZIP archive from ${imageData.length} images...`)

    const JSZip = (await import("jszip")).default as any
    const zip = new JSZip()

    // Add each image to the zip with clean naming
    for (let i = 0; i < imageData.length; i++) {
      const { name, buffer } = imageData[i]
      const fileName = `image_${String(i + 1).padStart(3, "0")}_${name}.jpg`
      zip.file(fileName, buffer)
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" })
    const zipSizeMB = Math.round(zipBuffer.byteLength / 1024 / 1024)
    console.log(`📦 Generated ZIP file: ${zipSizeMB}MB`)

    // Generate unique filename for the zip
    const uniqueId = uuidv4()
    const zipFileName = `training-dataset-${uniqueId}.zip`
    const storagePath = `public/${zipFileName}`

    console.log(`💾 Uploading ZIP to storage: ${storagePath}`)

    // Upload zip to Supabase Storage with enhanced error handling
    const zipUploadResult = await uploadLargeFile(
      "models",
      storagePath,
      zipBuffer,
      "application/zip"
    )

    if (!zipUploadResult.success) {
      console.error("❌ Primary ZIP upload failed:", zipUploadResult.error)

      // Try alternative ZIP upload strategy
      console.log(`🔄 Trying alternative ZIP upload strategy...`)
      const altZipPath = `public/alt_${zipFileName}`
      const altZipResult = await uploadToSupabaseRobust(
        "models",
        altZipPath,
        zipBuffer,
        "application/zip",
        5
      )

      if (!altZipResult.success) {
        return NextResponse.json(
          {
            error:
              "Failed to upload training dataset ZIP file after multiple attempts. Please try again.",
          },
          { status: 500 }
        )
      }

      console.log(`✅ Alternative ZIP upload successful`)
    }

    // Validate ZIP upload
    const finalZipPath = zipUploadResult.success ? storagePath : `public/alt_${zipFileName}`
    const zipValidated = await validateUpload("models", finalZipPath)

    if (!zipValidated) {
      console.warn(`⚠️ ZIP upload validation failed, but continuing...`)
    }

    // Get public URL for ZIP
    const { data: urlData } = supabase.storage.from("models").getPublicUrl(finalZipPath)

    // Update training job with input images URL
    console.log(`💾 Updating training job with ZIP URL...`)
    const { error: updateError } = await supabase
      .from("training_jobs")
      .update({
        input_images_url: urlData.publicUrl,
      })
      .eq("id", trainingJobId)

    if (updateError) {
      console.error("Error updating training job:", updateError)
      return NextResponse.json({ error: "Failed to update training job" }, { status: 500 })
    }

    // Start Replicate training using SDK like working implementation
    console.log(`🚀 Starting Replicate training...`)

    try {
      // Initialize Replicate client
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN!,
      })

      // Determine webhook URL
      let webhookUrl: string
      const tunnelUrl = process.env.REPLICATE_WEBHOOK_TUNNEL_URL
      if (process.env.NODE_ENV === "development" && tunnelUrl) {
        console.log("Using tunnel URL:", tunnelUrl)
        webhookUrl = `${tunnelUrl}/api/replicate-webhook`
      } else {
        console.log("Using webhook host:", process.env.WEBHOOK_HOST)
        webhookUrl = `${process.env.WEBHOOK_HOST}/api/replicate-webhook`
      }

      console.log(`🔗 Using webhook URL: ${webhookUrl}`)

      // Prepare training input data matching working implementation
      const trainingInput = {
        input_images: urlData.publicUrl,
        trigger_word: modelConfig.trigger_word || "TOK",
        training_steps: parseInt(modelConfig.training_steps) || 300,
        captioning: "automatic",
        mode: "style" as const,
        lora_rank: 16,
        finetune_type: "lora" as const,
      }

      console.log(`📋 Submitting to Replicate with input:`, trainingInput)

      // Submit to Replicate using predictions API like working implementation
      const prediction = await replicate.predictions.create({
        model: "black-forest-labs/flux-pro-trainer",
        input: trainingInput,
        webhook: webhookUrl,
        webhook_events_filter: ["start", "output", "logs", "completed"],
      })

      console.log(`✅ Replicate prediction created: ${prediction.id}`)

      // Update training job with Replicate information
      const { error: replicateUpdateError } = await supabase
        .from("training_jobs")
        .update({
          replicate_job_id: prediction.id,
          status: prediction.status, // Use the status returned by Replicate
        })
        .eq("id", trainingJobId)

      if (replicateUpdateError) {
        console.error("Error updating training job with Replicate ID:", replicateUpdateError)
      }

      console.log(`🎉 Model generation completed successfully!`)
      console.log(`📊 Summary:`)
      console.log(`   - Images processed: ${imageData.length}`)
      console.log(`   - Parent IP assets: ${ipIds.length}`)
      console.log(`   - ZIP created: ${zipSizeMB}MB`)
      console.log(`   - Replicate prediction ID: ${prediction.id}`)
      console.log(`   - Status: preparing → ${prediction.status}`)

      return NextResponse.json({
        success: true,
        message: "Model training started successfully",
        trainingJobId,
        replicateJobId: prediction.id,
        zipUrl: urlData.publicUrl,
        imageCount: imageData.length,
        ipIds: ipIds,
        status: prediction.status,
      })
    } catch (error) {
      console.error("Error starting Replicate training:", error)

      // Update status to indicate Replicate failure
      await supabase
        .from("training_jobs")
        .update({
          error_message: `Failed to start Replicate training: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        })
        .eq("id", trainingJobId)

      return NextResponse.json(
        {
          error: "Failed to start training",
          details: error instanceof Error ? error.message : "Unknown error occurred",
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Model generation process error:", error)
    return NextResponse.json(
      {
        error: "Model generation failed",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}
