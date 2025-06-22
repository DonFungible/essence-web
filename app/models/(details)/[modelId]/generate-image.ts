"use server"

import Replicate from "replicate"
import { createClient } from '@/utils/supabase/server'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
})

export interface GenerationParams {
  prompt: string
  aspect_ratio?: string
  image_prompt?: string
  output_format?: string
  safety_tolerance?: number
  seed?: number
  raw?: boolean
  finetune_strength?: number
  image_prompt_strength?: number
}

interface GenerateImageResult {
  success: boolean
  error?: string
  generationId?: string
  replicatePredictionId?: string
}

export async function generateImage(modelId: string, params: GenerationParams): Promise<GenerateImageResult> {
  console.log("🎯 Starting image generation:", { modelId, params })

  try {
    // 1. Get model data from database
    const supabase = await createClient()
    
    const { data: model, error: modelError } = await supabase
      .from('training_jobs')
      .select('output_model_url, trigger_word')
      .eq('replicate_job_id', modelId)
      .single()

    if (modelError || !model) {
      console.error("❌ Model not found:", modelError)
      return { success: false, error: "Model not found." }
    }

    const triggerWord = model.trigger_word
    const finetuneId = model.output_model_url

    // Add validation for required fields
    console.log("🔍 Model data:", { finetuneId, triggerWord, modelId })
    
    if (!finetuneId || !triggerWord) {
      console.error("❌ Missing required model data:", { 
        hasFinetuneId: !!finetuneId, 
        hasTriggerWord: !!triggerWord 
      })
      return { success: false, error: "Model is missing required data for generation." }
    }

    const fullPrompt = `${params.prompt} in the style of ${triggerWord}`
    
    // Check webhook URL
    const webhookUrl = process.env.REPLICATE_WEBHOOK_TUNNEL_URL
    if (!webhookUrl) {
      console.error("❌ Missing webhook URL environment variable")
      return { success: false, error: "Webhook configuration missing." }
    }
    
    console.log("🔗 Webhook URL:", `${webhookUrl}/api/image-generation-webhook`)
  
    try {
      const input = {
        prompt: fullPrompt,
        finetune_id: finetuneId,
        aspect_ratio: params.aspect_ratio || "1:1",
        output_format: params.output_format || "jpg",
        safety_tolerance: params.safety_tolerance || 2,
        finetune_strength: params.finetune_strength || 1.0,
        image_prompt_strength: params.image_prompt_strength || 0.1,
        raw: params.raw || false,
        ...(params.seed && { seed: params.seed }),
        ...(params.image_prompt && { image_prompt: params.image_prompt }),
      }

      console.log("🚀 Creating async Replicate prediction with webhook...")
      console.log("📋 Input parameters:", input)

      // 2. Create the async prediction with webhook
      const prediction = await replicate.predictions.create({
        model: "black-forest-labs/flux-1.1-pro-ultra-finetuned",
        input: input,
        webhook: `${webhookUrl}/api/image-generation-webhook`,
        webhook_events_filter: ["start", "output", "logs", "completed"]
      })

      console.log("✅ Replicate prediction created:", {
        id: prediction.id,
        status: prediction.status,
        webhookUrl: `${webhookUrl}/api/image-generation-webhook`
      })

      // 3. Get user info (can be null for anonymous users)
      const { data: { user } } = await supabase.auth.getUser()

      // 4. Create database record immediately
      const { data: generationRecord, error: dbError } = await supabase
        .from('image_generations')
        .insert({
          model_id: modelId,
          replicate_prediction_id: prediction.id,
          user_id: user?.id || null,
          prompt: params.prompt,
          full_prompt: fullPrompt,
          aspect_ratio: params.aspect_ratio || "1:1",
          output_format: params.output_format || "jpg",
          safety_tolerance: params.safety_tolerance || 2,
          finetune_strength: params.finetune_strength || 1.0,
          image_prompt_strength: params.image_prompt_strength || 0.1,
          raw: params.raw || false,
          seed: params.seed || null,
          image_prompt: params.image_prompt || null,
          status: 'pending'
        })
        .select()
        .single()

      if (dbError) {
        console.error("❌ Database error creating generation record:", dbError)
        // Try to cancel the Replicate prediction since we can't track it
        try {
          await replicate.predictions.cancel(prediction.id)
        } catch (cancelError) {
          console.error("⚠️ Could not cancel Replicate prediction:", cancelError)
        }
        return { success: false, error: "Failed to create generation record." }
      }

      console.log(`✅ Generation record created: ${generationRecord.id}`)

      return { 
        success: true, 
        generationId: generationRecord.id,
        replicatePredictionId: prediction.id
      }

    } catch (replicateError: any) {
      console.error("❌ Replicate API error:", replicateError)
      return { 
        success: false, 
        error: `Generation failed: ${replicateError.message || 'Unknown error'}` 
      }
    }

  } catch (error: any) {
    console.error("❌ Unexpected error in generateImage:", error)
    return { 
      success: false, 
      error: `Unexpected error: ${error.message || 'Unknown error'}` 
    }
  }
}