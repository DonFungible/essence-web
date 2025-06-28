import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll("images") as File[]
    const trainingJobId = formData.get("trainingJobId") as string // Optional for storing individual images

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 })
    }

    // Validate all files are images
    const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    for (const file of files) {
      if (!validImageTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only JPG, PNG, WEBP, and GIF are allowed.` },
          { status: 400 }
        )
      }
      if (file.size > 10 * 1024 * 1024) {
        // 10MB per image
        return NextResponse.json(
          { error: `Image ${file.name} is too large. Maximum size is 10MB per image.` },
          { status: 400 }
        )
      }
    }

    // Check minimum images requirement
    if (files.length < 5) {
      return NextResponse.json(
        { error: "At least 5 images are required for training." },
        { status: 400 }
      )
    }

    // Check total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > 500 * 1024 * 1024) {
      // 500MB total
      return NextResponse.json({ error: "Total images size exceeds 500MB limit." }, { status: 400 })
    }

    console.log(`📦 Creating zip from ${files.length} images...`)

    // Create Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    // Store individual images in database and assets bucket if trainingJobId is provided
    const imageRecords: any[] = []
    if (trainingJobId) {
      console.log(
        `💾 Storing ${files.length} individual images for training job ${trainingJobId}...`
      )

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const arrayBuffer = await file.arrayBuffer()

        // Generate clean filename for storage
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
        const timestamp = Date.now()
        const storageFileName = `${timestamp}_${i + 1}_${cleanName}`
        const storagePath = `training-images/${trainingJobId}/${storageFileName}`

        // Upload to assets bucket for individual image storage
        const { error: uploadError } = await supabase.storage
          .from("assets")
          .upload(storagePath, arrayBuffer, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) {
          console.error(`Error uploading image ${file.name}:`, uploadError)
          // Continue with other images
        } else {
          // Get public URL
          const { data: urlData } = supabase.storage.from("assets").getPublicUrl(storagePath)

          // Record image in database
          const imageRecord = {
            training_job_id: trainingJobId,
            original_filename: file.name,
            file_size: file.size,
            content_type: file.type,
            supabase_storage_path: storagePath,
            supabase_public_url: urlData.publicUrl,
            display_order: i,
          }

          imageRecords.push(imageRecord)
          console.log(`✅ Stored individual image: ${file.name}`)
        }
      }

      // Bulk insert image records
      if (imageRecords.length > 0) {
        const { error: dbError } = await supabase.from("training_images").insert(imageRecords)

        if (dbError) {
          console.error("Error inserting training images:", dbError)
        } else {
          console.log(`✅ Inserted ${imageRecords.length} training image records`)
        }
      }
    }

    // Dynamically import JSZip
    const JSZip = (await import("jszip")).default as any
    const zip = new JSZip()

    // Add each image to the zip
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const arrayBuffer = await file.arrayBuffer()

      // Generate a clean filename
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const fileName = `image_${String(i + 1).padStart(3, "0")}_${cleanName}`

      zip.file(fileName, arrayBuffer)
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" })
    const zipSizeMB = Math.round(zipBuffer.byteLength / 1024 / 1024)
    console.log(`📦 Generated zip file: ${zipSizeMB}MB`)

    // Generate unique filename for the zip
    const uniqueId = uuidv4()
    const zipFileName = `training-dataset-${uniqueId}.zip`
    const storagePath = `public/${zipFileName}`

    console.log(`💾 Uploading zip to: models/${storagePath}`)

    // Upload zip to Supabase Storage
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from("models")
      .upload(storagePath, zipBuffer, {
        contentType: "application/zip",
        upsert: false,
      })

    if (uploadError) {
      console.error("Error uploading zip:", uploadError)
      return NextResponse.json({ error: "Failed to upload zip file" }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("models").getPublicUrl(storagePath)

    console.log(`✅ Zip uploaded successfully: ${urlData.publicUrl}`)

    return NextResponse.json({
      success: true,
      publicUrl: urlData.publicUrl,
      storagePath: storagePath,
      fileName: zipFileName,
      originalFileCount: files.length,
      zipSizeMB: zipSizeMB,
    })
  } catch (error) {
    console.error("Zip creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
