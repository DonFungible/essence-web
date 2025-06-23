"use server"
import Replicate from "replicate"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { headers } from "next/headers"
import { Pool } from "pg" // For direct DB interaction

/** Throws if an env var is missing or empty. */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

// Env-var guards
const REPLICATE_API_TOKEN = requireEnv("REPLICATE_API_TOKEN")
const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
const DATABASE_URL = requireEnv("POSTGRES_URL") // For direct DB connection

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN })
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) // For storage

const pool = new Pool({ connectionString: DATABASE_URL })

const trainingInputSchema = z.object({
  input_images: z.string().url(),
  trigger_word: z.string().min(1),
  captioning: z
    .enum(["captioning-disabled", "automatic", "captioning-enabled"])
    .default("automatic"),
  training_steps: z.number().min(1).max(1000).default(300),
  mode: z.literal("style").default("style"),
  lora_rank: z.enum(["16", "32"]).default("16").transform(Number),
  finetune_type: z.enum(["lora", "full"]).default("lora"),
})

async function submitToReplicate(
  replicateApiInput: z.infer<typeof trainingInputSchema>,
  webhookUrl: string
  // metadata is not directly passed to Replicate's prediction.create input
  // It's used for our own database logging
) {
  console.log(`[REPLICATE_SUBMITTER] Submitting to Replicate...`)
  console.log(`[REPLICATE_SUBMITTER] Input:`, replicateApiInput)
  console.log(`[REPLICATE_SUBMITTER] Webhook URL:`, webhookUrl)

  const prediction = await replicate.predictions.create({
    model: "black-forest-labs/flux-pro-trainer", // Ensure this is the correct model
    input: replicateApiInput,
    webhook: webhookUrl,
    webhook_events_filter: ["start", "output", "logs", "completed"],
  })

  console.log(`[REPLICATE_SUBMITTER] Prediction created with ID: ${prediction.id}`)
  return {
    replicateJobId: prediction.id,
    status: prediction.status,
    prediction: prediction, // Full prediction object
  }
}

export async function startTrainingJobOptimized(data: {
  publicUrl: string // Dataset URL
  storagePath: string // Dataset storage path
  originalFileName: string
  triggerWord: string
  captioning?: string
  trainingSteps?: string
  previewImageUrl?: string // New optional field
  description?: string | null // New optional field
}) {
  console.log("[TRAIN_ACTION_OPTIMIZED] Starting training job submission...")
  const {
    publicUrl,
    storagePath,
    originalFileName,
    triggerWord,
    captioning = "automatic",
    trainingSteps = "300",
    previewImageUrl,
    description,
  } = data

  if (!publicUrl || !triggerWord) {
    return { success: false, error: "Missing required parameters (dataset URL or trigger word)." }
  }

  try {
    const replicateApiInputData = {
      input_images: publicUrl,
      trigger_word: triggerWord,
      captioning: captioning,
      training_steps: Number.parseInt(trainingSteps),
      mode: "style" as const,
      lora_rank: "16", // Default, consider making configurable
      finetune_type: "lora" as const, // Default
    }

    const parsedReplicateInput = trainingInputSchema.safeParse(replicateApiInputData)
    if (!parsedReplicateInput.success) {
      console.error(
        "[TRAIN_ACTION] Replicate input validation failed:",
        parsedReplicateInput.error.flatten()
      )
      return { success: false, error: "Invalid input for Replicate API." }
    }

    let webhookUrl: string
    const tunnelUrl = process.env.REPLICATE_WEBHOOK_TUNNEL_URL
    if (process.env.NODE_ENV === "development" && tunnelUrl) {
      webhookUrl = `${tunnelUrl}/api/replicate-webhook`
    } else {
      const headersList = headers() // Correct usage of headers
      const host = headersList.get("host")
      if (!host) throw new Error("Could not determine host for webhook URL.")
      const protocol = host.startsWith("localhost") ? "http" : "https"
      webhookUrl = `${protocol}://${host}/api/replicate-webhook`
    }
    console.log(`[TRAIN_ACTION] Using webhook URL: ${webhookUrl}`)

    // Submit to Replicate
    const replicateResult = await submitToReplicate(parsedReplicateInput.data, webhookUrl)

    // Immediately log/update our database
    try {
      const { data: dbRes, error } = await supabaseAdmin
        .from("training_jobs")
        .upsert({
          replicate_job_id: replicateResult.replicateJobId,
          status: replicateResult.status,
          trigger_word: triggerWord,
          input_images_url: publicUrl,
          training_steps: Number.parseInt(trainingSteps),
          captioning: captioning,
          preview_image_url: previewImageUrl,
          description: description,
          original_dataset_filename: originalFileName,
          supabase_storage_path: storagePath,
        })
        .select()
        .single()
    } catch (error) {
      console.error("[TRAIN_ACTION] Error logging to database:", error)
      return { success: false, error: "Failed to log training job to database." }
    }

    console.log(
      `[TRAIN_ACTION] Successfully submitted to Replicate. Job ID: ${replicateResult.replicateJobId}`
    )
    return {
      success: true,
      jobId: replicateResult.replicateJobId,
      status: replicateResult.status,
      message: "Training job submitted. DB record created/updated.",
    }
  } catch (err: any) {
    console.error("[TRAIN_ACTION_OPTIMIZED] Error:", err)
    return { success: false, error: err.message || "Failed to start training job." }
  }
}

// Note: The legacy `startTrainingJob` that takes FormData would need similar modifications
// to handle preview image upload from FormData and pass its URL and description.
// For brevity, I'm focusing on the `startTrainingJobOptimized` flow.
// If you need `startTrainingJob` (legacy) updated, let me know.
