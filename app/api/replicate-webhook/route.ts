import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  isStoryConfigured,
  getSPGNftContract,
  mintAndRegisterIpAndMakeDerivative,
} from "@/lib/story-protocol"

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
          console.log(`📝 Registration parameters:`, {
            replicateJobId,
            triggerWord: input.trigger_word,
            hasOutput: !!output,
            outputType: typeof output,
          })

          registerTrainedModelAsIP(replicateJobId, input.trigger_word, output)
            .then((result) => {
              console.log(
                `✅ Story Protocol registration completed for ${input.trigger_word}:`,
                result
              )
            })
            .catch((error: any) => {
              console.error(`❌ Story Protocol registration error for ${input.trigger_word}:`, {
                message: error.message,
                stack: error.stack,
                name: error.name,
              })
            })
        } else {
          console.log(`⚠️ Skipping Story Protocol registration:`, {
            storyConfigured: isStoryConfigured(),
            hasTriggerWord: !!input.trigger_word,
            triggerWord: input.trigger_word,
          })
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
    console.log(`📝 [IP_REGISTRATION] Starting IP registration for job: ${replicateJobId}`)
    console.log(`📝 [IP_REGISTRATION] Parameters:`, {
      replicateJobId,
      triggerWord,
      modelOutput: typeof modelOutput,
    })

    // Get training job details and associated training images
    console.log(`📝 [IP_REGISTRATION] Fetching training job from database...`)
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
      console.error(`❌ [IP_REGISTRATION] Could not find training job: ${replicateJobId}`, {
        error: jobError,
        hasTrainingJob: !!trainingJob,
      })
      return
    }

    console.log(`📝 [IP_REGISTRATION] Found training job:`, {
      id: trainingJob.id,
      replicate_job_id: trainingJob.replicate_job_id,
      trigger_word: trainingJob.trigger_word,
      status: trainingJob.status,
      ip_id: trainingJob.ip_id,
      story_parent_ip_ids: trainingJob.story_parent_ip_ids,
      training_images_count: trainingJob.training_images?.length || 0,
    })

    // Get registered training image IP assets
    const registeredImageIPs =
      trainingJob.training_images
        ?.filter((img: any) => img.story_ip_id && img.story_registration_status === "registered")
        ?.map((img: any) => img.story_ip_id) || []

    console.log(
      `📝 [IP_REGISTRATION] Found ${registeredImageIPs.length} registered training image IPs:`,
      registeredImageIPs
    )

    // Log all training images for debugging
    console.log(
      `📝 [IP_REGISTRATION] All training images:`,
      trainingJob.training_images?.map((img: any) => ({
        id: img.id,
        filename: img.original_filename,
        story_ip_id: img.story_ip_id,
        status: img.story_registration_status,
      })) || []
    )

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

    let modelResult: any
    let derivativeTxHash: string | null = null

    // AI models must ALWAYS be derivatives of training images
    if (registeredImageIPs.length === 0) {
      console.error(
        `❌ [IP_REGISTRATION] No training images registered as IP assets. Cannot register AI model.`
      )
      console.error(
        `❌ [IP_REGISTRATION] AI models must be derivatives of training images. Aborting registration.`
      )
      return
    }

    console.log(
      `🔗 [IP_REGISTRATION] Registering AI model as derivative of ${registeredImageIPs.length} training image IPs`
    )

    try {
      // Register model as derivative using the direct license terms approach
      modelResult = await mintAndRegisterIpAndMakeDerivative({
        spgNftContract: spgContract,
        parentIpIds: registeredImageIPs,
        licenseTermsId: "1", // Use default license terms
        metadata: modelMetadata,
      })

      console.log(`🔗 [IP_REGISTRATION] Derivative registration result:`, {
        success: modelResult.success,
        ipId: modelResult.ipId,
        txHash: modelResult.txHash,
        error: modelResult.error,
        parentCount: registeredImageIPs.length,
      })

      if (!modelResult.success) {
        console.error(
          `❌ [IP_REGISTRATION] Failed to register AI model as derivative:`,
          modelResult.error
        )
        console.error(
          `❌ [IP_REGISTRATION] AI models must be derivatives. No fallback to standalone registration.`
        )
        return
      }

      console.log(
        `✅ [IP_REGISTRATION] Successfully registered AI model as derivative IP: ${modelResult.ipId}`
      )

      // The derivative transaction hash is the same as the model registration hash for this method
      derivativeTxHash = modelResult.txHash
    } catch (error: any) {
      console.error(`❌ [IP_REGISTRATION] Exception during derivative registration:`, {
        message: error.message,
        stack: error.stack,
      })
      console.error(
        `❌ [IP_REGISTRATION] AI models must be derivatives. No fallback to standalone registration.`
      )
      return
    }

    if (!modelResult.success) {
      console.error(`❌ [IP_REGISTRATION] Failed to register model IP:`, modelResult.error)
      console.log(
        `❌ [IP_REGISTRATION] IP registration failed for job ${replicateJobId} - ip_id will remain null`
      )
      return
    }

    console.log(`✅ [IP_REGISTRATION] Successfully registered model IP: ${modelResult.ipId}`)

    // Update training job with model IP information
    const updateData: any = {
      ip_id: modelResult.ipId,
      story_model_tx_hash: modelResult.txHash,
      story_parent_ip_ids: registeredImageIPs,
    }

    console.log(
      `📝 [IP_REGISTRATION] Stored derivative relationship: ${registeredImageIPs.length} parent IPs with derivative tx: ${derivativeTxHash}`
    )

    console.log(`💾 [IP_REGISTRATION] Updating database with IP information:`, updateData)

    const { error: updateError } = await supabase
      .from("training_jobs")
      .update(updateData)
      .eq("replicate_job_id", replicateJobId)

    if (updateError) {
      console.error(`❌ [IP_REGISTRATION] Error updating training job with model IP:`, updateError)
      throw new Error(`Database update failed: ${updateError.message}`)
    } else {
      console.log(
        `✅ [IP_REGISTRATION] Updated training job ${replicateJobId} with model IP: ${modelResult.ipId}`
      )
    }
  } catch (error: any) {
    console.error("❌ [IP_REGISTRATION] Error in registerTrainedModelAsIP:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })

    // Update job with failed status - IP registration failed, so ip_id remains null
    console.log(
      "❌ [IP_REGISTRATION] IP registration failed - ip_id will remain null for this training job"
    )
  }
}
