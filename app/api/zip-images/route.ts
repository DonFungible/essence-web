import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"
import {
  mintAndRegisterIP,
  isStoryConfigured,
  getSPGNftContract,
  registerDerivativeIP,
} from "@/lib/story-protocol"

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

    const formData = await req.formData()
    const files = formData.getAll("images") as File[]
    const trainingJobId = formData.get("trainingJobId") as string

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 })
    }

    if (!trainingJobId) {
      return NextResponse.json({ error: "Training job ID is required" }, { status: 400 })
    }

    // Validate all files are images
    const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    for (const file of files) {
      if (!validImageTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only JPG, PNG, WEBP, and GIF are allowed.` },
          { status: 400 }
        )
      }
      if (file.size > 10 * 1024 * 1024) {
        // 10MB per image
        return NextResponse.json(
          { error: `Image ${file.name} is too large. Maximum size is 10MB per image.` },
          { status: 400 }
        )
      }
    }

    // Check minimum images requirement
    if (files.length < 5) {
      return NextResponse.json(
        { error: "At least 5 images are required for training." },
        { status: 400 }
      )
    }

    // Check total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > 500 * 1024 * 1024) {
      // 500MB total
      return NextResponse.json({ error: "Total images size exceeds 500MB limit." }, { status: 400 })
    }

    console.log(`🚀 Starting training process for job ${trainingJobId}`)
    console.log(
      `📦 Processing ${files.length} images (${Math.round(totalSize / 1024 / 1024)}MB total)`
    )

    // Create authenticated Supabase client
    const supabase = createAuthenticatedSupabaseClient()

    // Check the training job's IP registration method
    const { data: trainingJob, error: jobError } = await supabase
      .from("training_jobs")
      .select("ip_registration_method")
      .eq("id", trainingJobId)
      .single()

    if (jobError) {
      console.error("Error fetching training job:", jobError)
      return NextResponse.json({ error: "Training job not found" }, { status: 404 })
    }

    const ipMethod = trainingJob?.ip_registration_method || "backend"
    const shouldRegisterIP = ipMethod === "backend" && isStoryConfigured()

    console.log(`🔐 IP Registration method: ${ipMethod}`)
    console.log(`📋 Story Protocol configured: ${isStoryConfigured()}`)

    // Step 1-5: Upload images to Supabase and register as IP assets
    const imageRecords: any[] = []
    const parentIpIds: string[] = []
    let spgContract = ""

    if (shouldRegisterIP) {
      spgContract = getSPGNftContract()
      console.log(`🔐 Using Story Protocol with contract: ${spgContract}`)
    }

    // Process images with enhanced error handling and progress tracking
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        console.log(
          `\n📤 Step ${i + 1}/${files.length}: Processing ${file.name} (${Math.round(
            file.size / 1024
          )}KB)`
        )

        const arrayBuffer = await file.arrayBuffer()

        // Generate clean filename for storage
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
        const timestamp = Date.now()
        const storageFileName = `${timestamp}_${i + 1}_${cleanName}`
        const storagePath = `training-images/${trainingJobId}/${storageFileName}`

        // Upload to assets bucket with robust error handling
        console.log(`💾 Uploading to storage...`)
        const uploadResult = await uploadLargeFile("assets", storagePath, arrayBuffer, file.type)

        if (!uploadResult.success) {
          console.error(`❌ Primary upload failed for ${file.name}:`, uploadResult.error)

          // Try alternative approach with different path
          console.log(`🔄 Trying alternative upload strategy...`)
          const alternativePath = `training-images/${trainingJobId}/alt_${timestamp}_${
            i + 1
          }_${cleanName}`
          const alternativeResult = await uploadToSupabaseRobust(
            "assets",
            alternativePath,
            arrayBuffer,
            file.type,
            3
          )

          if (!alternativeResult.success) {
            return NextResponse.json(
              {
                error: `Failed to upload image ${file.name} after multiple attempts. Please check your network connection and try again.`,
                details: `Upload failed for image ${i + 1} of ${files.length}`,
              },
              { status: 500 }
            )
          }

          console.log(`✅ Alternative upload successful for ${file.name}`)
        }

        // Determine final path and validate upload
        const finalPath = uploadResult.success
          ? storagePath
          : `training-images/${trainingJobId}/alt_${timestamp}_${i + 1}_${cleanName}`

        // Validate upload success
        const isValidated = await validateUpload("assets", finalPath)
        if (!isValidated) {
          console.warn(`⚠️ Upload validation failed for ${file.name}, but continuing...`)
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from("assets").getPublicUrl(finalPath)

        let ipId = null
        let tokenId = null
        let txHash = null
        let registrationStatus = "pending"

        // Step 3: Register image as IP asset if using backend method
        if (shouldRegisterIP) {
          console.log(`🔐 Registering IP asset on Story Protocol...`)

          try {
            const metadata = {
              title: `Training Image: ${file.name}`,
              description: `Training image used for AI model development. Original filename: ${file.name}`,
              ipType: "image" as const,
              attributes: [
                {
                  trait_type: "File Type",
                  value: file.type,
                },
                {
                  trait_type: "File Size",
                  value: `${Math.round(file.size / 1024)} KB`,
                },
                {
                  trait_type: "Training Job ID",
                  value: trainingJobId,
                },
                {
                  trait_type: "Upload Order",
                  value: (i + 1).toString(),
                },
              ],
            }

            const ipResult = await mintAndRegisterIP({
              spgNftContract: spgContract,
              metadata,
            })

            if (ipResult.success) {
              ipId = ipResult.ipId
              tokenId = ipResult.tokenId?.toString()
              txHash = ipResult.txHash
              registrationStatus = "registered"
              parentIpIds.push(ipResult.ipId!)
              console.log(`✅ IP registered successfully: ${ipResult.ipId}`)
            } else {
              console.error(`❌ Failed to register IP:`, ipResult.error)
              registrationStatus = "failed"
            }
          } catch (error) {
            console.error(`❌ Exception during IP registration:`, error)
            registrationStatus = "failed"
          }

          // Add delay between registrations to prevent overwhelming the network
          if (i < files.length - 1) {
            console.log(`⏳ Waiting 3 seconds before next registration...`)
            await new Promise((resolve) => setTimeout(resolve, 3000))
          }
        }

        // Record image in database
        const imageRecord = {
          training_job_id: trainingJobId,
          original_filename: file.name,
          file_size: file.size,
          content_type: file.type,
          supabase_storage_path: finalPath,
          supabase_public_url: urlData.publicUrl,
          display_order: i,
          story_registration_status: registrationStatus,
          story_ip_id: ipId,
          story_nft_contract: shouldRegisterIP ? spgContract : null,
          story_token_id: tokenId,
          story_tx_hash: txHash,
        }

        imageRecords.push(imageRecord)
        console.log(`✅ Image ${i + 1}/${files.length} processed successfully`)

        // Brief pause between images
        if (i < files.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`❌ Failed to process image ${file.name}:`, error)
        return NextResponse.json(
          {
            error: `Failed to process image ${file.name}. Please try again.`,
            details: `Error occurred on image ${i + 1} of ${files.length}`,
          },
          { status: 500 }
        )
      }
    }

    // Bulk insert image records
    console.log(`\n💾 Saving ${imageRecords.length} image records to database...`)
    const { data: insertedRecords, error: dbError } = await supabase
      .from("training_images")
      .insert(imageRecords)
      .select()

    if (dbError) {
      console.error("Error inserting training images:", dbError)
      return NextResponse.json({ error: "Failed to save image records" }, { status: 500 })
    }

    console.log(`✅ Successfully saved ${imageRecords.length} image records`)

    // Step 6: Create ZIP file
    console.log(`\n📦 Creating ZIP archive from ${files.length} images...`)

    const JSZip = (await import("jszip")).default as any
    const zip = new JSZip()

    // Add each image to the zip with clean naming
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const arrayBuffer = await file.arrayBuffer()
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const fileName = `image_${String(i + 1).padStart(3, "0")}_${cleanName}`
      zip.file(fileName, arrayBuffer)
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

    // Step 8: Update training job with parent IP relationships
    console.log(`\n💾 Updating training job with parent IP relationships...`)

    const updateData: any = {}

    // Store parent IP IDs for later derivative registration (when model training completes)
    if (parentIpIds.length > 0) {
      updateData.story_parent_ip_ids = parentIpIds
    }

    // Only update if we have data to update
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("training_jobs")
        .update(updateData)
        .eq("id", trainingJobId)

      if (updateError) {
        console.error("Error updating training job:", updateError)
        return NextResponse.json({ error: "Failed to update training job" }, { status: 500 })
      }

      console.log(`✅ Updated training job with ${parentIpIds.length} parent IP IDs`)
    } else {
      console.log(`📝 No parent IP relationships to store for training job ${trainingJobId}`)
    }

    // Step 9: Start Replicate training
    console.log(`\n🚀 Starting Replicate training...`)

    try {
      const replicateResponse = await fetch("https://api.replicate.com/v1/trainings", {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
          input: {
            input_images: urlData.publicUrl,
          },
          destination: `${process.env.REPLICATE_USERNAME}/${trainingJobId}`,
          webhook: `${process.env.WEBHOOK_HOST}/api/replicate-webhook`,
          webhook_events_filter: ["start", "output", "logs", "completed"],
        }),
      })

      if (!replicateResponse.ok) {
        const errorText = await replicateResponse.text()
        console.error("Replicate API error:", errorText)
        throw new Error(`Replicate API error: ${replicateResponse.status}`)
      }

      const replicateData = await replicateResponse.json()
      console.log(`✅ Replicate training started: ${replicateData.id}`)

      // Update training job with Replicate information
      const { error: replicateUpdateError } = await supabase
        .from("training_jobs")
        .update({
          replicate_job_id: replicateData.id,
        })
        .eq("id", trainingJobId)

      if (replicateUpdateError) {
        console.error("Error updating training job with Replicate ID:", replicateUpdateError)
      }

      console.log(`🎉 Training process completed successfully!`)
      console.log(`📊 Summary:`)
      console.log(`   - Images processed: ${files.length}`)
      console.log(`   - IP assets registered: ${parentIpIds.length}`)
      console.log(`   - ZIP created: ${zipSizeMB}MB`)
      console.log(`   - Replicate training ID: ${replicateData.id}`)

      return NextResponse.json({
        success: true,
        message: "Training started successfully",
        trainingJobId,
        replicateJobId: replicateData.id,
        zipUrl: urlData.publicUrl,
        imageCount: files.length,
        ipAssetsRegistered: parentIpIds.length,
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
    console.error("Training process error:", error)
    return NextResponse.json(
      {
        error: "Training process failed",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}
