import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const generationId = searchParams.get("id")

  if (!generationId) {
    return NextResponse.json({ error: "Generation ID is required" }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const { data: generation, error } = await supabase
      .from("image_generations")
      .select("*")
      .eq("id", generationId)
      .single()

    if (error) {
      console.error("Error fetching generation:", error)
      return NextResponse.json({ error: "Generation not found" }, { status: 404 })
    }

    // Map database status to our frontend status
    let status = "pending"
    if (generation.status === "completed" || generation.status === "succeeded") {
      status = "completed"
    } else if (generation.status === "failed" || generation.status === "canceled") {
      status = "failed"
    }

    return NextResponse.json({
      id: generation.id,
      status,
      imageUrl: generation.image_url,
      error: generation.error_message,
    })
  } catch (error) {
    console.error("Error checking generation status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
