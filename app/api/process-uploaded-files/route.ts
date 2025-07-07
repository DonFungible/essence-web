import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import Replicate from "replicate"
import {
  mintAndRegisterIP,
  mintAndRegisterIpWithPilTerms,
  isStoryConfigured,
  getSPGNftContract,
} from "@/lib/story-protocol"

// Validate environment variables
function validateEnvironment() {
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
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
            // Use PIL terms registration for training images to enable derivative relationships
            const ipResult = await withRetry(async () => {
              return await mintAndRegisterIpWithPilTerms({
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
              console.error(`❌ Failed to register IP!`, ipResult)
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
    console.log(
      `📝 IP Asset registration: Training images ✅, ZIP file ❌, Model (later via webhook) ✅`
    )

    // Update training job with processing completion
    console.log(`\n💾 Updating training job with parent IP relationships...`)

    // Prepare update data - only update parent IP relationships
    const updateData: any = {}

    // Store parent IP IDs for later derivative registration (when model training completes)
    if (parentIpIds.length > 0) {
      updateData.story_parent_ip_ids = parentIpIds
      console.log(`📝 Stored ${parentIpIds.length} parent IP IDs for future model registration`)
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

    // Step 4: Submit training to Replicate
    console.log(`\n🚀 Starting Replicate training submission...`)

    try {
      // Get the training job details for trigger word
      const { data: jobDetails, error: jobDetailsError } = await supabase
        .from("training_jobs")
        .select("trigger_word, training_steps, captioning")
        .eq("id", trainingJobId)
        .single()

      if (jobDetailsError || !jobDetails) {
        console.error("Error fetching training job details:", jobDetailsError)
        return NextResponse.json(
          { error: "Training job not found for submission" },
          { status: 404 }
        )
      }

      console.log(`📝 Training parameters:`, {
        trigger_word: jobDetails.trigger_word,
        training_steps: jobDetails.training_steps,
        captioning: jobDetails.captioning,
        input_images: zipFileInfo.publicUrl,
      })

      // Initialize Replicate client
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN!,
      })

      // Determine webhook URL
      let webhookUrl: string
      const tunnelUrl = process.env.REPLICATE_WEBHOOK_TUNNEL_URL
      webhookUrl = `${tunnelUrl}/api/replicate-webhook`

      console.log(`🔗 Using webhook URL: ${webhookUrl}`)

      // Prepare training input data
      const trainingInput = {
        input_images: zipFileInfo.publicUrl,
        trigger_word: jobDetails.trigger_word || "TOK",
        training_steps: jobDetails.training_steps || 300,
        captioning: jobDetails.captioning || "automatic",
        mode: "style" as const,
        lora_rank: 16,
        finetune_type: "lora" as const,
      }

      console.log(`📋 Submitting to Replicate with input:`, trainingInput)

      // Submit to Replicate using predictions API
      const prediction = await replicate.predictions.create({
        model: "black-forest-labs/flux-pro-trainer",
        input: trainingInput,
        webhook: webhookUrl,
        webhook_events_filter: ["start", "output", "logs", "completed"],
      })

      console.log(`✅ Replicate prediction created: ${prediction.id}`)

      // Update training job with Replicate information and change status to 'starting'
      const { error: replicateUpdateError } = await supabase
        .from("training_jobs")
        .update({
          replicate_job_id: prediction.id,
          status: prediction.status, // Use the status returned by Replicate
          input_images_url: zipFileInfo.publicUrl,
        })
        .eq("id", trainingJobId)

      if (replicateUpdateError) {
        console.error("Error updating training job with Replicate ID:", replicateUpdateError)
        return NextResponse.json(
          { error: "Failed to update training job with Replicate ID" },
          { status: 500 }
        )
      }

      console.log(`🎉 Training process completed successfully!`)
      console.log(`📊 Summary:`)
      console.log(`   - Images processed: ${uploadedFiles.length}`)
      console.log(`   - IP assets registered: ${parentIpIds.length}`)
      console.log(`   - Replicate prediction ID: ${prediction.id}`)
      console.log(`   - Status: preparing → ${prediction.status}`)

      return NextResponse.json({
        success: true,
        message: "Training started successfully",
        trainingJobId,
        replicateJobId: prediction.id,
        imageCount: uploadedFiles.length,
        ipAssetsRegistered: parentIpIds.length,
        status: prediction.status,
      })
    } catch (error) {
      console.error("Error starting Replicate training:", error)

      // Update status to indicate Replicate failure
      await supabase
        .from("training_jobs")
        .update({
          status: "failed",
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
    console.error("Process uploaded files error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
