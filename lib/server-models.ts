import { createClient } from "@/utils/supabase/server"
import { type ModelType, transformDbModelToUIModel, type DatabaseModel as UIDatabaseModel } from "./models-data" // Import UIDatabaseModel

// Extend UIDatabaseModel for server-side specifics if needed, or use directly
// For this change, we're adding fields to the existing UIDatabaseModel via models-data.ts
// So, the DatabaseModel interface here should align with what's fetched.

// Fetch trained models from database (server-only)
export async function getTrainedModelsFromDatabase(): Promise<ModelType[]> {
  try {
    const supabase = await createClient()

    // Fetch successful training jobs that have output models
    const { data: trainedModels, error } = await supabase
      .from("training_jobs")
      .select(`
  id,
  replicate_job_id,
  status,
  trigger_word,
  output_model_url,
  input_images_url,
  completed_at,
  predict_time,
  total_time,
  training_steps,
  captioning,
  created_at,
  preview_image_url, 
  description 
`)
      .eq("status", "succeeded")
      .not("output_model_url", "is", null)
      .order("completed_at", { ascending: false })

    if (error) {
      console.error("Error fetching trained models:", error)
      return []
    }

    if (!trainedModels || trainedModels.length === 0) {
      return []
    }

    // Transform database models to UI format
    return trainedModels.map((model: any) => transformDbModelToUIModel(model as UIDatabaseModel)) // Cast to UIDatabaseModel
  } catch (error) {
    console.error("Error in getTrainedModelsFromDatabase:", error)
    return []
  }
}

// Find model by ID from database (server-only)
export async function findModelById(modelId: string): Promise<ModelType | null> {
  const trainedModels = await getTrainedModelsFromDatabase()
  // Match against model.id (which could be replicate_job_id) or model.dbId
  const dbModel = trainedModels.find((model) => model.id === modelId || model.dbId === modelId)
  return dbModel || null
}
