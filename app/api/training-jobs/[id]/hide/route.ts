import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { id } = params

    if (!id) {
      return NextResponse.json({ error: "Training job ID is required" }, { status: 400 })
    }

    console.log(`🗑️ Hiding training job: ${id}`)

    // Update the training job to set is_hidden = true
    const { data, error } = await supabase
      .from("training_jobs")
      .update({
        is_hidden: true,
        hidden_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error hiding training job:", error)
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Training job not found" }, { status: 404 })
      }
      return NextResponse.json({ error: "Failed to hide training job" }, { status: 500 })
    }

    console.log(`✅ Successfully hidden training job: ${id}`)

    return NextResponse.json({
      success: true,
      message: "Training job hidden successfully",
      data: data,
    })
  } catch (error: any) {
    console.error("Unexpected error hiding training job:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // Alias DELETE to POST for consistent behavior
  return POST(req, { params })
}
