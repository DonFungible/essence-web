"use server"
import Replicate from "replicate"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { v4 as uuidv4 } from "uuid"
import { Buffer } from "buffer"
import { headers } from "next/headers"

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
const SUPABASE_BUCKET_NAME = "models"

const replicate = new Replicate({ auth: REPLICATE_API_TOKEN })

// Only need Supabase for file storage, not for training_jobs table
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

function isFileLike(value: any): value is File {
  return (
    value &&
    typeof value === "object" &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    typeof value.type === "string" &&
    typeof value.arrayBuffer === "function"
  )
}

const trainingInputSchema = z.object({
  input_images: z.string().url(),
  trigger_word: z.string().min(1),
  captioning: z.enum(["captioning-disabled", "automatic", "captioning-enabled"]).default("automatic"),
	training_steps: z.number().min(1).max(1000).default(300),
	mode: z.literal("style").default("style"),
	lora_rank: z.enum([ "16", "32" ]).default("16").transform(Number),
	finetune_type: z.enum(["lora", "full"]).default("lora")
})

// Submit training job directly to Replicate
async function submitToReplicate(
  replicateApiInput: z.infer<typeof trainingInputSchema>,
  webhookUrl: string,
  metadata: any
) {
  console.log(`[REPLICATE_SUBMITTER] Submitting to Replicate...`)
  console.log(`[REPLICATE_SUBMITTER] Input:`, replicateApiInput)
  console.log(`[REPLICATE_SUBMITTER] Webhook URL:`, webhookUrl)

  const prediction = await replicate.predictions.create({
    model: "black-forest-labs/flux-pro-trainer",
    input: replicateApiInput,
    webhook: webhookUrl,
    webhook_events_filter: ["start", "output", "logs", "completed"],
  })

  console.log(`[REPLICATE_SUBMITTER] Prediction created with ID: ${prediction.id}`)
  
  return {
    replicateJobId: prediction.id,
    status: prediction.status,
    prediction: prediction
  }
}

// Optimized version for direct upload (no file in FormData)
export async function startTrainingJobOptimized(data: {
  publicUrl: string
  storagePath: string
  originalFileName: string
  triggerWord: string
  captioning?: string
	trainingSteps?: string
}) {
  console.log("[TRAIN_ACTION_OPTIMIZED] Starting training job submission with pre-uploaded file...")

  const { publicUrl, storagePath, originalFileName, triggerWord, captioning = "automatic" } = data

  if (!publicUrl || !triggerWord) {
    return { success: false, error: "Missing required parameters." }
  }

  try {

    /* ---------- 1. Prepare Replicate API input ---------- */
    const replicateApiInputData = {
      input_images: publicUrl,
      trigger_word: triggerWord,
      captioning: captioning,
			training_steps: 149,
			mode: "style",
			lora_rank: 16,
			finetune_type: "lora"
    }
    
    const parsedReplicateInput = trainingInputSchema.safeParse(replicateApiInputData)
    if (!parsedReplicateInput.success) {
      console.error("[TRAIN_ACTION] Replicate input validation failed:", parsedReplicateInput.error.flatten())
      return { success: false, error: "Invalid input for Replicate API." }
    }

    /* ---------- 2. Determine webhook URL ---------- */
    let webhookUrl: string
    const tunnelUrl = process.env.REPLICATE_WEBHOOK_TUNNEL_URL

    if (process.env.NODE_ENV === "development" && tunnelUrl) {
      webhookUrl = `${tunnelUrl}/api/replicate-webhook`
      console.log(`[TRAIN_ACTION] Using tunnel webhook URL: ${webhookUrl}`)
    } else {
      const headersList = await headers()
      const host = headersList.get("host")
      if (!host) {
        throw new Error("Could not determine host for webhook URL and no tunnel URL is set.")
      }
      const protocol = host.startsWith("localhost") ? "http" : "https"
      const appUrl = `${protocol}://${host}`
      webhookUrl = `${appUrl}/api/replicate-webhook`
      console.log(`[TRAIN_ACTION] Using dynamic webhook URL: ${webhookUrl}`)
    }

    /* ---------- 3. Submit to Replicate ---------- */
    const metadata = {
      input_images_url: publicUrl,
      supabase_storage_path: storagePath,
      original_filename: originalFileName,
      trigger_word: triggerWord,
      captioning: captioning,
      upload_method: "optimized_direct"
    }

    const result = await submitToReplicate(parsedReplicateInput.data, webhookUrl, metadata)
    
    console.log(`[TRAIN_ACTION] Successfully submitted to Replicate. Job ID: ${result.replicateJobId}`)
    
    return { 
      success: true, 
      jobId: result.replicateJobId,
      status: result.status,
      message: "Training job submitted successfully. Database will be updated via webhook."
    }

  } catch (err: any) {
    console.error("[TRAIN_ACTION_OPTIMIZED] Error in startTrainingJobOptimized:", err)
    return { success: false, error: err.message || "Failed to start training job." }
  }
}

// Legacy version (keeping for backward compatibility, but with increased body limit)
export async function startTrainingJob(formData: FormData) {
  console.log("[TRAIN_ACTION_LEGACY] Starting training job submission (legacy method)...")

  const fileValue = formData.get("file")
  if (!isFileLike(fileValue) || fileValue.size === 0) {
    return { success: false, error: "A valid .zip dataset is required." }
  }
  const file = fileValue

  const triggerWord = formData.get("trigger_word") as string | null
  const captioningValue = (formData.get("captioning") as string | null) || "automatic"

  if (!triggerWord) {
    return { success: false, error: "Trigger word is required." }
  }

  try {
    /* ---------- 1. Upload dataset to Supabase ---------- */
    let storagePath: string
    let publicUrl: string

    try {
      const originalName = file.name
      const lastDot = originalName.lastIndexOf(".")
      const baseName = lastDot > -1 ? originalName.substring(0, lastDot) : originalName
      const extension = lastDot > -1 ? originalName.substring(lastDot + 1) : "zip"
      const sanitizedBaseName = baseName.replace(/\s+/g, "_")
      const uniqueId = uuidv4()
      const newFileName = `${sanitizedBaseName}-${uniqueId}.${extension}`
      storagePath = `public/${newFileName}`

      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: uploadErr, data: uploadData } = await supabaseAdmin.storage
        .from(SUPABASE_BUCKET_NAME)
        .upload(storagePath, buffer, { contentType: file.type || "application/zip", upsert: false })

      if (uploadErr) throw uploadErr
      if (!uploadData?.path) throw new Error("Supabase did not return a file path.")

      const { data: urlData } = supabaseAdmin.storage.from(SUPABASE_BUCKET_NAME).getPublicUrl(storagePath)
      if (!urlData?.publicUrl) throw new Error("Could not generate public URL for uploaded dataset.")
      publicUrl = urlData.publicUrl
      console.log(`[TRAIN_ACTION_LEGACY] Dataset uploaded to Supabase: ${publicUrl}`)
    } catch (err) {
      console.error("[TRAIN_ACTION_LEGACY] Supabase upload failed:", err)
      return { success: false, error: "Failed to upload dataset to Supabase. Check service keys & bucket." }
    }

    /* ---------- 2. Prepare Replicate API input ---------- */
    const replicateApiInputData = {
      input_images: publicUrl,
      trigger_word: triggerWord,
      captioning: captioningValue,
    }
    
    const parsedReplicateInput = trainingInputSchema.safeParse(replicateApiInputData)
    if (!parsedReplicateInput.success) {
      console.error("[TRAIN_ACTION_LEGACY] Replicate input validation failed:", parsedReplicateInput.error.flatten())
      return { success: false, error: "Invalid input for Replicate API." }
    }

    /* ---------- 3. Determine webhook URL ---------- */
    let webhookUrl: string
    const tunnelUrl = process.env.REPLICATE_WEBHOOK_TUNNEL_URL

    if (process.env.NODE_ENV === "development" && tunnelUrl) {
      webhookUrl = `${tunnelUrl}/api/replicate-webhook`
      console.log(`[TRAIN_ACTION_LEGACY] Using tunnel webhook URL: ${webhookUrl}`)
    } else {
      const headersList = await headers()
      const host = headersList.get("host")
      if (!host) {
        throw new Error("Could not determine host for webhook URL and no tunnel URL is set.")
      }
      const protocol = host.startsWith("localhost") ? "http" : "https"
      const appUrl = `${protocol}://${host}`
      webhookUrl = `${appUrl}/api/replicate-webhook`
      console.log(`[TRAIN_ACTION_LEGACY] Using dynamic webhook URL: ${webhookUrl}`)
    }

    /* ---------- 4. Submit to Replicate ---------- */
    const allInputParameters = Object.fromEntries(formData.entries())
    delete allInputParameters.file // Don't store the file object

    const metadata = {
      form_data: allInputParameters,
      input_images_url: publicUrl,
      supabase_storage_path: storagePath,
      original_filename: file.name,
      trigger_word: triggerWord,
      captioning: captioningValue,
      upload_method: "legacy_server_action"
    }

    const result = await submitToReplicate(parsedReplicateInput.data, webhookUrl, metadata)
    
    console.log(`[TRAIN_ACTION_LEGACY] Successfully submitted to Replicate. Job ID: ${result.replicateJobId}`)
    
    return { 
      success: true, 
      jobId: result.replicateJobId,
      status: result.status,
      message: "Training job submitted successfully. Database will be updated via webhook."
    }

  } catch (err: any) {
    console.error("[TRAIN_ACTION_LEGACY] Error in startTrainingJob:", err)
    return { success: false, error: err.message || "Failed to start training job." }
  }
}
