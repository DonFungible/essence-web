import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  // Use service role key for webhooks (no user session needed)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false }
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
    hasLogs: !!body.logs
  })

  const { id: replicateJobId, status, output, error: replicateError, logs, metrics } = body

  if (!replicateJobId) {
    console.error("❌ Webhook missing Replicate Job ID")
    console.log("Webhook body structure:", Object.keys(body))
    return NextResponse.json({ error: "Missing Replicate Job ID" }, { status: 400 })
  }

  console.log(`🔄 Processing webhook for job ${replicateJobId} with status: ${status}`)

  try {
    // Check if record exists
    const { data: existingJob } = await supabase
      .from("training_jobs")
      .select("*")
      .eq("replicate_job_id", replicateJobId)
      .single()

    let jobRecord: any

    if (!existingJob) {
      // Create new record if this is the first webhook for this job
      console.log(`📝 Creating new database record for job ${replicateJobId}`)
      
      const { data: newJob, error: createError } = await supabase
        .from("training_jobs")
        .insert({
          replicate_job_id: replicateJobId,
          status: status,
          input_parameters: {
            // We'll store basic info, full metadata can be added later if needed
            created_via_webhook: true,
            initial_status: status,
            created_at: new Date().toISOString()
          },
          logs: logs ? (typeof logs === "string" ? logs : JSON.stringify(logs)) : null,
          user_id: null,
        })
        .select()
        .single()

      if (createError) {
        console.error(`❌ Database error creating job ${replicateJobId}:`, createError)
        return NextResponse.json({ error: "Database creation failed" }, { status: 500 })
      }

      jobRecord = newJob
      console.log(`✅ Created new database record for job ${replicateJobId}`)
    } else {
      // Update existing record
      console.log(`📝 Updating existing database record for job ${replicateJobId}`)
      
      const updateData: {
        status: string
        output_model_url?: string | null
        error_message?: string | null
        logs?: string | null
      } = {
        status: status,
      }

      // Handle different status types
      if (status === "succeeded" && output) {
        updateData.output_model_url = Array.isArray(output) ? output.join("\n") : String(output)
        console.log(`✅ Job ${replicateJobId} succeeded with output`)
      } else if (status === "failed" && replicateError) {
        updateData.error_message = typeof replicateError === "string" ? replicateError : JSON.stringify(replicateError)
        console.log(`❌ Job ${replicateJobId} failed:`, replicateError)
      } else if (status === "processing") {
        console.log(`⏳ Job ${replicateJobId} is processing...`)
      } else if (status === "starting") {
        console.log(`🚀 Job ${replicateJobId} is starting...`)
      }

      // Always update logs if present
      if (logs) {
        updateData.logs = typeof logs === "string" ? logs : JSON.stringify(logs)
      }

      const { data: updatedJob, error: updateError } = await supabase
        .from("training_jobs")
        .update(updateData)
        .eq("replicate_job_id", replicateJobId)
        .select()
        .single()

      if (updateError) {
        console.error(`❌ Database error updating job ${replicateJobId}:`, updateError)
        return NextResponse.json({ error: "Database update failed" }, { status: 500 })
      }

      jobRecord = updatedJob
      console.log(`✅ Updated database record for job ${replicateJobId}`)
    }

    console.log(`✅ Successfully processed webhook for job ${replicateJobId} with status: ${status}`)
    return NextResponse.json({ 
      message: "Webhook received and processed successfully",
      jobId: replicateJobId,
      status: status,
      action: existingJob ? "updated" : "created"
    }, { status: 200 })

  } catch (err: any) {
    console.error(`💥 Unexpected error processing webhook for job ${replicateJobId}:`, err)
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    })
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 })
  }
}
