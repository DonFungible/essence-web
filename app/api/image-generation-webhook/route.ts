import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  // Use service role key for webhooks (no user session needed)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  console.log("🎨 Processing image generation webhook...")

  // Parse the request body
  let body: any
  try {
    body = await req.json()
  } catch (error) {
    console.error("❌ Error parsing webhook body:", error)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  console.log("📨 Received image generation webhook:", {
    id: body.id,
    status: body.status,
    hasOutput: !!body.output,
    hasError: !!body.error,
    hasLogs: !!body.logs,
  })

  const {
    id: replicatePredictionId,
    status,
    output,
    error: replicateError,
    logs,
    metrics,
    completed_at,
    started_at,
  } = body

  if (!replicatePredictionId) {
    console.error("❌ Webhook missing Replicate Prediction ID")
    return NextResponse.json({ error: "Missing Replicate Prediction ID" }, { status: 400 })
  }

  console.log(
    `🔄 Processing image generation webhook for prediction ${replicatePredictionId} with status: ${status}`
  )

  try {
    // Find the generation record in our database
    const { data: generationRecord, error: findError } = await supabase
      .from("image_generations")
      .select("*")
      .eq("replicate_prediction_id", replicatePredictionId)
      .single()

    if (findError || !generationRecord) {
      console.error(
        `❌ Generation record not found for prediction ${replicatePredictionId}:`,
        findError
      )
      return NextResponse.json({ error: "Generation record not found" }, { status: 404 })
    }

    console.log(`📝 Found generation record: ${generationRecord.id}`)

    // Prepare update data
    const updateData: any = {
      status: status,
    }

    // Add timing data if available
    if (completed_at) {
      updateData.completed_at = completed_at
    }
    if (metrics?.predict_time) {
      updateData.generation_time_seconds = metrics.predict_time
    }

    // Handle different status types
    if (status === "succeeded" && output) {
      console.log(`✅ Image generation succeeded for ${replicatePredictionId}`)

      // Output is typically an array of URLs for Flux models
      const imageUrl = Array.isArray(output) ? output[0] : output

      if (imageUrl && typeof imageUrl === "string") {
        console.log(`🖼️ Generated image URL: ${imageUrl}`)
        updateData.image_url = imageUrl

        try {
          // Download and store the image in Supabase
          const storedImageData = await downloadAndStoreImage(imageUrl, generationRecord.id)

          if (storedImageData.success) {
            updateData.supabase_image_url = storedImageData.publicUrl
            updateData.supabase_storage_path = storedImageData.storagePath
            updateData.image_size = storedImageData.imageSize
            console.log(`💾 Image stored in Supabase: ${storedImageData.publicUrl}`)

            // Register the generated image as a derivative of the AI model (non-blocking)
            registerGeneratedImageAsDerivative(
              generationRecord,
              storedImageData.publicUrl || imageUrl
            )
              .then((result: any) => {
                if (result?.success) {
                  console.log(`✅ Generated image registered as derivative IP: ${result.ipId}`)
                } else {
                  console.error(
                    `❌ Failed to register generated image as derivative:`,
                    result?.error || "Unknown error"
                  )
                }
              })
              .catch((error: any) => {
                console.error(`❌ Error registering generated image as derivative:`, error)
              })
          } else {
            console.error(`⚠️ Failed to store image in Supabase: ${storedImageData.error}`)
            // Continue with original URL as fallback
          }
        } catch (storageError) {
          console.error(`⚠️ Error storing image: ${storageError}`)
          // Continue with original URL as fallback
        }
      } else {
        console.error(`❌ Invalid image output format:`, output)
        updateData.error_message = "Invalid image output format received"
        updateData.status = "failed"
      }
    } else if (status === "failed" && replicateError) {
      console.log(`❌ Image generation failed for ${replicatePredictionId}:`, replicateError)
      updateData.error_message =
        typeof replicateError === "string" ? replicateError : JSON.stringify(replicateError)
    } else if (status === "processing") {
      console.log(`⏳ Image generation processing for ${replicatePredictionId}`)

      // Check for NSFW or other errors in logs even when status is "processing"
      if (logs && typeof logs === "string") {
        const logLower = logs.toLowerCase()
        if (
          logLower.includes("nsfw") ||
          logLower.includes("content policy") ||
          logLower.includes("safety filter") ||
          logLower.includes("inappropriate content")
        ) {
          console.log(`🚫 NSFW content detected in logs for ${replicatePredictionId}`)
          updateData.status = "failed"
          updateData.error_message = "Error generating image: NSFW content detected."
        }
      }

      // Also check if there's an error field even when status is processing
      if (replicateError) {
        console.log(
          `❌ Error found during processing for ${replicatePredictionId}:`,
          replicateError
        )
        updateData.status = "failed"
        updateData.error_message =
          typeof replicateError === "string" ? replicateError : JSON.stringify(replicateError)
      }
    } else if (status === "starting") {
      console.log(`🚀 Image generation starting for ${replicatePredictionId}`)
    }

    // Update the generation record
    const { data: updatedRecord, error: updateError } = await supabase
      .from("image_generations")
      .update(updateData)
      .eq("replicate_prediction_id", replicatePredictionId)
      .select()
      .single()

    if (updateError) {
      console.error(`❌ Database error updating generation ${replicatePredictionId}:`, updateError)
      return NextResponse.json({ error: "Database update failed" }, { status: 500 })
    }

    console.log(`✅ Updated generation record for ${replicatePredictionId}`)

    return NextResponse.json(
      {
        message: "Image generation webhook processed successfully",
        predictionId: replicatePredictionId,
        generationId: updatedRecord.id,
        status: status,
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error(
      `💥 Unexpected error processing image generation webhook for ${replicatePredictionId}:`,
      err
    )
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * Download image with retry logic to handle network failures
 * Retries up to 3 times with exponential backoff
 */
async function downloadImageWithRetry(imageUrl: string, maxRetries: number = 3) {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📥 Download attempt ${attempt}/${maxRetries} for: ${imageUrl}`)

      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "EssenceWeb/1.0",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
      }

      const imageBuffer = await response.arrayBuffer()
      const contentType = response.headers.get("content-type") || "image/webp"

      console.log(`✅ Image downloaded successfully on attempt ${attempt}`)

      return {
        imageBuffer,
        contentType,
      }
    } catch (error: any) {
      lastError = error
      console.error(`❌ Download attempt ${attempt} failed:`, error.message)

      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = 1000 * Math.pow(2, attempt - 1)
        console.log(`⏳ Waiting ${delayMs}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  // If we get here, all retries failed
  throw new Error(
    `Failed to download image after ${maxRetries} attempts. Last error: ${lastError?.message}`
  )
}

/**
 * Download image from Replicate and store it in Supabase Storage
 * Returns the public URL and storage path
 */
async function downloadAndStoreImage(imageUrl: string, generationId: string) {
  try {
    console.log(`📥 Downloading image from: ${imageUrl}`)

    // Download the image with retry logic
    const { imageBuffer, contentType } = await downloadImageWithRetry(imageUrl)

    // Determine file extension
    let extension = "webp"
    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      extension = "jpg"
    } else if (contentType.includes("png")) {
      extension = "png"
    }

    // Generate storage path
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `${generationId}-${timestamp}.${extension}`
    const storagePath = `public/${fileName}`

    console.log(`💾 Storing image as: ${storagePath}`)

    // Upload to Supabase Storage
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: uploadError, data: uploadData } = await supabaseAdmin.storage
      .from("generated-images")
      .upload(storagePath, imageBuffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("generated-images")
      .getPublicUrl(storagePath)

    if (!urlData?.publicUrl) {
      throw new Error("Could not generate public URL for stored image")
    }

    // Try to determine image dimensions (basic approach)
    let imageSize = "unknown"
    try {
      // For now, we'll set a default size - in production you might want to use an image processing library
      imageSize = "1024x1024" // Default for most Flux generations
    } catch (sizeError) {
      console.warn("Could not determine image size:", sizeError)
    }

    console.log(`✅ Image stored successfully: ${urlData.publicUrl}`)

    return {
      success: true,
      publicUrl: urlData.publicUrl,
      storagePath: storagePath,
      imageSize: imageSize,
    }
  } catch (error: any) {
    console.error("❌ Error downloading and storing image:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Register a generated image as a derivative IP asset of the AI model that created it
 */
async function registerGeneratedImageAsDerivative(
  generationRecord: any,
  imageUrl: string
): Promise<{ success: boolean; ipId?: string; error?: string }> {
  try {
    console.log(
      `🎨 [DERIVATIVE_IP] Starting derivative registration for image: ${generationRecord.id}`
    )

    // Check if Story Protocol is configured
    const { isStoryConfigured, getSPGNftContract, mintAndRegisterIpAndMakeDerivative } =
      await import("@/lib/story-protocol")

    if (!isStoryConfigured()) {
      console.log(
        `⚠️ [DERIVATIVE_IP] Story Protocol not configured, skipping derivative registration`
      )
      return { success: false, error: "Story Protocol not configured" }
    }

    // Get the AI model details from the database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    console.log(`📝 [DERIVATIVE_IP] Looking up AI model: ${generationRecord.model_id}`)

    const { data: aiModel, error: modelError } = await supabase
      .from("training_jobs")
      .select("ip_id, trigger_word, replicate_job_id")
      .eq("replicate_job_id", generationRecord.model_id)
      .single()

    if (modelError || !aiModel) {
      console.error(`❌ [DERIVATIVE_IP] AI model not found:`, modelError)
      return { success: false, error: "AI model not found" }
    }

    if (!aiModel.ip_id) {
      console.error(
        `❌ [DERIVATIVE_IP] AI model ${generationRecord.model_id} is not registered as IP asset`
      )
      return { success: false, error: "AI model not registered as IP asset" }
    }

    console.log(`📝 [DERIVATIVE_IP] Found AI model IP: ${aiModel.ip_id}`)

    // Create metadata for the generated image
    const imageMetadata = {
      title: `Generated Image: ${generationRecord.prompt.substring(0, 50)}...`,
      description: `AI-generated image created using the "${
        aiModel.trigger_word
      }" model. Prompt: "${generationRecord.prompt}". Generated at ${new Date().toISOString()}.`,
      ipType: "image" as const,
      image: imageUrl, // Supabase URL of the generated image
      attributes: [
        {
          trait_type: "Content Type",
          value: "AI Generated Image",
        },
        {
          trait_type: "Model Trigger Word",
          value: aiModel.trigger_word,
        },
        {
          trait_type: "Generation Prompt",
          value: generationRecord.prompt,
        },
      ],
    }

    console.log(`🔗 [DERIVATIVE_IP] Registering image as derivative of AI model: ${aiModel.ip_id}`)

    const spgContract = getSPGNftContract()

    // Register the generated image as a derivative of the AI model
    const result = await mintAndRegisterIpAndMakeDerivative({
      spgNftContract: spgContract,
      parentIpIds: [aiModel.ip_id], // Generated image is a derivative of the AI model
      licenseTermsId: "1", // Use default license terms
      metadata: imageMetadata,
    })

    if (!result.success) {
      console.error(`❌ [DERIVATIVE_IP] Failed to register generated image:`, result.error)
      return { success: false, error: result.error }
    }

    console.log(
      `✅ [DERIVATIVE_IP] Successfully registered generated image as derivative IP: ${result.ipId}`
    )

    // Update the image generation record with IP information
    const updateData: any = {
      ip_id: result.ipId,
      story_image_tx_hash: result.txHash,
      story_derivative_tx_hash: result.txHash, // Same transaction for this method
      story_parent_model_ip_id: aiModel.ip_id,
      story_registration_status: "registered",
    }

    console.log(`💾 [DERIVATIVE_IP] Updating generation record with IP information:`, updateData)

    const { error: updateError } = await supabase
      .from("image_generations")
      .update(updateData)
      .eq("id", generationRecord.id)

    if (updateError) {
      console.error(`❌ [DERIVATIVE_IP] Error updating generation record:`, updateError)
      // Note: IP registration succeeded, but database update failed
      // This is logged but not considered a failure of the IP registration
    } else {
      console.log(`✅ [DERIVATIVE_IP] Updated generation record with IP information`)
    }

    return {
      success: true,
      ipId: result.ipId,
    }
  } catch (error: any) {
    console.error(`❌ [DERIVATIVE_IP] Error in registerGeneratedImageAsDerivative:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })

    return {
      success: false,
      error: error.message || "Unknown error during derivative registration",
    }
  }
}
