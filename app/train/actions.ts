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
  captioning: z.enum(["captioning-disabled", "automatic", "captioning-enabled"]).default("captioning-disabled"),
})

// This function will run in the background
async function submitToReplicateAndUpdateDb(
  ourInternalJobId: string,
  replicateApiInput: z.infer<typeof trainingInputSchema>,
  webhookUrl: string,
) {
  try {
    console.log(`[BG_REPLICATE_SUBMITTER] For DB Job ID ${ourInternalJobId}: Submitting to Replicate...`)
    console.log(`[BG_REPLICATE_SUBMITTER] Input:`, replicateApiInput)

    const jobOutput = await replicate.run("black-forest-labs/flux-pro-trainer", {
      input: replicateApiInput,
      webhook: webhookUrl,
      webhook_events_filter: ["start", "output", "logs", "completed"],
    })

    if (typeof jobOutput !== "string" || !jobOutput) {
      console.error(
        `[BG_REPLICATE_SUBMITTER] For DB Job ID ${ourInternalJobId}: Replicate did not return a valid job ID string. Output:`,
        jobOutput,
      )
      throw new Error("Replicate did not return a valid job ID for training.")
    }
    const replicateJobId = jobOutput
    console.log(
      `[BG_REPLICATE_SUBMITTER] For DB Job ID ${ourInternalJobId}: Replicate submission successful. Replicate Job ID: ${replicateJobId}`,
    )

    await supabaseAdmin
      .from("training_jobs")
      .update({
        replicate_job_id: replicateJobId,
        status: "SUBMITTED_TO_REPLICATE", // New status indicating successful submission
      })
      .eq("id", ourInternalJobId)
  } catch (error: any) {
    console.error(
      `[BG_REPLICATE_SUBMITTER] For DB Job ID ${ourInternalJobId}: Error submitting to Replicate or updating DB:`,
      error,
    )
    await supabaseAdmin
      .from("training_jobs")
      .update({
        status: "REPLICATE_SUBMISSION_FAILED",
        error_message: error.message || "Failed to submit job to Replicate.",
      })
      .eq("id", ourInternalJobId)
  }
}

export async function startTrainingJob(formData: FormData) {
  console.log("[TRAIN_ACTION] Initiated. Client will get immediate response after DB insert.")

  const fileValue = formData.get("file")
  if (!isFileLike(fileValue) || fileValue.size === 0) {
    return { success: false, error: "A valid .zip dataset is required." }
  }
  const file = fileValue

  const triggerWord = formData.get("trigger_word") as string | null
  const captioningValue = (formData.get("captioning") as string | null) || "captioning-disabled"

  if (!triggerWord) {
    return { success: false, error: "Trigger word is required." }
  }

  let ourInternalJobId: string
  let publicUrl: string // Needed for the background task

  try {
    /* ---------- 1. Upload dataset to Supabase ---------- */
    let storagePath: string
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
      publicUrl = urlData.publicUrl // Assign to outer scope variable
      console.log(`[TRAIN_ACTION] Dataset uploaded to Supabase: ${publicUrl}`)
    } catch (err) {
      console.error("[TRAIN_ACTION] Supabase upload failed:", err)
      return { success: false, error: "Failed to upload dataset to Supabase. Check service keys & bucket." }
    }

    /* ---------- 2. Create initial DB record ---------- */
    const allInputParameters = Object.fromEntries(formData.entries())
    delete allInputParameters.file // Don't store the file File object

    const { data: dbJob, error: dbErr } = await supabaseAdmin
      .from("training_jobs")
      .insert({
        status: "PENDING_REPLICATE_SUBMISSION", // Initial status
        replicate_job_id: null, // Will be filled by background task
        input_parameters: {
          form_data: allInputParameters,
          input_images_url: publicUrl, // Store the URL used for Replicate
          supabase_storage_path: storagePath,
          original_filename: file.name,
        },
        user_id: null,
      })
      .select("id")
      .single()

    if (dbErr) {
      console.error("[TRAIN_ACTION] DB insert error:", dbErr)
      throw new Error(`DB error: ${dbErr.message}`)
    }
    if (!dbJob || !dbJob.id) {
      console.error("[TRAIN_ACTION] DB insert failed to return ID:", dbJob)
      throw new Error("DB insert failed to return job ID.")
    }
    ourInternalJobId = dbJob.id
    console.log(
      `[TRAIN_ACTION] Initial DB record created. Job ID: ${ourInternalJobId}. Status: PENDING_REPLICATE_SUBMISSION`,
    )

    /* ---------- 3. Kick off Replicate submission in the background ---------- */
    // Prepare input for Replicate API
    const replicateApiInputData = {
      input_images: publicUrl,
      trigger_word: triggerWord,
      captioning: captioningValue,
    }
    const parsedReplicateInput = trainingInputSchema.safeParse(replicateApiInputData)
    if (!parsedReplicateInput.success) {
      console.error(
        "[TRAIN_ACTION] Replicate input validation failed (pre-background task):",
        parsedReplicateInput.error.flatten(),
      )
      await supabaseAdmin
        .from("training_jobs")
        .update({
          status: "INVALID_INPUT_FOR_REPLICATE",
          error_message: "Internal validation of Replicate input failed.",
        })
        .eq("id", ourInternalJobId)
      return { success: false, error: "Invalid input prepared for Replicate." }
    }

    // --- NEW WEBHOOK LOGIC ---
    let webhookUrl: string
    const tunnelUrl = process.env.REPLICATE_WEBHOOK_TUNNEL_URL

    if (process.env.NODE_ENV === "development" && tunnelUrl) {
      webhookUrl = `${tunnelUrl}/api/replicate-webhook`
      console.log(`[TRAIN_ACTION] Using tunnel URL for local development webhook: ${webhookUrl}`)
    } else {
      const headersList = headers()
      const host = headersList.get("host")
      if (!host) {
        throw new Error("Could not determine host for webhook URL and no tunnel URL is set.")
      }
      const protocol = host.startsWith("localhost") ? "http" : "https"
      const appUrl = `${protocol}://${host}`
      webhookUrl = `${appUrl}/api/replicate-webhook`
      console.log(`[TRAIN_ACTION] Using dynamic host-based webhook URL: ${webhookUrl}`)
    }
    // --- END NEW WEBHOOK LOGIC ---

    // Call the background function but DO NOT await it.
    submitToReplicateAndUpdateDb(ourInternalJobId, parsedReplicateInput.data, webhookUrl)
    console.log(
      `[TRAIN_ACTION] Background task to submit to Replicate for DB Job ID ${ourInternalJobId} has been initiated.`,
    )

    /* ---------- 4. Return immediately to client ---------- */
    return { success: true, jobId: ourInternalJobId }
  } catch (err: any) {
    console.error("[TRAIN_ACTION] Overall error in startTrainingJob:", err)
    return { success: false, error: err.message || "Failed to start training job submission." }
  }
}
