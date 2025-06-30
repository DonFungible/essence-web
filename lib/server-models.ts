import { createClient } from "@/utils/supabase/server"
import {
  type ModelType,
  transformDbModelToUIModel,
  type DatabaseModel as UIDatabaseModel,
} from "./models-data" // Import UIDatabaseModel

// Extend UIDatabaseModel for server-side specifics if needed, or use directly
// For this change, we're adding fields to the existing UIDatabaseModel via models-data.ts
// So, the DatabaseModel interface here should align with what's fetched.

// Fetch trained models from database (server-only)
export async function getTrainedModelsFromDatabase(): Promise<ModelType[]> {
  try {
    const supabase = await createClient()

    // Fetch successful training jobs that have output models and are not hidden
    const { data: trainedModels, error } = await supabase
      .from("training_jobs")
      .select(
        `
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
  description,
  ip_id
`
      )
      .eq("status", "succeeded")
      .not("output_model_url", "is", null)
      .or("is_hidden.is.null,is_hidden.eq.false")
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

// Fetch models currently being trained (server-only)
export async function getTrainingModelsFromDatabase(): Promise<ModelType[]> {
  try {
    const supabase = await createClient()

    // Fetch training jobs that are currently processing and are not hidden
    const { data: trainingModels, error } = await supabase
      .from("training_jobs")
      .select(
        `
        id,
        replicate_job_id,
        status,
        trigger_word,
        output_model_url,
        input_images_url,
        created_at,
        started_at,
        predict_time,
        total_time,
        training_steps,
        captioning,
        preview_image_url, 
        description,
        ip_id
      `
      )
      .in("status", ["starting", "processing"])
      .or("is_hidden.is.null,is_hidden.eq.false")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching training models:", error)
      return []
    }

    if (!trainingModels || trainingModels.length === 0) {
      return []
    }

    // Transform database models to UI format
    return trainingModels.map((model: any) => transformDbModelToUIModel(model as UIDatabaseModel))
  } catch (error) {
    console.error("Error in getTrainingModelsFromDatabase:", error)
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
