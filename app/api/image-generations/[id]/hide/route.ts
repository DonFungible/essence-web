import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { id } = params

    if (!id) {
      return NextResponse.json({ error: "Image generation ID is required" }, { status: 400 })
    }

    console.log(`🗑️ Hiding image generation: ${id}`)

    // Update the image generation to set is_hidden = true
    const { data, error } = await supabase
      .from("image_generations")
      .update({
        is_hidden: true,
        hidden_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error hiding image generation:", error)
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Image generation not found" }, { status: 404 })
      }
      return NextResponse.json({ error: "Failed to hide image generation" }, { status: 500 })
    }

    console.log(`✅ Successfully hidden image generation: ${id}`)

    return NextResponse.json({
      success: true,
      message: "Image generation hidden successfully",
      data: data,
    })
  } catch (error: any) {
    console.error("Unexpected error hiding image generation:", error)
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
