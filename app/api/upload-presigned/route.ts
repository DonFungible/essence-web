import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"

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
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  return required
}

// Create authenticated Supabase client
function createAuthenticatedSupabaseClient() {
  const env = validateEnvironment()
  
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { 
        autoRefreshToken: false, 
        persistSession: false 
      },
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    validateEnvironment()

    const { files, trainingJobId } = await req.json()

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    if (!trainingJobId) {
      return NextResponse.json({ error: "Training job ID is required" }, { status: 400 })
    }

    // Validate files
    const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    for (const file of files) {
      if (!validImageTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only JPG, PNG, WEBP, and GIF are allowed.` },
          { status: 400 }
        )
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} is too large. Maximum size is 10MB per image.` },
          { status: 400 }
        )
      }
    }

    if (files.length < 5) {
      return NextResponse.json(
        { error: "At least 5 images are required for training." },
        { status: 400 }
      )
    }

    const totalSize = files.reduce((sum: number, file: any) => sum + file.size, 0)
    if (totalSize > 500 * 1024 * 1024) {
      return NextResponse.json({ error: "Total images size exceeds 500MB limit." }, { status: 400 })
    }

    console.log(`🔐 Generating pre-signed URLs for ${files.length} files (training job: ${trainingJobId})`)

    const supabase = createAuthenticatedSupabaseClient()

    // Generate pre-signed URLs for each file
    const uploadUrls: Array<{
      fileName: string
      originalName: string
      storagePath: string
      uploadUrl: string
      publicUrl: string
      fileSize: number
      contentType: string
    }> = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const timestamp = Date.now()
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const storageFileName = `${timestamp}_${i + 1}_${cleanName}`
      const storagePath = `training-images/${trainingJobId}/${storageFileName}`

      try {
        // Generate pre-signed URL for upload (valid for 1 hour)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("assets")
          .createSignedUploadUrl(storagePath, {
            upsert: false,
          })

        if (uploadError) {
          console.error(`Error generating upload URL for ${file.name}:`, uploadError)
          return NextResponse.json(
            { error: `Failed to generate upload URL for ${file.name}` },
            { status: 500 }
          )
        }

        // Get public URL for the file
        const { data: publicUrlData } = supabase.storage
          .from("assets")
          .getPublicUrl(storagePath)

        uploadUrls.push({
          fileName: storageFileName,
          originalName: file.name,
          storagePath,
          uploadUrl: uploadData.signedUrl,
          publicUrl: publicUrlData.publicUrl,
          fileSize: file.size,
          contentType: file.type,
        })

        console.log(`✅ Generated upload URL for ${file.name}`)
      } catch (error) {
        console.error(`Exception generating URL for ${file.name}:`, error)
        return NextResponse.json(
          { error: `Failed to generate upload URL for ${file.name}` },
          { status: 500 }
        )
      }
    }

    // Generate pre-signed URL for ZIP file
    const zipFileName = `training-dataset-${uuidv4()}.zip`
    const zipStoragePath = `public/${zipFileName}`

    const { data: zipUploadData, error: zipUploadError } = await supabase.storage
      .from("models")
      .createSignedUploadUrl(zipStoragePath, {
        upsert: false,
      })

    if (zipUploadError) {
      console.error("Error generating ZIP upload URL:", zipUploadError)
      return NextResponse.json(
        { error: "Failed to generate ZIP upload URL" },
        { status: 500 }
      )
    }

    const { data: zipPublicUrlData } = supabase.storage
      .from("models")
      .getPublicUrl(zipStoragePath)

    console.log(`✅ Generated ${files.length} image upload URLs and 1 ZIP upload URL`)

    return NextResponse.json({
      success: true,
      uploadUrls,
      zipUpload: {
        fileName: zipFileName,
        storagePath: zipStoragePath,
        uploadUrl: zipUploadData.signedUrl,
        publicUrl: zipPublicUrlData.publicUrl,
      },
      trainingJobId,
    })
  } catch (error) {
    console.error("Pre-signed URL generation error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate upload URLs",
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}
