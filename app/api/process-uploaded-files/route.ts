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

    const { trainingJobId, uploadedFiles, zipFileInfo } = await req.json()

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
            const metadata = {
              title: `Training Image: ${fileInfo.originalName}`,
              description: `Training image used for AI model development. Original filename: ${fileInfo.originalName}`,
              ipType: "image" as const,
              attributes: [
                {
                  trait_type: "File Type",
                  value: fileInfo.contentType,
                },
              ],
            }
            console.log({ spgContract })
            const ipResult = await withRetry(async () => {
              return await mintAndRegisterIP({
                spgNftContract: spgContract,
                metadata,
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

    // Register ZIP as IP asset
    let zipIpId = null
    let zipTokenId = null
    let zipTxHash = null

    if (shouldRegisterIP) {
      console.log(`\n🔐 Registering ZIP as IP asset...`)

      try {
        const zipMetadata = {
          title: `Training Dataset ZIP: ${zipFileInfo.fileName}`,
          description: `Complete training dataset containing ${uploadedFiles.length} images for AI model development. This dataset combines multiple training images into a single archive.`,
          ipType: "model" as const,
          attributes: [
            {
              trait_type: "Dataset Type",
              value: "Training Images",
            },
            {
              trait_type: "Image Count",
              value: uploadedFiles.length.toString(),
            },
            {
              trait_type: "Training Job ID",
              value: trainingJobId,
            },
          ],
        }

        const zipIpResult = await withRetry(async () => {
          return await mintAndRegisterIP({
            spgNftContract: spgContract,
            metadata: zipMetadata,
          })
        })

        if (zipIpResult.success) {
          zipIpId = zipIpResult.ipId
          zipTokenId = zipIpResult.tokenId?.toString()
          zipTxHash = zipIpResult.txHash
          console.log(`✅ ZIP registered as IP asset: ${zipIpResult.ipId}`)
        } else {
          console.error(`❌ Failed to register ZIP as IP asset:`, zipIpResult.error)
        }
      } catch (error) {
        console.error(`❌ Exception during ZIP IP registration:`, error)
      }
    }

    // Update training job with ZIP information
    console.log(`\n💾 Updating training job with ZIP information...`)

    // Prepare update data with only core columns that should exist
    const updateData: any = {}

    // Try to add each column safely
    const columnsToTry = [
      { key: "zip_file_url", value: zipFileInfo.publicUrl },
      { key: "zip_file_path", value: zipFileInfo.storagePath },
      { key: "zip_file_size", value: zipFileInfo.fileSize },
      { key: "story_zip_ip_id", value: zipIpId },
      { key: "story_zip_token_id", value: zipTokenId },
      { key: "story_zip_tx_hash", value: zipTxHash },
      { key: "processing_status", value: "uploading_complete" },
    ]

    for (const column of columnsToTry) {
      if (column.value !== null && column.value !== undefined) {
        updateData[column.key] = column.value
      }
    }

    console.log("💾 Updating with available columns:", Object.keys(updateData))

    const { error: updateError } = await supabase
      .from("training_jobs")
      .update(updateData)
      .eq("id", trainingJobId)

    if (
      updateError &&
      updateError.message.includes("column") &&
      updateError.message.includes("does not exist")
    ) {
      console.log("⚠️ Some columns not available yet, updating with basic info only")

      // Fallback to minimal update
      const { error: fallbackError } = await supabase
        .from("training_jobs")
        .update({
          status: "preparing", // Use existing status column
        })
        .eq("id", trainingJobId)

      if (fallbackError) {
        console.error("❌ Failed to update training job:", fallbackError)
        return NextResponse.json({ error: "Failed to update training job" }, { status: 500 })
      }
    } else if (updateError) {
      console.error("❌ Error updating training job:", updateError)
      return NextResponse.json({ error: "Failed to update training job" }, { status: 500 })
    }

    // Start Replicate training using the correct API
    console.log(`\n🚀 Starting Replicate training...`)

    try {
      // Initialize Replicate SDK
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

      // Get the training job details for trigger word
      const { data: trainingJob, error: trainingJobError } = await supabase
        .from("training_jobs")
        .select("trigger_word")
        .eq("id", trainingJobId)
        .single()

      if (trainingJobError || !trainingJob) {
        throw new Error("Failed to get training job details")
      }

      // Determine webhook URL
      let webhookUrl: string
      const tunnelUrl = process.env.REPLICATE_WEBHOOK_TUNNEL_URL
      if (process.env.NODE_ENV === "development" && tunnelUrl) {
        webhookUrl = `${tunnelUrl}/api/replicate-webhook`
      } else {
        const host = process.env.WEBHOOK_HOST || process.env.VERCEL_URL
        if (!host) throw new Error("Could not determine host for webhook URL.")
        const protocol = host.startsWith("localhost") ? "http" : "https"
        webhookUrl = `${protocol}://${host}/api/replicate-webhook`
      }

      console.log(`🔗 Using webhook URL: ${webhookUrl}`)

      // Create prediction using the correct model and format
      const prediction = await replicate.predictions.create({
        model: "black-forest-labs/flux-pro-trainer",
        input: {
          input_images: zipFileInfo.publicUrl,
          trigger_word: trainingJob.trigger_word,
          captioning: "automatic",
          training_steps: 300,
          mode: "style",
          lora_rank: 16,
          finetune_type: "lora",
        },
        webhook: webhookUrl,
        webhook_events_filter: ["start", "output", "logs", "completed"],
      })

      console.log(`✅ Replicate training started: ${prediction.id}`)

      // Update training job with Replicate information
      const updateReplicateData: any = {
        replicate_job_id: prediction.id,
      }

      // Try to add processing_status if the column exists
      try {
        updateReplicateData.processing_status = "training"
      } catch (e) {
        console.log("⚠️ Processing status column not available")
      }

      const { error: replicateUpdateError } = await supabase
        .from("training_jobs")
        .update(updateReplicateData)
        .eq("id", trainingJobId)

      if (replicateUpdateError) {
        console.error("Error updating training job with Replicate ID:", replicateUpdateError)
      }

      console.log(`🎉 Training process completed successfully!`)
      console.log(`📊 Summary:`)
      console.log(`   - Images processed: ${uploadedFiles.length}`)
      console.log(`   - IP assets registered: ${parentIpIds.length}`)
      console.log(`   - ZIP IP registered: ${zipIpId ? "Yes" : "No"}`)
      console.log(`   - Replicate training ID: ${prediction.id}`)

      return NextResponse.json({
        success: true,
        message: "Training started successfully",
        trainingJobId,
        replicateJobId: prediction.id,
        zipUrl: zipFileInfo.publicUrl,
        imageCount: uploadedFiles.length,
        ipAssetsRegistered: parentIpIds.length,
        zipIpId,
      })
    } catch (error) {
      console.error("Error starting Replicate training:", error)

      // Update status to indicate Replicate failure
      const failureUpdateData: any = {
        error_message: `Failed to start Replicate training: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }

      // Try to add processing_status if the column exists
      try {
        failureUpdateData.processing_status = "failed"
      } catch (e) {
        console.log("⚠️ Processing status column not available")
      }

      await supabase.from("training_jobs").update(failureUpdateData).eq("id", trainingJobId)

      return NextResponse.json(
        {
          error: "Failed to start training",
          details: error instanceof Error ? error.message : "Unknown error occurred",
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("File processing error:", error)
    return NextResponse.json(
      {
        error: "File processing failed",
        details: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}
