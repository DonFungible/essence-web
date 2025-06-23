import { createClient } from "@supabase/supabase-js"

export interface StyleReferenceImage {
  src: string
  alt: string
}

/**
 * Fetches style reference images from Supabase storage bucket
 * Looks for images in the assets/{modelName} bucket (up to 4 images)
 */
export async function getStyleReferenceImages(modelName: string): Promise<StyleReferenceImage[]> {
  try {
    // Create Supabase admin client for storage access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Clean model name for bucket path
    const bucketPath = modelName

    // List files in the model's assets bucket
    const { data: files, error } = await supabase.storage.from("assets").list(bucketPath, {
      limit: 4,
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

    // Get public URLs for the images (limit to 4)
    const styleImages: StyleReferenceImage[] = imageFiles.slice(0, 4).map((file) => {
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
      // Only return if it's a custom image from storage (not a default placeholder)
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
    { src: "/abstract-product.png", alt: "Abstract product style example" },
    { src: "/anime-fantasy-landscape.png", alt: "Anime fantasy landscape style example" },
    { src: "/vintage-white-car.png", alt: "Vintage white car style example" },
    { src: "/minimalist-animation.png", alt: "Minimalist animation style example" },
  ]
}
