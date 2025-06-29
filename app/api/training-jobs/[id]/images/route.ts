import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const trainingJobId = params.id

    // Create Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    // Fetch training images for the job
    const { data: images, error } = await supabase
      .from("training_images")
      .select("*")
      .eq("training_job_id", trainingJobId)
      .order("display_order", { ascending: true })

    if (error) {
      console.error("Error fetching training images:", error)
      return NextResponse.json({ error: "Failed to fetch training images" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      images: images || [],
    })
  } catch (error) {
    console.error("Error in training images fetch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
