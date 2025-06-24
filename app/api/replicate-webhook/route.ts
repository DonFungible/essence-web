import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  // Use service role key for webhooks (no user session needed)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  console.log("🔓 Processing webhook without signature verification (internal/local use)")

  // Parse the request body
  let body: any
  try {
    body = await req.json()
  } catch (error) {
    console.error("❌ Error parsing webhook body:", error)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  console.log("📨 Received Replicate webhook:", {
    id: body.id,
    status: body.status,
    hasOutput: !!body.output,
    hasError: !!body.error,
    hasLogs: !!body.logs,
  })

  const {
    id: replicateJobId,
    status,
    output,
    error: replicateError,
    logs,
    metrics,
    input,
    completed_at,
    started_at,
  } = body

  if (!replicateJobId) {
    console.error("❌ Webhook missing Replicate Job ID")
    console.log("Webhook body structure:", Object.keys(body))
    return NextResponse.json({ error: "Missing Replicate Job ID" }, { status: 400 })
  }

  console.log(`🔄 Processing webhook for job ${replicateJobId} with status: ${status}`)

  try {
    // Prepare the base data for insert/update
    const jobData: any = {
      replicate_job_id: replicateJobId,
      status: status,
      logs: logs ? (typeof logs === "string" ? logs : JSON.stringify(logs)) : null,
    }

    // Add timing data if available
    if (completed_at) {
      jobData.completed_at = completed_at
    }
    if (started_at) {
      jobData.started_at = started_at
    }
    if (metrics) {
      if (metrics.predict_time) {
        jobData.predict_time = metrics.predict_time
      }
      if (metrics.total_time) {
        jobData.total_time = metrics.total_time
      }
    }

    // Handle different status types and add relevant data
    if (status === "succeeded" && output) {
      jobData.output_model_url = Array.isArray(output) ? output.join("\n") : String(output)

      // Store training input parameters for successful jobs
      if (input) {
        jobData.input_images_url = input.input_images || null
        jobData.trigger_word = input.trigger_word || null
        jobData.captioning = input.captioning || null
        jobData.training_steps = input.steps || input.training_steps || null

        console.log(`✅ Job ${replicateJobId} succeeded with output and training inputs:`, {
          trigger_word: input.trigger_word,
          input_images: input.input_images,
          captioning: input.captioning,
          steps: input.steps || input.training_steps,
        })

        // Extract style images for visual reference (non-blocking)
        if (input.input_images && input.trigger_word) {
          console.log(`🖼️ Starting style image extraction for trigger word: ${input.trigger_word}`)

          // Determine the base URL for API calls
          let apiBaseUrl: string
          const tunnelUrl = process.env.REPLICATE_WEBHOOK_TUNNEL_URL
          if (process.env.NODE_ENV === "development" && tunnelUrl) {
            apiBaseUrl = tunnelUrl
          } else {
            // For production, use the site URL or construct it
            apiBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com"
          }

          // Call style image extraction API (fire and forget)
          fetch(`${apiBaseUrl}/api/extract-style-images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              zipUrl: input.input_images,
              triggerWord: input.trigger_word,
              maxImages: 4,
              jobId: replicateJobId,
            }),
          })
            .then((response) => response.json())
            .then((result) => {
              if (result.success) {
                console.log(
                  `✅ Style image extraction completed for ${input.trigger_word}: ${result.totalExtracted} images`
                )
              } else {
                console.error(
                  `⚠️ Style image extraction failed for ${input.trigger_word}:`,
                  result.error
                )
              }
            })
            .catch((error) => {
              console.error(
                `⚠️ Style image extraction request failed for ${input.trigger_word}:`,
                error
              )
            })
        }
      } else {
        console.log(`✅ Job ${replicateJobId} succeeded with output (no input data in webhook)`)
      }
    } else if (status === "failed" && replicateError) {
      jobData.error_message =
        typeof replicateError === "string" ? replicateError : JSON.stringify(replicateError)
      console.log(`❌ Job ${replicateJobId} failed:`, replicateError)
    } else if (status === "processing") {
      console.log(`⏳ Job ${replicateJobId} is processing...`)
    } else if (status === "starting") {
      console.log(`🚀 Job ${replicateJobId} is starting...`)
    }

    let jobRecord: any
    let action: string

    if (status === "starting") {
      // First webhook: CREATE new record
      console.log(`📝 Creating new database record for job ${replicateJobId} (starting)`)

      // Add additional fields for new records
      jobData.input_parameters = {
        created_via_webhook: true,
        initial_status: status,
        created_at: new Date().toISOString(),
      }
      jobData.user_id = null

      // Use upsert to handle potential race conditions
      const { data: newJob, error: createError } = await supabase
        .from("training_jobs")
        .upsert(jobData, {
          onConflict: "replicate_job_id",
          ignoreDuplicates: false,
        })
        .select()
        .single()

      if (createError) {
        console.error(`❌ Database error creating job ${replicateJobId}:`, createError)
        return NextResponse.json({ error: "Database creation failed" }, { status: 500 })
      }

      jobRecord = newJob
      action = "created"
      console.log(`✅ Created database record for job ${replicateJobId}`)
    } else {
      // Subsequent webhooks: UPDATE existing record
      console.log(`📝 Updating existing database record for job ${replicateJobId} (${status})`)

      // Check current status to prevent duplicate processing webhooks
      const { data: currentJob, error: fetchError } = await supabase
        .from("training_jobs")
        .select("status")
        .eq("replicate_job_id", replicateJobId)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error(`❌ Error fetching current status for job ${replicateJobId}:`, fetchError)
        return NextResponse.json({ error: "Database fetch failed" }, { status: 500 })
      }

      // Ignore duplicate "processing" webhooks - only process the first one
      if (currentJob && currentJob.status === "processing" && status === "processing") {
        console.log(`⚠️ Ignoring duplicate processing webhook for job ${replicateJobId}`)
        return NextResponse.json(
          {
            message: "Ignored duplicate processing webhook",
            jobId: replicateJobId,
            currentStatus: currentJob.status,
            attemptedStatus: status,
            action: "ignored",
          },
          { status: 200 }
        )
      }

      // Also ignore any webhooks that try to go back to processing from final states
      const finalStates = ["succeeded", "failed", "canceled"]
      if (currentJob && finalStates.includes(currentJob.status) && status === "processing") {
        console.log(
          `⚠️ Ignoring processing webhook after final state for job ${replicateJobId}: ${currentJob.status} -> ${status}`
        )
        return NextResponse.json(
          {
            message: "Ignored processing webhook after final state",
            jobId: replicateJobId,
            currentStatus: currentJob.status,
            attemptedStatus: status,
            action: "ignored",
          },
          { status: 200 }
        )
      }

      const { data: updatedJob, error: updateError } = await supabase
        .from("training_jobs")
        .update(jobData)
        .eq("replicate_job_id", replicateJobId)
        .select()
        .single()

      if (updateError) {
        console.error(`❌ Database error updating job ${replicateJobId}:`, updateError)

        // If update fails because record doesn't exist, create it
        if (updateError.code === "PGRST116") {
          console.log(`🔄 Record not found, creating new record for job ${replicateJobId}`)

          jobData.input_parameters = {
            created_via_webhook: true,
            initial_status: status,
            created_at: new Date().toISOString(),
            created_on_missing_record: true,
          }
          jobData.user_id = null

          const { data: newJob, error: createError } = await supabase
            .from("training_jobs")
            .insert(jobData)
            .select()
            .single()

          if (createError) {
            console.error(`❌ Database error creating missing job ${replicateJobId}:`, createError)
            return NextResponse.json({ error: "Database creation failed" }, { status: 500 })
          }

          jobRecord = newJob
          action = "created (missing record)"
          console.log(`✅ Created missing database record for job ${replicateJobId}`)
        } else {
          return NextResponse.json({ error: "Database update failed" }, { status: 500 })
        }
      } else {
        jobRecord = updatedJob
        action = "updated"
        console.log(`✅ Updated database record for job ${replicateJobId}`)
      }
    }

    console.log(
      `✅ Successfully processed webhook for job ${replicateJobId} with status: ${status}`
    )
    return NextResponse.json(
      {
        message: "Webhook received and processed successfully",
        jobId: replicateJobId,
        status: status,
        action: action,
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error(`💥 Unexpected error processing webhook for job ${replicateJobId}:`, err)
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    })
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 }
    )
  }
}
