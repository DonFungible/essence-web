import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  // Use service role key for webhooks (no user session needed)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false }
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
    hasLogs: !!body.logs
  })

  const { 
    id: replicatePredictionId, 
    status, 
    output, 
    error: replicateError, 
    logs, 
    metrics,
    completed_at,
    started_at
  } = body

  if (!replicatePredictionId) {
    console.error("❌ Webhook missing Replicate Prediction ID")
    return NextResponse.json({ error: "Missing Replicate Prediction ID" }, { status: 400 })
  }

  console.log(`🔄 Processing image generation webhook for prediction ${replicatePredictionId} with status: ${status}`)

  try {
    // Find the generation record in our database
    const { data: generationRecord, error: findError } = await supabase
      .from("image_generations")
      .select("*")
      .eq("replicate_prediction_id", replicatePredictionId)
      .single()

    if (findError || !generationRecord) {
      console.error(`❌ Generation record not found for prediction ${replicatePredictionId}:`, findError)
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
      
      if (imageUrl && typeof imageUrl === 'string') {
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
      updateData.error_message = typeof replicateError === "string" ? replicateError : JSON.stringify(replicateError)
      
    } else if (status === "processing") {
      console.log(`⏳ Image generation processing for ${replicatePredictionId}`)
      
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

    return NextResponse.json({ 
      message: "Image generation webhook processed successfully",
      predictionId: replicatePredictionId,
      generationId: updatedRecord.id,
      status: status
    }, { status: 200 })

  } catch (err: any) {
    console.error(`💥 Unexpected error processing image generation webhook for ${replicatePredictionId}:`, err)
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 })
  }
}

/**
 * Download image from Replicate and store it in Supabase Storage
 * Returns the public URL and storage path
 */
async function downloadAndStoreImage(imageUrl: string, generationId: string) {
  try {
    console.log(`📥 Downloading image from: ${imageUrl}`)
    
    // Download the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/webp'
    
    // Determine file extension
    let extension = 'webp'
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      extension = 'jpg'
    } else if (contentType.includes('png')) {
      extension = 'png'
    }

    // Generate storage path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
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
        upsert: false 
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
      imageSize: imageSize
    }

  } catch (error: any) {
    console.error("❌ Error downloading and storing image:", error)
    return {
      success: false,
      error: error.message
    }
  }
}
