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

    // Validate file size (2000MB limit)
    if (fileSize > 2000 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 200MB limit" }, { status: 400 })
    }

    // Validate file type
    if (!fileType.includes("zip") && !fileType.includes("application/zip")) {
      return NextResponse.json({ error: "Only ZIP files are allowed" }, { status: 400 })
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
    const extension = lastDot > -1 ? originalName.substring(lastDot + 1) : "zip"
    const sanitizedBaseName = baseName.replace(/\s+/g, "_")
    const uniqueId = uuidv4()
    const newFileName = `${sanitizedBaseName}-${uniqueId}.${extension}`
    const storagePath = `public/${newFileName}`

    // Generate signed upload URL (expires in 10 minutes)
    const { data, error } = await supabase.storage
      .from("models")
      .createSignedUploadUrl(storagePath, {
        upsert: false,
      })

    if (error) {
      console.error("Error creating signed URL:", error)
      return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 })
    }

    // Get the public URL for later use
    const { data: urlData } = supabase.storage.from("models").getPublicUrl(storagePath)

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
