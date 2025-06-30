import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import Replicate from "replicate"
import { mintAndRegisterIP, isStoryConfigured, getSPGNftContract } from "@/lib/story-protocol"

// Validate environment variables
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

// Create authenticated Supabase client
function createAuthenticatedSupabaseClient() {
  const env = validateEnvironment()

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Retry wrapper for Story Protocol operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      console.error(`[STORY] Attempt ${attempt}/${maxRetries} failed:`, error)

      if (attempt === maxRetries) {
        throw error
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay * attempt))
    }
  }
  throw new Error("Max retries exceeded")
}

export async function POST(req: NextRequest) {
  try {
    validateEnvironment()

    const { trainingJobId, uploadedFiles, zipFileInfo, metadata } = await req.json()

    if (!trainingJobId) {
      return NextResponse.json({ error: "Training job ID is required" }, { status: 400 })
    }

    if (!uploadedFiles || !Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
      return NextResponse.json({ error: "No uploaded files provided" }, { status: 400 })
    }

    if (!zipFileInfo) {
      return NextResponse.json({ error: "ZIP file information is required" }, { status: 400 })
    }

    console.log(
      `🚀 Processing ${uploadedFiles.length} uploaded files for training job ${trainingJobId}`
    )

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

    // Update training job status (only if column exists)
    try {
      await supabase
        .from("training_jobs")
        .update({ processing_status: "uploading_complete" })
        .eq("id", trainingJobId)
    } catch (error) {
      console.log("⚠️ Processing status column not available yet:", error)
    }

    // Process uploaded files and register as IP assets
    const imageRecords: any[] = []
    const parentIpIds: string[] = []
    let spgContract = ""

    if (shouldRegisterIP) {
      spgContract = getSPGNftContract()
      console.log(`🔐 Using Story Protocol with contract: ${spgContract}`)
    }

    // Process each uploaded file
    for (let i = 0; i < uploadedFiles.length; i++) {
      const fileInfo = uploadedFiles[i]

      try {
        console.log(
          `\n🔐 Step ${i + 1}/${uploadedFiles.length}: Processing ${fileInfo.originalName}`
        )

        let ipId = null
        let tokenId = null
        let txHash = null
        let registrationStatus = "pending"

        // Register image as IP asset if using backend method
        if (shouldRegisterIP) {
          console.log(`🔐 Registering IP asset on Story Protocol...`)

          try {
            // Get custom metadata if provided
            const customMeta = metadata?.[i]
            const nftName = customMeta?.name || fileInfo.originalName
            const nftDescription = customMeta?.description

            // Build metadata object
            const ipMetadata: any = {
              title: nftName,
              ipType: "image" as const,
              image: fileInfo.publicUrl,
              attributes: [
                {
                  trait_type: "File Type",
                  value: fileInfo.contentType,
                },
                {
                  trait_type: "Original Filename",
                  value: fileInfo.originalName,
                },
              ],
            }

            // Only include description if it exists and is not empty
            if (nftDescription && nftDescription.trim() !== "") {
              ipMetadata.description = nftDescription.trim()
            }
            console.log({ spgContract })
            const ipResult = await withRetry(async () => {
              return await mintAndRegisterIP({
                spgNftContract: spgContract,
                metadata: ipMetadata,
              })
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
          if (i < uploadedFiles.length - 1) {
            console.log(`⏳ Waiting 3 seconds before next registration...`)
            await new Promise((resolve) => setTimeout(resolve, 3000))
          }
        }

        // Record image in database
        const imageRecord = {
          training_job_id: trainingJobId,
          original_filename: fileInfo.originalName,
          file_size: fileInfo.fileSize,
          content_type: fileInfo.contentType,
          supabase_storage_path: fileInfo.storagePath,
          supabase_public_url: fileInfo.publicUrl,
          display_order: i,
          story_registration_status: registrationStatus,
          story_ip_id: ipId,
          story_nft_contract: shouldRegisterIP ? spgContract : null,
          story_token_id: tokenId,
          story_tx_hash: txHash,
        }

        imageRecords.push(imageRecord)
        console.log(`✅ Image ${i + 1}/${uploadedFiles.length} processed successfully`)
      } catch (error) {
        console.error(`❌ Failed to process image ${fileInfo.originalName}:`, error)
        return NextResponse.json(
          {
            error: `Failed to process image ${fileInfo.originalName}. Please try again.`,
            details: `Error occurred on image ${i + 1} of ${uploadedFiles.length}`,
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

    // ZIP file creation and upload - NO IP REGISTRATION
    // Per Story Protocol best practices: ZIP files are just containers, not IP assets
    // Only individual training images and the final trained model are registered as IP assets
    console.log(`\n📦 Note: ZIP file is created for training purposes only`)
    console.log(`📝 IP Asset registration: Training images ✅, ZIP file ❌, Model (later via webhook) ✅`)

    // Update training job with processing completion
    console.log(`\n💾 Updating training job with processing status...`)

    // Prepare update data - only update processing status and parent IP relationships
    const updateData: any = {
      processing_status: "uploading_complete",
    }

    // Store parent IP IDs for later derivative registration (when model training completes)
    if (parentIpIds.length > 0) {
      updateData.story_parent_ip_ids = parentIpIds
      console.log(`📝 Stored ${parentIpIds.length} parent IP IDs for future model registration`)
    }

    const { error: updateError } = await supabase
      .from("training_jobs")
      .update(updateData)
      .eq("id", trainingJobId)

    if (updateError) {
      console.error("Error updating training job:", updateError)
      return NextResponse.json({ error: "Failed to update training job" }, { status: 500 })
    }

    console.log(`✅ Updated training job ${trainingJobId} - ready for training`)

    return NextResponse.json({
      success: true,
      message: "Files processed and training images registered as IP assets",
      processedImages: imageRecords.length,
      registeredIPs: parentIpIds.length,
      parentIpIds: parentIpIds,
      note: "ZIP file created but not registered as IP asset - only training images and final model are IP assets",
    })
  } catch (error) {
    console.error("Process uploaded files error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
