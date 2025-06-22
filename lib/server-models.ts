import { createClient } from '@/utils/supabase/server'
import { type ModelType, transformDbModelToUIModel } from './models-data'

// Database model interface
export interface DatabaseModel {
  id: string
  replicate_job_id: string
  status: string
  trigger_word: string | null
  output_model_url: string | null
  input_images_url: string | null
  completed_at: string | null
  predict_time: number | null
  total_time: number | null
  training_steps: number | null
  captioning: string | null
  created_at: string
}

// Fetch trained models from database (server-only)
export async function getTrainedModelsFromDatabase(): Promise<ModelType[]> {
  try {
    const supabase = await createClient()

    // Fetch successful training jobs that have output models
    const { data: trainedModels, error } = await supabase
      .from('training_jobs')
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
        created_at
      `)
      .eq('status', 'succeeded')
      .not('output_model_url', 'is', null)
      .order('completed_at', { ascending: false })

    if (error) {
      console.error('Error fetching trained models:', error)
      return []
    }

    if (!trainedModels || trainedModels.length === 0) {
      return []
    }

    // Transform database models to UI format
    return trainedModels.map((model: any) => transformDbModelToUIModel(model))

  } catch (error) {
    console.error('Error in getTrainedModelsFromDatabase:', error)
    return []
  }
}

// Find model by ID from both static and database (server-only)
export async function findModelById(modelId: string): Promise<ModelType | null> {
  // Import here to avoid circular dependency
  const { getModelById } = await import('./models-data')
  
  // First try static models
  const staticModel = getModelById(modelId)
  if (staticModel) {
    return staticModel
  }

  // Then try database models
  const trainedModels = await getTrainedModelsFromDatabase()
  const dbModel = trainedModels.find(model => model.id === modelId)
  return dbModel || null
} 