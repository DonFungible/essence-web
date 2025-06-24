export interface DatabaseModel {
  id: string
  replicate_job_id?: string | null
  trigger_word?: string | null
  status?: string | null
  training_steps?: number | null
  captioning?: string | null
  predict_time?: number | null
  completed_at?: string | null
  output_model_url?: string | null // URL to the .zip file from Replicate
  input_images_url?: string | null // URL to the input_images.zip
  total_time?: number | null
  created_at?: string
  preview_image_url?: string | null // Public URL from Supabase Storage
  description?: string | null
}

export type ModelType = {
  id: string // This will be replicate_job_id if available, otherwise db id
  name: string
  version: string
  description: string
  previewImageUrl?: string // URL for the card image
  trainingData: {
    size: string // e.g., "Custom dataset" or specific count
    sources: string[] // e.g., ["User uploaded"]
    styles?: string[]
    imageCount?: number
  }
  styles: string[] // e.g. trigger word, captioning method
  metrics: Array<{ name: string; value: number | string }>
  exampleImages: string[] // Fallback or specific example images if available (not from output_model_url directly if it's a zip)
  dbId: string // Keep original database ID for linking if needed
  status?: string | null
  outputModelUrl?: string | null // Direct URL to the replicate output model zip
  createdAt?: string // ISO timestamp string
}

/* ------------------------------------------------------------------
 * Compatibility shims — remove after all legacy imports are cleaned.
 * They make sure old files that still do
 *   import { models, getModelById } from "@/lib/models-data"
 * keep compiling, while returning no mock data.
 * -----------------------------------------------------------------*/

// Empty array – keeps tree-shaken out in production
export const models: ModelType[] = []

// Stub helper – always returns undefined
export function getModelById(_: string): ModelType | undefined {
  return undefined
}

// Removed getModelById as static models are gone

export function transformDbModelToUIModel(dbModel: DatabaseModel): ModelType {
  return {
    id: dbModel.replicate_job_id || dbModel.id, // Use replicate_job_id as primary ID for UI consistency if present
    dbId: dbModel.id, // Store the original database ID
    name: dbModel.trigger_word || `Model ${dbModel.id.substring(0, 6)}`,
    version: `v1.0 (${dbModel.status || "N/A"})`,
    description: dbModel.description || "",
    previewImageUrl: dbModel.preview_image_url || undefined,
    trainingData: {
      size: "Custom dataset", // Could be enhanced if image count is stored
      sources: ["User uploaded dataset"],
    },
    styles: [
      dbModel.trigger_word || "Custom Style",
      dbModel.captioning || "Auto-captioned",
      dbModel.captioning ? `Uses ${dbModel.captioning} captioning.` : "",
      "Fine-tuned",
    ].filter(Boolean) as string[],
    metrics: [
      { name: "Status", value: dbModel.status || "Unknown" },
      { name: "Training Steps", value: dbModel.training_steps || "" },
      // Add more relevant metrics if available
    ],
    // exampleImages are tricky if output_model_url is a zip.
    // For now, rely on previewImageUrl and the card's placeholder.
    // If you have a way to get specific image URLs from the Replicate output (e.g., if webhook stores them), populate here.
    exampleImages: [],
    status: dbModel.status,
    outputModelUrl: dbModel.output_model_url,
    createdAt: dbModel.created_at,
  }
}
