import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { zipUrl, triggerWord, maxImages = 4 } = await req.json()

    if (!zipUrl || !triggerWord) {
      return NextResponse.json(
        {
          error: "Missing required fields: zipUrl and triggerWord",
        },
        { status: 400 }
      )
    }

    console.log(`📦 Extracting up to ${maxImages} style images for trigger word: ${triggerWord}`)
    console.log(`📥 Source zip: ${zipUrl}`)

    const result = await extractStyleImages(zipUrl, triggerWord, maxImages)

    if (result.success && result.uploadedImages) {
      return NextResponse.json({
        success: true,
        message: `Successfully extracted and uploaded ${result.uploadedImages.length} style images`,
        uploadedImages: result.uploadedImages,
        totalExtracted: result.uploadedImages.length,
        triggerWord: triggerWord,
        storagePath: `assets/${triggerWord}/`,
      })
    } else {
      return NextResponse.json(
        {
          error: result.error,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("❌ Error in extract-style-images:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * Extract up to maxImages from a zip file and upload to assets/{triggerWord}/
 * Optimized for bandwidth efficiency - only downloads zip once and extracts minimal images
 */
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
