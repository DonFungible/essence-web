import { NextRequest, NextResponse } from "next/server"
import { getStyleReferenceImages, type StyleReferenceImage } from "@/lib/style-reference-images"
import { type DatabaseModel } from "@/lib/models-data"
import { createClient } from "@supabase/supabase-js"

async function findDbModelById(id: string): Promise<DatabaseModel | null> {
  try {
    const { getTrainedModelsFromDatabase } = await import("@/lib/server-models")
    const trained = await getTrainedModelsFromDatabase()
    return trained.find((m) => m.id === id) || null
  } catch (err) {
    console.error("Error loading DB models:", err)
    return null
  }
}

async function getTrainingImagesForModel(modelId: string): Promise<StyleReferenceImage[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    console.log(`Looking for training job with model ID: ${modelId}`)

    // Try to find training job by replicate_job_id first (most common case)
    let trainingJob = null
    let lookupMethod = ""

    const { data: jobByReplicateId, error: replicateError } = await supabase
      .from("training_jobs")
      .select("id, replicate_job_id, trigger_word")
      .eq("replicate_job_id", modelId)
      .limit(1)
      .single()

    if (!replicateError && jobByReplicateId) {
      trainingJob = jobByReplicateId
      lookupMethod = "replicate_job_id"
      console.log(`Found training job by replicate_job_id: ${trainingJob.id}`)
    } else {
      console.log(`No job found by replicate_job_id, trying database id...`)

      // Try by database id
      const { data: jobByDbId, error: dbError } = await supabase
        .from("training_jobs")
        .select("id, replicate_job_id, trigger_word")
        .eq("id", modelId)
        .limit(1)
        .single()

      if (!dbError && jobByDbId) {
        trainingJob = jobByDbId
        lookupMethod = "database_id"
        console.log(`Found training job by database id: ${trainingJob.id}`)
      } else {
        console.log(`No training job found for model ID: ${modelId}`)
        console.log(`Replicate error:`, replicateError)
        console.log(`Database error:`, dbError)
        return []
      }
    }

    console.log(
      `Found training job via ${lookupMethod}: ${trainingJob.id} (trigger_word: ${trainingJob.trigger_word})`
    )

    // Now fetch training images for this job
    const { data: trainingImages, error: imagesError } = await supabase
      .from("training_images")
      .select("supabase_public_url, original_filename, story_ip_id, story_registration_status")
      .eq("training_job_id", trainingJob.id)
      .order("display_order", { ascending: true })

    if (imagesError) {
      console.error(`Error fetching training images for job ${trainingJob.id}:`, imagesError)
      return []
    }

    if (!trainingImages || trainingImages.length === 0) {
      console.log(`No training images found in database for job ${trainingJob.id}`)
      return []
    }

    console.log(`Found ${trainingImages.length} training images for model: ${modelId}`)

    return trainingImages.map((img) => ({
      src: img.supabase_public_url,
      alt: `Training image - ${img.original_filename.replace(/\.[^/.]+$/, "")}`,
      ipId: img.story_registration_status === "registered" ? img.story_ip_id : undefined,
    }))
  } catch (error) {
    console.error(`Error fetching training images for model ${modelId}:`, error)
    return []
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params

    console.log(`\n=== Style Images API Request for Model: ${id} ===`)

    // Step 1: Try to get training images directly from the database
    console.log(`Step 1: Checking for training images in database...`)
    let images: StyleReferenceImage[] = await getTrainingImagesForModel(id)

    if (images.length > 0) {
      console.log(`✅ Found ${images.length} training images in database`)
      console.log(`Returning ${images.length} images for model: ${id}`)
      return NextResponse.json({ images })
    }

    // Step 2: Fallback to traditional bucket-based approach
    console.log(`Step 2: No training images in database, trying bucket approach...`)

    const dbModel = await findDbModelById(id)
    if (!dbModel) {
      console.error(`❌ Model not found in database for ID: ${id}`)
      return NextResponse.json({ error: "Model not found" }, { status: 404 })
    }

    console.log(`Found DB model:`, {
      id: dbModel.id,
      replicate_job_id: dbModel.replicate_job_id,
      trigger_word: dbModel.trigger_word,
    })

    // Try multiple possible bucket paths for style images lookup
    const possibleNames = [dbModel.trigger_word, id, (dbModel as any).replicate_job_id].filter(
      Boolean
    )

    console.log(`Trying bucket paths:`, possibleNames)

    // Try each possible name until we find images (not defaults)
    for (const modelName of possibleNames) {
      console.log(`Checking bucket for name: ${modelName}`)
      const result = await getStyleReferenceImages(modelName)

      // Check if we got non-default images (default images start with "/")
      if (result.length > 0 && !result[0].src.startsWith("/")) {
        console.log(`✅ Found ${result.length} images in bucket for name: ${modelName}`)
        images = result
        break
      } else {
        console.log(`❌ Only default images found for name: ${modelName}`)
      }
    }

    // Step 3: Final fallback to defaults
    if (images.length === 0 || images[0]?.src?.startsWith("/")) {
      console.log(`Step 3: Using default images as final fallback`)
      images = await getStyleReferenceImages("_defaults_")
    }

    console.log(`Final result: Returning ${images.length} images for model: ${id}`)
    console.log(
      `Image sources:`,
      images.map((img) => img.src.substring(0, 50) + "...")
    )

    return NextResponse.json({ images })
  } catch (error) {
    console.error("❌ Error fetching style images:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
