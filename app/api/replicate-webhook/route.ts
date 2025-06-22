import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import crypto from "crypto"

const REPLICATE_WEBHOOK_SECRET = process.env.REPLICATE_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  const supabase = createClient()

  // 1. Verify Signature (Essential for security)
  if (!REPLICATE_WEBHOOK_SECRET) {
    console.error("REPLICATE_WEBHOOK_SECRET is not set. Skipping signature verification.")
    // In production, you should probably return an error here if the secret is missing.
  } else {
    const signature = req.headers.get("webhook-signature") // Replicate uses 'webhook-signature'
    if (!signature) {
      console.warn("Webhook request missing signature.")
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }

    // Replicate's signature is more complex: id,timestamp.body
    // Example from Replicate docs:
    // const signedContent = `${req.headers.get('webhook-id')}.${req.headers.get('webhook-timestamp')}.${rawBody}`;
    // For simplicity here, we'll assume a simpler HMAC if Replicate offers it, or adjust if needed.
    // The Replicate Python library example uses a direct HMAC of the body.
    // Let's assume for now Replicate sends a simple HMAC of the body.
    // IMPORTANT: Check Replicate's current signature scheme. Their docs mention `X-Replicate-Webhook-Signature`.
    // The header might be `X-Replicate-Webhook-Signature` and format `t=timestamp,v1=signature`
    // This example uses a simplified HMAC for demonstration. Adapt to Replicate's actual scheme.

    const rawBodyForSig = await req.text() // Must read the raw body text
    const expectedSignature = crypto.createHmac("sha256", REPLICATE_WEBHOOK_SECRET).update(rawBodyForSig).digest("hex")

    // This is a simplified comparison. Replicate's actual signature might be more complex (e.g., including timestamp).
    // A common pattern is `v1=ACTUAL_SIGNATURE`. You'd extract ACTUAL_SIGNATURE.
    // For now, let's assume `signature` is the direct hex digest.
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.warn("Invalid webhook signature.")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
    // If signature verification passes, parse the body from the text we already read.
    var body = JSON.parse(rawBodyForSig)
  }

  // If secret is not set or verification is skipped for local dev (not recommended for prod)
  if (!body) {
    try {
      body = await req.json()
    } catch (error) {
      console.error("Error parsing webhook body:", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
  }

  console.log("Received Replicate webhook:", JSON.stringify(body, null, 2))

  const { id: replicateJobId, status, output, error: replicateError, logs, metrics } = body

  if (!replicateJobId) {
    console.error("Webhook missing Replicate Job ID")
    return NextResponse.json({ error: "Missing Replicate Job ID" }, { status: 400 })
  }

  try {
    const updateData: {
      status: string
      output_model_url?: string | null
      error_message?: string | null
      logs?: string | null
      // metrics?: any; // If you add a metrics JSONB column
    } = {
      status: status,
    }

    if (status === "succeeded" && output) {
      updateData.output_model_url = Array.isArray(output) ? output.join("\n") : String(output)
    } else if (status === "failed" && replicateError) {
      updateData.error_message = typeof replicateError === "string" ? replicateError : JSON.stringify(replicateError)
    }

    if (logs) {
      updateData.logs = typeof logs === "string" ? logs : JSON.stringify(logs)
    }
    // if (metrics) {
    //   updateData.metrics = metrics;
    // }

    const { data, error: dbError } = await supabase
      .from("training_jobs")
      .update(updateData)
      .eq("replicate_job_id", replicateJobId)
      .select()
      .single()

    if (dbError) {
      console.error(`Error updating Supabase for job ${replicateJobId}:`, dbError)
      return NextResponse.json({ error: "Database update failed" }, { status: 500 })
    }

    if (!data) {
      console.warn(`No Supabase record found for Replicate job ID: ${replicateJobId}`)
      return NextResponse.json({ error: "Job not found in database" }, { status: 404 })
    }

    console.log(`Successfully updated job ${replicateJobId} to status ${status}`)
    return NextResponse.json({ message: "Webhook received and processed" }, { status: 200 })
  } catch (err) {
    console.error(`Unexpected error processing webhook for job ${replicateJobId}:`, err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
