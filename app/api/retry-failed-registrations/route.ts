import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  isStoryConfigured,
  getSPGNftContract,
  mintAndRegisterIpAndMakeDerivative,
} from "@/lib/story-protocol"

export async function POST(request: NextRequest) {
  try {
    if (!isStoryConfigured()) {
      return NextResponse.json({ error: "Story Protocol not configured" }, { status: 400 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get("limit") || "5")
    const force = url.searchParams.get("force") === "true"
    const jobId = url.searchParams.get("job_id")

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    console.log(`🔄 [RETRY_REGISTRATION] Starting retry process (limit: ${limit}, force: ${force})`)

    let query = supabase
      .from("training_jobs")
      .select(
        `
        *,
        training_images (
          id,
          story_ip_id,
          story_registration_status,
          original_filename
        )
      `
      )
      .eq("status", "succeeded")
      .not("trigger_word", "is", null)
      .not("output_model_url", "is", null)

    // If specific job ID provided, only process that one
    if (jobId) {
      query = query.or(`id.eq.${jobId},replicate_job_id.eq.${jobId}`)
    } else {
      // Otherwise, find jobs that need retry
      if (force) {
        // Force mode: retry all successful jobs, even those with IP IDs
        query = query.limit(limit)
      } else {
        // Normal mode: only jobs without IP registration
        query = query.is("ip_id", null).limit(limit)
      }
    }

    const { data: jobsToRetry, error: queryError } = await query.order("completed_at", {
      ascending: false,
    })

    if (queryError) {
      console.error("❌ [RETRY_REGISTRATION] Error querying jobs:", queryError)
      return NextResponse.json({ error: "Database query failed" }, { status: 500 })
    }

    if (!jobsToRetry || jobsToRetry.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No jobs found for retry",
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      })
    }

    console.log(`📝 [RETRY_REGISTRATION] Found ${jobsToRetry.length} jobs to retry`)

    const results: any[] = []
    let succeeded = 0
    let failed = 0

    for (const job of jobsToRetry) {
      console.log(`\n🔄 [RETRY_REGISTRATION] Processing job ${job.id} (${job.trigger_word})`)

      try {
        // Simulate the webhook registration process
        const result = await simulateWebhookRegistration(job, supabase, force)
        results.push(result)

        if (result.success) {
          succeeded++
          console.log(`✅ [RETRY_REGISTRATION] Successfully registered: ${job.trigger_word}`)
        } else {
          failed++
          console.log(
            `❌ [RETRY_REGISTRATION] Failed to register: ${job.trigger_word} - ${result.error}`
          )
        }
      } catch (error) {
        console.error(`❌ [RETRY_REGISTRATION] Exception processing job ${job.id}:`, error)
        results.push({
          jobId: job.id,
          replicateJobId: job.replicate_job_id,
          triggerWord: job.trigger_word,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          retryAttempt: true,
        })
        failed++
      }

      // Add delay between retries to avoid overwhelming the system
      if (results.length < jobsToRetry.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    console.log(`\n🎉 [RETRY_REGISTRATION] Completed: ${succeeded} succeeded, ${failed} failed`)

    return NextResponse.json({
      success: true,
      message: `Retry registration completed`,
      processed: results.length,
      succeeded,
      failed,
      results,
    })
  } catch (error) {
    console.error("❌ [RETRY_REGISTRATION] Error in retry process:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Simulate the webhook registration process with enhanced logic
async function simulateWebhookRegistration(job: any, supabase: any, force: boolean = false) {
  const replicateJobId = job.replicate_job_id
  const triggerWord = job.trigger_word

  try {
    console.log(`📝 [WEBHOOK_SIMULATION] Starting registration for job: ${replicateJobId}`)

    // Check if already registered (unless force mode)
    if (job.ip_id && !force) {
      return {
        jobId: job.id,
        replicateJobId,
        triggerWord,
        success: true,
        message: "Already registered",
        ipId: job.ip_id,
        skipped: true,
      }
    }

    // Get registered training image IP assets - handle both flows
    let registeredImageIPs: string[] = []

    // Flow 1: Individual images uploaded via /train page (stored in training_images table)
    const trainingImageIPs =
      job.training_images
        ?.filter((img: any) => img.story_ip_id && img.story_registration_status === "registered")
        ?.map((img: any) => img.story_ip_id) || []

    // Flow 2: Assets from /assets page (stored in story_parent_ip_ids)
    const parentIPs = job.story_parent_ip_ids || []

    if (trainingImageIPs.length > 0) {
      registeredImageIPs = trainingImageIPs
      console.log(
        `📝 [WEBHOOK_SIMULATION] Using training images flow: ${registeredImageIPs.length} IPs`
      )
    } else if (parentIPs.length > 0) {
      registeredImageIPs = parentIPs
      console.log(`📝 [WEBHOOK_SIMULATION] Using assets flow: ${registeredImageIPs.length} IPs`)
    }

    console.log(`📝 [WEBHOOK_SIMULATION] Flow analysis:`, {
      trainingImagesFlow: trainingImageIPs.length,
      assetsFlow: parentIPs.length,
      trainingImagesCount: job.training_images?.length || 0,
      hasParentIPs: !!job.story_parent_ip_ids,
      selectedFlow: trainingImageIPs.length > 0 ? "training_images" : "assets",
      registeredImageIPsCount: registeredImageIPs.length,
    })

    // AI models must ALWAYS be derivatives of parent IP assets
    if (registeredImageIPs.length === 0) {
      console.error(
        `❌ [WEBHOOK_SIMULATION] No parent IP assets found for derivative registration.`
      )
      return {
        jobId: job.id,
        replicateJobId,
        triggerWord,
        success: false,
        error: "No parent IP assets found for derivative registration",
        details: {
          trainingImagesFlow: trainingImageIPs.length,
          assetsFlow: parentIPs.length,
          trainingImagesCount: job.training_images?.length || 0,
          hasParentIPs: !!job.story_parent_ip_ids,
        },
      }
    }

    // Create metadata for the trained model
    const modelMetadata = {
      title: `AI Model: ${triggerWord}`,
      description: `AI model trained on ${
        job.training_images?.length || 0
      } images. Trigger word: ${triggerWord}. Generated using ${
        job.captioning || "automatic"
      } captioning with ${job.training_steps || 300} training steps.`,
      ipType: "model" as const,
      attributes: [
        {
          trait_type: "Model Type",
          value: "AI Training Model",
        },
        {
          trait_type: "Trigger Word",
          value: triggerWord,
        },
        {
          trait_type: "Training Steps",
          value: (job.training_steps || 300).toString(),
        },
        {
          trait_type: "Captioning",
          value: job.captioning || "automatic",
        },
        {
          trait_type: "Training Images Count",
          value: (job.training_images?.length || 0).toString(),
        },
        {
          trait_type: "Replicate Job ID",
          value: replicateJobId,
        },
      ],
    }

    const spgContract = getSPGNftContract()

    console.log(
      `🔗 [WEBHOOK_SIMULATION] Registering AI model as derivative of ${registeredImageIPs.length} parent IP assets`
    )

    // Register model as derivative using the direct license terms approach
    const modelResult = await mintAndRegisterIpAndMakeDerivative({
      spgNftContract: spgContract,
      parentIpIds: registeredImageIPs,
      licenseTermsId: "1", // Use default license terms
      metadata: modelMetadata,
    })

    console.log(`🔗 [WEBHOOK_SIMULATION] Derivative registration result:`, {
      success: modelResult.success,
      ipId: modelResult.ipId,
      txHash: modelResult.txHash,
      error: modelResult.error,
      parentCount: registeredImageIPs.length,
    })

    if (!modelResult.success) {
      console.error(
        `❌ [WEBHOOK_SIMULATION] Failed to register AI model as derivative:`,
        modelResult.error
      )
      return {
        jobId: job.id,
        replicateJobId,
        triggerWord,
        success: false,
        error: modelResult.error,
        parentIPCount: registeredImageIPs.length,
      }
    }

    console.log(
      `✅ [WEBHOOK_SIMULATION] Successfully registered AI model as derivative IP: ${modelResult.ipId}`
    )

    // Update training job with model IP information
    const updateData: any = {
      ip_id: modelResult.ipId,
      story_model_tx_hash: modelResult.txHash,
      story_parent_ip_ids: registeredImageIPs,
    }

    console.log(`💾 [WEBHOOK_SIMULATION] Updating database with IP information:`, updateData)

    const { error: updateError } = await supabase
      .from("training_jobs")
      .update(updateData)
      .eq("replicate_job_id", replicateJobId)

    if (updateError) {
      console.error(
        `❌ [WEBHOOK_SIMULATION] Error updating training job with model IP:`,
        updateError
      )
      return {
        jobId: job.id,
        replicateJobId,
        triggerWord,
        success: false,
        error: `Database update failed: ${updateError.message}`,
        ipId: modelResult.ipId,
        txHash: modelResult.txHash,
      }
    }

    console.log(
      `✅ [WEBHOOK_SIMULATION] Updated training job ${replicateJobId} with model IP: ${modelResult.ipId}`
    )

    return {
      jobId: job.id,
      replicateJobId,
      triggerWord,
      success: true,
      ipId: modelResult.ipId,
      txHash: modelResult.txHash,
      parentIPCount: registeredImageIPs.length,
      flow: trainingImageIPs.length > 0 ? "training_images" : "assets",
      wasForced: force && !!job.ip_id,
    }
  } catch (error: any) {
    console.error("❌ [WEBHOOK_SIMULATION] Error in webhook simulation:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })

    return {
      jobId: job.id,
      replicateJobId,
      triggerWord,
      success: false,
      error: error.message || "Unknown error during registration",
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    // Get analysis of models that might need retry
    const { data: allJobs, error } = await supabase
      .from("training_jobs")
      .select(
        "id, replicate_job_id, trigger_word, completed_at, status, ip_id, story_parent_ip_ids"
      )
      .eq("status", "succeeded")
      .not("trigger_word", "is", null)
      .not("output_model_url", "is", null)
      .order("completed_at", { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: "Query failed" }, { status: 500 })
    }

    const unregistered = allJobs?.filter((job) => !job.ip_id) || []
    const registered = allJobs?.filter((job) => job.ip_id) || []
    const withParentIPs = allJobs?.filter((job) => job.story_parent_ip_ids?.length > 0) || []

    return NextResponse.json({
      total: allJobs?.length || 0,
      registered: registered.length,
      unregistered: unregistered.length,
      withParentIPs: withParentIPs.length,
      unregisteredJobs: unregistered.slice(0, 20), // Show first 20 for review
      analysis: {
        successfulJobs: allJobs?.length || 0,
        registrationRate: allJobs?.length
          ? ((registered.length / allJobs.length) * 100).toFixed(1) + "%"
          : "0%",
        needsRetry: unregistered.length,
        hasParentIPsButNoRegistration: unregistered.filter(
          (job) => job.story_parent_ip_ids?.length > 0
        ).length,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
