"use server"
import Replicate from "replicate"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { headers } from "next/headers"
import { canUserTrain } from "@/lib/story-protocol"

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

export async function checkUserCanTrain(walletAddress: string) {
  console.log("[CHECK_USER_TRAIN] Checking if user can train:", walletAddress)

  try {
    const result = await canUserTrain(walletAddress)
    console.log("[CHECK_USER_TRAIN] Result:", result)
    return result
  } catch (error) {
    console.error("[CHECK_USER_TRAIN] Error:", error)
    return {
      canTrain: false,
      reason: "Failed to validate training eligibility",
      error: error instanceof Error ? error.message : "Unknown error",
    }
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
  hasIndividualImages?: boolean // New optional field to indicate individual images
  individualImagesCount?: number // New optional field for image count
  userWalletAddress?: string // New optional field for balance validation
  ipRegistrationMethod?: "backend" | "wallet" // New field for IP registration method
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
    hasIndividualImages = false,
    individualImagesCount = 0,
    userWalletAddress,
    ipRegistrationMethod = "backend",
  } = data

  if (!publicUrl || !triggerWord) {
    return { success: false, error: "Missing required parameters (dataset URL or trigger word)." }
  }

  // Only validate balance if using connected wallet for IP registration
  if (userWalletAddress && ipRegistrationMethod === "wallet") {
    const canTrainResult = await canUserTrain(userWalletAddress)
    if (!canTrainResult.canTrain) {
      console.log(`[TRAIN_ACTION] User ${userWalletAddress} cannot train: ${canTrainResult.reason}`)
      return {
        success: false,
        error: canTrainResult.reason || "Insufficient balance for IP registration",
        balanceCheckFailed: true,
      }
    }
    console.log(`[TRAIN_ACTION] User ${userWalletAddress} can train: ${canTrainResult.reason}`)
  } else if (ipRegistrationMethod === "backend") {
    console.log("[TRAIN_ACTION] Using backend wallet for IP registration - no balance check needed")
  } else {
    console.warn("[TRAIN_ACTION] No wallet address provided for balance validation")
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
    webhookUrl = `${tunnelUrl}/api/replicate-webhook`
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
          has_individual_images: hasIndividualImages,
          individual_images_count: individualImagesCount,
          ip_registration_method: ipRegistrationMethod,
        })
        .select()
        .single()

      // If this job has individual images, update the training images with the replicate job ID
      if (hasIndividualImages && dbRes) {
        const { error: updateError } = await supabaseAdmin
          .from("training_images")
          .update({ replicate_job_id: replicateResult.replicateJobId })
          .eq("training_job_id", dbRes.id)

        if (updateError) {
          console.error(
            "[TRAIN_ACTION] Error updating training images with replicate job ID:",
            updateError
          )
        } else {
          console.log(
            `[TRAIN_ACTION] Updated training images with replicate job ID: ${replicateResult.replicateJobId}`
          )
        }
      }
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

// Function to pre-create training job for individual image uploads
export async function createTrainingJobForImages(data: {
  triggerWord: string
  captioning?: string
  trainingSteps?: string
  previewImageUrl?: string
  description?: string | null
  imageCount: number
  userWalletAddress?: string
  ipRegistrationMethod?: "backend" | "wallet"
}) {
  console.log("[CREATE_TRAINING_JOB] Creating training job for individual images...")

  const {
    triggerWord,
    captioning = "automatic",
    trainingSteps = "300",
    previewImageUrl,
    description,
    imageCount,
    userWalletAddress,
    ipRegistrationMethod = "backend",
  } = data

  // Only validate balance if using connected wallet for IP registration
  if (userWalletAddress && ipRegistrationMethod === "wallet") {
    const canTrainResult = await canUserTrain(userWalletAddress)
    if (!canTrainResult.canTrain) {
      console.log(
        `[CREATE_TRAINING_JOB] User ${userWalletAddress} cannot train: ${canTrainResult.reason}`
      )
      return {
        success: false,
        error: canTrainResult.reason || "Insufficient balance for IP registration",
        balanceCheckFailed: true,
      }
    }
    console.log(
      `[CREATE_TRAINING_JOB] User ${userWalletAddress} can train: ${canTrainResult.reason}`
    )
  } else if (ipRegistrationMethod === "backend") {
    console.log(
      "[CREATE_TRAINING_JOB] Using backend wallet for IP registration - no balance check needed"
    )
  }

  try {
    const { data: dbRes, error } = await supabaseAdmin
      .from("training_jobs")
      .insert({
        status: "preparing", // Initial status before Replicate submission
        trigger_word: triggerWord,
        training_steps: Number.parseInt(trainingSteps),
        captioning: captioning,
        preview_image_url: previewImageUrl,
        description: description,
        has_individual_images: true,
        individual_images_count: imageCount,
        ip_registration_method: ipRegistrationMethod,
      })
      .select()
      .single()

    if (error) {
      console.error("[CREATE_TRAINING_JOB] Database error:", error)
      return { success: false, error: "Failed to create training job record." }
    }

    console.log(`[CREATE_TRAINING_JOB] Created training job with ID: ${dbRes.id}`)
    return {
      success: true,
      trainingJobId: dbRes.id,
      dbRecord: dbRes,
    }
  } catch (err: any) {
    console.error("[CREATE_TRAINING_JOB] Error:", err)
    return { success: false, error: err.message || "Failed to create training job." }
  }
}

// Note: The legacy `startTrainingJob` that takes FormData would need similar modifications
// to handle preview image upload from FormData and pass its URL and description.
// For brevity, I'm focusing on the `startTrainingJobOptimized` flow.
// If you need `startTrainingJob` (legacy) updated, let me know.
