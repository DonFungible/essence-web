import { createClient } from "@supabase/supabase-js"

export interface StyleReferenceImage {
  src: string
  alt: string
  ipId?: string // Story Protocol IP Asset ID (only for registered training images)
}

/**
 * Fetches style reference images from Supabase storage bucket or training images database
 * First checks for individual training images, then falls back to assets bucket
 * Returns ALL available images (no limit)
 */
export async function getStyleReferenceImages(modelName: string): Promise<StyleReferenceImage[]> {
  try {
    // Create Supabase admin client for storage access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // First, check if this model was trained with individual images
    const { data: trainingJob, error: trainingJobError } = await supabase
      .from("training_jobs")
      .select("id, has_individual_images, replicate_job_id")
      .eq("trigger_word", modelName)
      .eq("has_individual_images", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!trainingJobError && trainingJob) {
      console.log(`Found training job with individual images for model: ${modelName}`)

      // Fetch ALL individual training images from database including IP data
      const { data: trainingImages, error: imagesError } = await supabase
        .from("training_images")
        .select("supabase_public_url, original_filename, story_ip_id, story_registration_status")
        .eq("training_job_id", trainingJob.id)
        .order("display_order", { ascending: true })

      if (!imagesError && trainingImages && trainingImages.length > 0) {
        const styleImages: StyleReferenceImage[] = trainingImages.map((img, index) => ({
          src: img.supabase_public_url,
          alt: `${modelName} training image - ${img.original_filename.replace(/\.[^/.]+$/, "")}`,
          // Only include ipId if the image is successfully registered
          ipId: img.story_registration_status === "registered" ? img.story_ip_id : undefined,
        }))

        console.log(
          `Found ${styleImages.length} individual training images for model: ${modelName}`
        )
        return styleImages
      }
    }

    // Fallback to existing assets bucket logic
    // Clean model name for bucket path
    const bucketPath = modelName

    // List ALL files in the model's assets bucket
    const { data: files, error } = await supabase.storage.from("assets").list(bucketPath, {
      sortBy: { column: "name", order: "asc" },
    })

    if (error) {
      console.error(`Error listing files from bucket assets/${bucketPath}:`, error)
      return getDefaultStyleImages()
    }

    if (!files || files.length === 0) {
      console.log(`No images found in bucket assets/${bucketPath}, using defaults`)
      return getDefaultStyleImages()
    }

    // Filter for image files and get public URLs
    const imageFiles = files.filter(
      (file) =>
        file.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name) && !file.name.startsWith(".") // Exclude hidden files
    )

    if (imageFiles.length === 0) {
      console.log(`No image files found in bucket assets/${bucketPath}, using defaults`)
      return getDefaultStyleImages()
    }

    // Get public URLs for ALL images
    const styleImages: StyleReferenceImage[] = imageFiles.map((file) => {
      const { data: urlData } = supabase.storage
        .from("assets")
        .getPublicUrl(`${bucketPath}/${file.name}`)

      return {
        src: urlData.publicUrl,
        alt: `${modelName} style reference - ${file.name.replace(/\.[^/.]+$/, "")}`,
      }
    })

    console.log(`Found ${styleImages.length} style reference images for model: ${modelName}`)
    return styleImages
  } catch (error) {
    console.error(`Error fetching style reference images for model ${modelName}:`, error)
    return getDefaultStyleImages()
  }
}

/**
 * Gets the first style reference image for a model (for use as preview/thumbnail)
 */
export async function getFirstStyleReferenceImage(modelName: string): Promise<string | null> {
  try {
    const styleImages = await getStyleReferenceImages(modelName)

    // Return the first image if it exists and is not a default placeholder
    if (styleImages.length > 0) {
      const firstImage = styleImages[0]
      // Only return if it's a custom image from storage or database (not a default placeholder)
      if (firstImage.src && !firstImage.src.startsWith("/")) {
        return firstImage.src
      }
    }

    return null
  } catch (error) {
    console.error(`Error fetching first style reference image for model ${modelName}:`, error)
    return null
  }
}

/**
 * Returns default fallback images when model-specific images aren't available
 */
function getDefaultStyleImages(): StyleReferenceImage[] {
  return [
    { src: "/vintage-white-car.png", alt: "Vintage white car style example" },
    { src: "/minimalist-animation.png", alt: "Minimalist animation style example" },
  ]
}
