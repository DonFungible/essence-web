import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { description, preview_image_url } = body

    // Validate that at least one field is provided
    if (!description && !preview_image_url) {
      return NextResponse.json(
        { error: "Either description or preview_image_url must be provided" },
        { status: 400 }
      )
    }

    // Validate description if provided
    if (description !== undefined && typeof description !== "string") {
      return NextResponse.json({ error: "Description must be a string" }, { status: 400 })
    }

    if (description && description.length > 2000) {
      return NextResponse.json(
        { error: "Description must be less than 2000 characters" },
        { status: 400 }
      )
    }

    // Validate preview_image_url if provided
    if (preview_image_url !== undefined) {
      if (typeof preview_image_url !== "string") {
        return NextResponse.json({ error: "Preview image URL must be a string" }, { status: 400 })
      }

      // Validate URL format (basic check)
      if (preview_image_url.trim()) {
        try {
          new URL(preview_image_url)
        } catch {
          return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
        }
      }
    }

    // Create Supabase client
    const supabase = await createClient()

    // Prepare update data
    const updateData: any = {}
    if (description !== undefined) {
      updateData.description = description.trim() || null
    }
    if (preview_image_url !== undefined) {
      updateData.preview_image_url = preview_image_url.trim() || null
    }

    // Update the model in the database
    // The id could be either the database id or replicate_job_id
    let data, error

    // Try updating by replicate_job_id first (most common case)
    const { data: updateByReplicateId, error: replicateIdError } = await supabase
      .from("training_jobs")
      .update(updateData)
      .eq("replicate_job_id", id)
      .select()
      .single()

    if (replicateIdError && replicateIdError.code === "PGRST116") {
      // Record not found, try by database id
      const { data: updateByDbId, error: dbIdError } = await supabase
        .from("training_jobs")
        .update(updateData)
        .eq("id", id)
        .select()
        .single()

      data = updateByDbId
      error = dbIdError
    } else {
      data = updateByReplicateId
      error = replicateIdError
    }

    if (error) {
      console.error("Database error:", error)

      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Model not found" }, { status: 404 })
      }

      return NextResponse.json({ error: "Failed to update model" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params

    // Create Supabase client
    const supabase = await createClient()

    // Get the model from the database
    // Try by replicate_job_id first, then by database id
    let data, error

    const { data: getByReplicateId, error: replicateIdError } = await supabase
      .from("training_jobs")
      .select("*")
      .eq("replicate_job_id", id)
      .single()

    if (replicateIdError && replicateIdError.code === "PGRST116") {
      // Record not found, try by database id
      const { data: getByDbId, error: dbIdError } = await supabase
        .from("training_jobs")
        .select("*")
        .eq("id", id)
        .single()

      data = getByDbId
      error = dbIdError
    } else {
      data = getByReplicateId
      error = replicateIdError
    }

    if (error) {
      console.error("Database error:", error)

      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Model not found" }, { status: 404 })
      }

      return NextResponse.json({ error: "Failed to fetch model" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data,
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
