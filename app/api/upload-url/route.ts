import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileSize, fileType } = await req.json()

    // Validate input
    if (!fileName || !fileSize || !fileType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Determine if this is an image or ZIP file
    const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    const isImage = validImageTypes.some((type) => fileType.includes(type))
    const isZip = fileType.includes("zip") || fileType.includes("application/zip")

    if (!isImage && !isZip) {
      return NextResponse.json(
        {
          error: "Only ZIP files (for models) and image files (JPG, PNG, WEBP, GIF) are allowed",
        },
        { status: 400 }
      )
    }

    // Apply different size limits based on file type
    if (isImage && fileSize > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image file size exceeds 5MB limit" }, { status: 400 })
    }

    if (isZip && fileSize > 2000 * 1024 * 1024) {
      return NextResponse.json({ error: "ZIP file size exceeds 2GB limit" }, { status: 400 })
    }

    // Create Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    // Generate unique file path
    const originalName = fileName
    const lastDot = originalName.lastIndexOf(".")
    const baseName = lastDot > -1 ? originalName.substring(0, lastDot) : originalName
    const extension = lastDot > -1 ? originalName.substring(lastDot + 1) : isZip ? "zip" : "jpg"
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9.-]/g, "_")
    const uniqueId = uuidv4()
    const newFileName = `${sanitizedBaseName}-${uniqueId}.${extension}`

    // Use different buckets and paths based on file type
    const bucket = isImage ? "assets" : "models"
    const storagePath = isImage ? `previews/${newFileName}` : `public/${newFileName}`

    // Generate signed upload URL (expires in 10 minutes)
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath, {
      upsert: false,
    })

    if (error) {
      console.error("Error creating signed URL:", error)
      return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 })
    }

    // Get the public URL for later use
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath)

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      publicUrl: urlData.publicUrl,
      storagePath: storagePath,
      fileName: newFileName,
    })
  } catch (error) {
    console.error("Upload URL generation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
