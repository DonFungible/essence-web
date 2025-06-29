import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const imageId = params.id
    const updateData = await req.json()

    // Create Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    // Update the training image with Story Protocol data
    const { data, error } = await supabase
      .from("training_images")
      .update(updateData)
      .eq("id", imageId)
      .select()
      .single()

    if (error) {
      console.error("Error updating training image:", error)
      return NextResponse.json({ error: "Failed to update training image" }, { status: 500 })
    }

    console.log(`✅ Updated training image ${imageId} with Story Protocol data`)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error("Error in training image update:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
