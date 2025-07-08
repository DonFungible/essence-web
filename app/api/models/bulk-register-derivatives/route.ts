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

    // Parse query parameters for filtering
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get("limit") || "10")
    const dryRun = url.searchParams.get("dry_run") === "true"
    const maxAge = url.searchParams.get("max_age") || "7" // days

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    console.log(
      `🔄 [BULK_REGISTRATION] Starting bulk registration (limit: ${limit}, dry_run: ${dryRun})`
    )

    // Find successful training jobs without IP registration
    const maxAgeDate = new Date()
    maxAgeDate.setDate(maxAgeDate.getDate() - parseInt(maxAge))

    const { data: unregisteredJobs, error: queryError } = await supabase
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
      .is("ip_id", null)
      .not("trigger_word", "is", null)
      .not("output_model_url", "is", null)
      .gte("completed_at", maxAgeDate.toISOString())
      .order("completed_at", { ascending: false })
      .limit(limit)

    if (queryError) {
      console.error("❌ [BULK_REGISTRATION] Error querying unregistered jobs:", queryError)
      return NextResponse.json({ error: "Database query failed" }, { status: 500 })
    }

    if (!unregisteredJobs || unregisteredJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unregistered models found",
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      })
    }

    console.log(`📝 [BULK_REGISTRATION] Found ${unregisteredJobs.length} unregistered models`)

    if (dryRun) {
      // Return what would be processed without actually doing it
      const analysis = unregisteredJobs.map((job) => {
        // Check if has parent IPs from either flow
        const trainingImageIPs =
          job.training_images
            ?.filter(
              (img: any) => img.story_ip_id && img.story_registration_status === "registered"
            )
            ?.map((img: any) => img.story_ip_id) || []
        const parentIPs = job.story_parent_ip_ids || []
        const hasParentIPs = trainingImageIPs.length > 0 || parentIPs.length > 0

        return {
          id: job.id,
          replicate_job_id: job.replicate_job_id,
          trigger_word: job.trigger_word,
          completed_at: job.completed_at,
          hasParentIPs,
          parentIPCount: trainingImageIPs.length + parentIPs.length,
          flow: trainingImageIPs.length > 0 ? "training_images" : "assets",
          canRegister: hasParentIPs,
        }
      })

      return NextResponse.json({
        success: true,
        message: "Dry run completed",
        total: unregisteredJobs.length,
        analysis,
        canRegister: analysis.filter((a) => a.canRegister).length,
        cannotRegister: analysis.filter((a) => !a.canRegister).length,
      })
    }

    // Process each unregistered job
    const results: any[] = []
    let succeeded = 0
    let failed = 0

    for (const job of unregisteredJobs) {
      console.log(`\n🔄 [BULK_REGISTRATION] Processing job ${job.id} (${job.trigger_word})`)

      try {
        const result = await registerSingleJob(job, supabase)
        results.push(result)

        if (result.success) {
          succeeded++
          console.log(`✅ [BULK_REGISTRATION] Successfully registered: ${job.trigger_word}`)
        } else {
          failed++
          console.log(
            `❌ [BULK_REGISTRATION] Failed to register: ${job.trigger_word} - ${result.error}`
          )
        }
      } catch (error) {
        console.error(`❌ [BULK_REGISTRATION] Exception processing job ${job.id}:`, error)
        results.push({
          jobId: job.id,
          replicateJobId: job.replicate_job_id,
          triggerWord: job.trigger_word,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
        failed++
      }

      // Add delay between registrations to avoid rate limiting
      if (results.length < unregisteredJobs.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    console.log(`\n🎉 [BULK_REGISTRATION] Completed: ${succeeded} succeeded, ${failed} failed`)

    return NextResponse.json({
      success: true,
      message: `Bulk registration completed`,
      total: unregisteredJobs.length,
      processed: results.length,
      succeeded,
      failed,
      results,
    })
  } catch (error) {
    console.error("❌ [BULK_REGISTRATION] Error in bulk registration:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Helper function to register a single job
async function registerSingleJob(job: any, supabase: any) {
  const jobId = job.id
  const triggerWord = job.trigger_word

  try {
    // Get registered parent IP assets - handle both flows
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
        `📝 [BULK_REGISTRATION] Using training images flow: ${registeredImageIPs.length} IPs`
      )
    } else if (parentIPs.length > 0) {
      registeredImageIPs = parentIPs
      console.log(`📝 [BULK_REGISTRATION] Using assets flow: ${registeredImageIPs.length} IPs`)
    }

    if (registeredImageIPs.length === 0) {
      return {
        jobId,
        replicateJobId: job.replicate_job_id,
        triggerWord,
        success: false,
        error: "No parent IP assets found",
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
          value: job.replicate_job_id,
        },
      ],
    }

    const spgContract = getSPGNftContract()

    console.log(
      `🔗 [BULK_REGISTRATION] Registering as derivative of ${registeredImageIPs.length} parent IPs`
    )

    // Register model as derivative
    const modelResult = await mintAndRegisterIpAndMakeDerivative({
      spgNftContract: spgContract,
      parentIpIds: registeredImageIPs,
      licenseTermsId: "1",
      metadata: modelMetadata,
    })

    if (!modelResult.success) {
      return {
        jobId,
        replicateJobId: job.replicate_job_id,
        triggerWord,
        success: false,
        error: modelResult.error,
        parentIPCount: registeredImageIPs.length,
      }
    }

    // Update database with model IP information
    const updateData = {
      ip_id: modelResult.ipId,
      story_model_tx_hash: modelResult.txHash,
      story_parent_ip_ids: registeredImageIPs,
    }

    const { error: updateError } = await supabase
      .from("training_jobs")
      .update(updateData)
      .eq("id", jobId)

    if (updateError) {
      console.error(`❌ [BULK_REGISTRATION] Database update error for job ${jobId}:`, updateError)
      return {
        jobId,
        replicateJobId: job.replicate_job_id,
        triggerWord,
        success: false,
        error: `Model registered but database update failed: ${updateError.message}`,
        ipId: modelResult.ipId,
        txHash: modelResult.txHash,
      }
    }

    return {
      jobId,
      replicateJobId: job.replicate_job_id,
      triggerWord,
      success: true,
      ipId: modelResult.ipId,
      txHash: modelResult.txHash,
      parentIPCount: registeredImageIPs.length,
      flow: trainingImageIPs.length > 0 ? "training_images" : "assets",
    }
  } catch (error) {
    console.error(`❌ [BULK_REGISTRATION] Error registering job ${jobId}:`, error)
    return {
      jobId,
      replicateJobId: job.replicate_job_id,
      triggerWord,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
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

    // Get summary of unregistered models
    const { data: summary, error } = await supabase
      .from("training_jobs")
      .select("id, replicate_job_id, trigger_word, completed_at, story_parent_ip_ids")
      .eq("status", "succeeded")
      .is("ip_id", null)
      .not("trigger_word", "is", null)
      .not("output_model_url", "is", null)
      .order("completed_at", { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: "Query failed" }, { status: 500 })
    }

    return NextResponse.json({
      total: summary?.length || 0,
      unregisteredModels: summary || [],
      message: summary?.length
        ? `Found ${summary.length} models that need IP registration`
        : "All models are registered",
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
