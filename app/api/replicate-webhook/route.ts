import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { mintAndRegisterIP, isStoryConfigured, getSPGNftContract } from "@/lib/story-protocol"

// Import the extraction function directly
async function extractStyleImages(
  zipUrl: string,
  triggerWord: string,
  maxImages: number = 4,
  jobId?: string
) {
  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if we already have images for this trigger word
    console.log(`🔍 Checking for existing style images in assets/${triggerWord}/`)
    const { data: existingFiles } = await supabaseAdmin.storage
      .from("assets")
      .list(triggerWord, { limit: maxImages })

    if (existingFiles && existingFiles.length >= maxImages) {
      console.log(`✅ Found ${existingFiles.length} existing style images, skipping extraction`)

      // Return existing images info
      const existingImages = existingFiles.slice(0, maxImages).map((file) => {
        const { data: urlData } = supabaseAdmin.storage
          .from("assets")
          .getPublicUrl(`${triggerWord}/${file.name}`)

        return {
          originalFilename: file.name,
          storagePath: `${triggerWord}/${file.name}`,
          publicUrl: urlData.publicUrl,
          size: file.metadata?.size || 0,
          existing: true,
        }
      })

      return {
        success: true,
        uploadedImages: existingImages,
        fromCache: true,
      }
    }

    console.log(`📥 Downloading and extracting from zip: ${zipUrl}`)

    // Download the zip file
    const response = await fetch(zipUrl)
    if (!response.ok) {
      throw new Error(`Failed to download zip: ${response.status} ${response.statusText}`)
    }

    const zipBuffer = await response.arrayBuffer()
    const zipSizeMB = Math.round(zipBuffer.byteLength / 1024 / 1024)
    console.log(`📦 Downloaded zip file: ${zipSizeMB}MB`)

    // Dynamically import JSZip to avoid bundle issues
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    const zipContents = await zip.loadAsync(zipBuffer)

    // Find image files in the zip (exclude system files)
    const allFiles = Object.keys(zipContents.files)
    const imageFiles = allFiles.filter((filename) => {
      const file = zipContents.files[filename]
      return (
        !file.dir && // Not a directory
        !filename.startsWith("__MACOSX/") && // Skip Mac metadata
        !filename.startsWith(".") && // Skip hidden files
        !filename.includes("/.") && // Skip hidden files in subdirs
        /\.(jpg|jpeg|png|webp|gif)$/i.test(filename)
      ) // Image extensions
    })

    console.log(`🖼️ Found ${imageFiles.length} image files in zip`)

    if (imageFiles.length === 0) {
      return {
        success: false,
        error: "No image files found in zip archive",
      }
    }

    // Select up to maxImages, prefer files with good names (avoid weird system files)
    const selectedFiles = imageFiles
      .filter((filename) => {
        // Prefer files with reasonable names and sizes
        const nameCheck = !/^(thumb|icon|preview|\.)/i.test(filename.split("/").pop() || "")
        return nameCheck
      })
      .slice(0, maxImages)

    // If we filtered too aggressively, fall back to first maxImages files
    const filesToProcess = selectedFiles.length > 0 ? selectedFiles : imageFiles.slice(0, maxImages)

    console.log(`📤 Processing ${filesToProcess.length} selected images`)

    // Extract and upload each selected image
    const uploadPromises = filesToProcess.map(async (filename, index) => {
      try {
        console.log(`📤 Processing image ${index + 1}/${filesToProcess.length}: ${filename}`)

        // Extract image data
        const imageData = await zipContents.files[filename].async("arraybuffer")

        // Determine content type from file extension
        const extension = filename.split(".").pop()?.toLowerCase()
        let contentType = "image/jpeg"
        if (extension === "png") contentType = "image/png"
        else if (extension === "webp") contentType = "image/webp"
        else if (extension === "gif") contentType = "image/gif"

        // Generate clean storage filename
        const originalName = filename.split("/").pop() || filename // Get just filename, no path
        const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_") // Clean special chars
        const timestamp = Date.now()
        const finalFilename = `${timestamp}-${sanitizedName}`
        const storagePath = `${triggerWord}/${finalFilename}`

        console.log(`💾 Uploading to: assets/${storagePath}`)

        // Upload to Supabase Storage (assets bucket)
        const { error: uploadError, data: uploadData } = await supabaseAdmin.storage
          .from("assets")
          .upload(storagePath, imageData, {
            contentType,
            upsert: false,
          })

        if (uploadError) {
          console.error(`❌ Upload failed for ${filename}:`, uploadError)
          return null
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage.from("assets").getPublicUrl(storagePath)

        console.log(`✅ Uploaded: ${originalName} -> assets/${storagePath}`)

        return {
          originalFilename: originalName,
          storagePath: storagePath,
          publicUrl: urlData.publicUrl,
          contentType: contentType,
          size: imageData.byteLength,
        }
      } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error)
        return null
      }
    })

    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises)
    const successfulUploads = results.filter((result) => result !== null)

    console.log(
      `✅ Successfully uploaded ${successfulUploads.length}/${filesToProcess.length} style images`
    )

    if (successfulUploads.length === 0) {
      return {
        success: false,
        error: "Failed to upload any images",
      }
    }

    // Update database with extraction results
    if (jobId && successfulUploads.length > 0) {
      try {
        await supabaseAdmin
          .from("training_jobs")
          .update({
            style_images_extracted: true,
            style_images_count: successfulUploads.length,
            style_images_storage_path: `assets/${triggerWord}/`,
            style_images_extracted_at: new Date().toISOString(),
          })
          .eq("replicate_job_id", jobId)

        console.log(`📝 Updated training job ${jobId} with style image extraction results`)
      } catch (updateError) {
        console.error("⚠️ Failed to update training job with extraction results:", updateError)
      }
    }

    return {
      success: true,
      uploadedImages: successfulUploads,
      totalProcessed: filesToProcess.length,
      totalFound: imageFiles.length,
      fromCache: false,
    }
  } catch (error: any) {
    console.error("❌ Error extracting style images:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

export async function POST(req: NextRequest) {
  // Use service role key for webhooks (no user session needed)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  console.log("🔓 Processing webhook without signature verification (internal/local use)")

  // Parse the request body
  let body: any
  try {
    body = await req.json()
  } catch (error) {
    console.error("❌ Error parsing webhook body:", error)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  console.log("📨 Received Replicate webhook:", {
    id: body.id,
    status: body.status,
    hasOutput: !!body.output,
    hasError: !!body.error,
    hasLogs: !!body.logs,
  })

  const {
    id: replicateJobId,
    status,
    output,
    error: replicateError,
    logs,
    metrics,
    input,
    completed_at,
    started_at,
  } = body

  if (!replicateJobId) {
    console.error("❌ Webhook missing Replicate Job ID")
    console.log("Webhook body structure:", Object.keys(body))
    return NextResponse.json({ error: "Missing Replicate Job ID" }, { status: 400 })
  }

  console.log(`🔄 Processing webhook for job ${replicateJobId} with status: ${status}`)

  try {
    // Prepare the base data for insert/update
    const jobData: any = {
      replicate_job_id: replicateJobId,
      status: status,
      logs: logs ? (typeof logs === "string" ? logs : JSON.stringify(logs)) : null,
    }

    // Add timing data if available
    if (completed_at) {
      jobData.completed_at = completed_at
    }
    if (started_at) {
      jobData.started_at = started_at
    }
    if (metrics) {
      if (metrics.predict_time) {
        jobData.predict_time = metrics.predict_time
      }
      if (metrics.total_time) {
        jobData.total_time = metrics.total_time
      }
    }

    // Handle different status types and add relevant data
    if (status === "succeeded" && output) {
      jobData.output_model_url = Array.isArray(output) ? output.join("\n") : String(output)

      // Store training input parameters for successful jobs
      if (input) {
        jobData.input_images_url = input.input_images || null
        jobData.trigger_word = input.trigger_word || null
        jobData.captioning = input.captioning || null
        jobData.training_steps = input.steps || input.training_steps || null

        console.log(`✅ Job ${replicateJobId} succeeded with output and training inputs:`, {
          trigger_word: input.trigger_word,
          input_images: input.input_images,
          captioning: input.captioning,
          steps: input.steps || input.training_steps,
        })

        // Extract style images for visual reference (non-blocking)
        if (input.input_images && input.trigger_word) {
          console.log(`🖼️ Starting style image extraction for trigger word: ${input.trigger_word}`)

          // Call extraction function directly instead of making HTTP request
          extractStyleImages(input.input_images, input.trigger_word, 4, replicateJobId)
            .then((result) => {
              if (result.success) {
                console.log(
                  `✅ Style image extraction completed for ${input.trigger_word}: ${
                    result.uploadedImages?.length || 0
                  } images`
                )
              } else {
                console.error(
                  `⚠️ Style image extraction failed for ${input.trigger_word}:`,
                  result.error
                )
              }
            })
            .catch((error) => {
              console.error(`⚠️ Style image extraction error for ${input.trigger_word}:`, error)
            })
        }

        // Register trained model as IP asset on Story Protocol (non-blocking)
        if (isStoryConfigured() && input.trigger_word) {
          console.log(`📝 Starting Story Protocol registration for model: ${input.trigger_word}`)

          registerTrainedModelAsIP(replicateJobId, input.trigger_word, output).catch(
            (error: any) => {
              console.error(
                `⚠️ Story Protocol registration error for ${input.trigger_word}:`,
                error
              )
            }
          )
        }
      } else {
        console.log(`✅ Job ${replicateJobId} succeeded with output (no input data in webhook)`)
      }
    } else if (status === "failed" && replicateError) {
      jobData.error_message =
        typeof replicateError === "string" ? replicateError : JSON.stringify(replicateError)
      console.log(`❌ Job ${replicateJobId} failed:`, replicateError)
    } else if (status === "processing") {
      console.log(`⏳ Job ${replicateJobId} is processing...`)
    } else if (status === "starting") {
      console.log(`🚀 Job ${replicateJobId} is starting...`)
    }

    let jobRecord: any
    let action: string

    if (status === "starting") {
      // First webhook: CREATE new record
      console.log(`📝 Creating new database record for job ${replicateJobId} (starting)`)

      // Add additional fields for new records
      jobData.input_parameters = {
        created_via_webhook: true,
        initial_status: status,
        created_at: new Date().toISOString(),
      }
      jobData.user_id = null

      // Use upsert to handle potential race conditions
      const { data: newJob, error: createError } = await supabase
        .from("training_jobs")
        .upsert(jobData, {
          onConflict: "replicate_job_id",
          ignoreDuplicates: false,
        })
        .select()
        .single()

      if (createError) {
        console.error(`❌ Database error creating job ${replicateJobId}:`, createError)
        return NextResponse.json({ error: "Database creation failed" }, { status: 500 })
      }

      jobRecord = newJob
      action = "created"
      console.log(`✅ Created database record for job ${replicateJobId}`)
    } else {
      // Subsequent webhooks: UPDATE existing record
      console.log(`📝 Updating existing database record for job ${replicateJobId} (${status})`)

      // Check current status to prevent duplicate processing webhooks
      const { data: currentJob, error: fetchError } = await supabase
        .from("training_jobs")
        .select("status")
        .eq("replicate_job_id", replicateJobId)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error(`❌ Error fetching current status for job ${replicateJobId}:`, fetchError)
        return NextResponse.json({ error: "Database fetch failed" }, { status: 500 })
      }

      // Ignore duplicate "processing" webhooks - only process the first one
      if (currentJob && currentJob.status === "processing" && status === "processing") {
        console.log(`⚠️ Ignoring duplicate processing webhook for job ${replicateJobId}`)
        return NextResponse.json(
          {
            message: "Ignored duplicate processing webhook",
            jobId: replicateJobId,
            currentStatus: currentJob.status,
            attemptedStatus: status,
            action: "ignored",
          },
          { status: 200 }
        )
      }

      // Also ignore any webhooks that try to go back to processing from final states
      const finalStates = ["succeeded", "failed", "canceled"]
      if (currentJob && finalStates.includes(currentJob.status) && status === "processing") {
        console.log(
          `⚠️ Ignoring processing webhook after final state for job ${replicateJobId}: ${currentJob.status} -> ${status}`
        )
        return NextResponse.json(
          {
            message: "Ignored processing webhook after final state",
            jobId: replicateJobId,
            currentStatus: currentJob.status,
            attemptedStatus: status,
            action: "ignored",
          },
          { status: 200 }
        )
      }

      const { data: updatedJob, error: updateError } = await supabase
        .from("training_jobs")
        .update(jobData)
        .eq("replicate_job_id", replicateJobId)
        .select()
        .single()

      if (updateError) {
        console.error(`❌ Database error updating job ${replicateJobId}:`, updateError)

        // If update fails because record doesn't exist, create it
        if (updateError.code === "PGRST116") {
          console.log(`🔄 Record not found, creating new record for job ${replicateJobId}`)

          jobData.input_parameters = {
            created_via_webhook: true,
            initial_status: status,
            created_at: new Date().toISOString(),
            created_on_missing_record: true,
          }
          jobData.user_id = null

          const { data: newJob, error: createError } = await supabase
            .from("training_jobs")
            .insert(jobData)
            .select()
            .single()

          if (createError) {
            console.error(`❌ Database error creating missing job ${replicateJobId}:`, createError)
            return NextResponse.json({ error: "Database creation failed" }, { status: 500 })
          }

          jobRecord = newJob
          action = "created (missing record)"
          console.log(`✅ Created missing database record for job ${replicateJobId}`)
        } else {
          return NextResponse.json({ error: "Database update failed" }, { status: 500 })
        }
      } else {
        jobRecord = updatedJob
        action = "updated"
        console.log(`✅ Updated database record for job ${replicateJobId}`)
      }
    }

    console.log(
      `✅ Successfully processed webhook for job ${replicateJobId} with status: ${status}`
    )
    return NextResponse.json(
      {
        message: "Webhook received and processed successfully",
        jobId: replicateJobId,
        status: status,
        action: action,
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error(`💥 Unexpected error processing webhook for job ${replicateJobId}:`, err)
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    })
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 }
    )
  }
}

// Background function to register trained model as IP asset and derivative
async function registerTrainedModelAsIP(
  replicateJobId: string,
  triggerWord: string,
  modelOutput: any
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  try {
    console.log(`📝 Registering trained model as IP for job: ${replicateJobId}`)

    // Get training job details and associated training images
    const { data: trainingJob, error: jobError } = await supabase
      .from("training_jobs")
      .select(
        `
        *,
        training_images (
          id,
          story_ip_id,
          story_registration_status,
          original_filename
        )
      `
      )
      .eq("replicate_job_id", replicateJobId)
      .single()

    if (jobError || !trainingJob) {
      console.error(`❌ Could not find training job: ${replicateJobId}`, jobError)
      return
    }

    // Get registered training image IP assets
    const registeredImageIPs =
      trainingJob.training_images
        ?.filter((img: any) => img.story_ip_id && img.story_registration_status === "registered")
        ?.map((img: any) => img.story_ip_id) || []

    console.log(`Found ${registeredImageIPs.length} registered training image IPs`)

    // Create metadata for the trained model
    const modelMetadata = {
      title: `AI Model: ${triggerWord}`,
      description: `AI model trained on ${
        trainingJob.training_images?.length || 0
      } images. Trigger word: ${triggerWord}. Generated using ${
        trainingJob.captioning || "automatic"
      } captioning with ${trainingJob.training_steps || 300} training steps.`,
      ipType: "model" as const,
      attributes: [
        {
          trait_type: "Model Type",
          value: "AI Training Model",
        },
        {
          trait_type: "Trigger Word",
          value: triggerWord,
        },
        {
          trait_type: "Training Steps",
          value: (trainingJob.training_steps || 300).toString(),
        },
        {
          trait_type: "Captioning",
          value: trainingJob.captioning || "automatic",
        },
        {
          trait_type: "Training Images Count",
          value: (trainingJob.training_images?.length || 0).toString(),
        },
        {
          trait_type: "Replicate Job ID",
          value: replicateJobId,
        },
      ],
    }

    const spgContract = getSPGNftContract()

    // Register the model as an IP asset
    console.log(`📝 Registering model IP asset for: ${triggerWord}`)
    const modelResult = await mintAndRegisterIP({
      spgNftContract: spgContract,
      metadata: modelMetadata,
    })

    if (!modelResult.success) {
      console.error(`❌ Failed to register model IP:`, modelResult.error)

      // Update job with failed status
      await supabase
        .from("training_jobs")
        .update({
          story_model_registration_status: "failed",
        })
        .eq("replicate_job_id", replicateJobId)

      return
    }

    console.log(`✅ Registered model IP: ${modelResult.ipId}`)

    // Update training job with model IP information
    const updateData: any = {
      story_model_ip_id: modelResult.ipId,
      story_model_nft_contract: spgContract,
      story_model_token_id: modelResult.tokenId?.toString(),
      story_model_tx_hash: modelResult.txHash,
      story_model_registration_status: "registered",
    }

    // If we have registered training image IPs, store them as parent IPs
    if (registeredImageIPs.length > 0) {
      updateData.story_parent_ip_ids = registeredImageIPs
      console.log(
        `📝 Stored ${registeredImageIPs.length} parent IP IDs for derivative relationship`
      )
    }

    const { error: updateError } = await supabase
      .from("training_jobs")
      .update(updateData)
      .eq("replicate_job_id", replicateJobId)

    if (updateError) {
      console.error(`❌ Error updating training job with model IP:`, updateError)
    } else {
      console.log(`✅ Updated training job ${replicateJobId} with model IP: ${modelResult.ipId}`)
    }

    // TODO: Implement derivative registration when Story Protocol supports it
    // For now, we're just registering the model as an independent IP asset
    // In the future, we could register it as a derivative of the training images
    // using registerDerivativeIP once license tokens are properly set up
  } catch (error) {
    console.error("❌ Error in registerTrainedModelAsIP:", error)

    // Update job with failed status
    try {
      await supabase
        .from("training_jobs")
        .update({
          story_model_registration_status: "failed",
        })
        .eq("replicate_job_id", replicateJobId)
    } catch (updateError) {
      console.error("❌ Error updating failed status:", updateError)
    }
  }
}
