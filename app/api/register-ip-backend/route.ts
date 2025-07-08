import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  mintAndRegisterIpWithPilTerms,
  isStoryConfigured,
  getSPGNftContract,
} from "@/lib/story-protocol"

export async function POST(req: NextRequest) {
  try {
    if (!isStoryConfigured()) {
      return NextResponse.json(
        { error: "Story Protocol backend wallet not configured" },
        { status: 400 }
      )
    }

    const { trainingImages } = await req.json()

    if (!trainingImages || !Array.isArray(trainingImages)) {
      return NextResponse.json({ error: "Training images array is required" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    const spgContract = getSPGNftContract()
    const results = []
    let successCount = 0
    let failureCount = 0

    console.log(`[REGISTER IP BACKEND] Processing ${trainingImages.length} training images`)

    for (const image of trainingImages) {
      try {
        console.log(`[REGISTER IP BACKEND] Registering IP for image: ${image.original_filename}`)

        // Create metadata for the training image
        const metadata = {
          title: `Training Image: ${image.original_filename}`,
          ipType: "image" as const,
          attributes: [
            {
              trait_type: "File Type",
              value: image.content_type,
            },
            {
              trait_type: "File Size",
              value: `${Math.round(image.file_size / 1024)} KB`,
            },
            {
              trait_type: "Training Job ID",
              value: image.training_job_id,
            },
          ],
        }

        // Register as IP asset on Story Protocol using backend wallet
        const result = await mintAndRegisterIpWithPilTerms({
          spgNftContract: spgContract,
          metadata,
        })

        if (result.success) {
          // Check if there was a license error (partial success)
          if ("licenseError" in result) {
            console.warn(
              `[REGISTER IP BACKEND] ⚠️ IP registered but license attachment failed: ${result.licenseError}`
            )
          } else {
            console.log(
              `[REGISTER IP BACKEND] ✅ Registered IP with license terms for ${image.original_filename}: ${result.ipId}`
            )
          }

          // Update database with Story Protocol information
          const { error: updateError } = await supabase
            .from("training_images")
            .update({
              story_ip_id: result.ipId,
              story_nft_contract: spgContract,
              story_token_id: result.tokenId?.toString(),
              story_tx_hash: result.txHash,
              story_registration_status: "registered",
            })
            .eq("id", image.id)

          if (updateError) {
            console.error(`[REGISTER IP BACKEND] Error updating image ${image.id}:`, updateError)
            results.push({
              imageId: image.id,
              filename: image.original_filename,
              success: false,
              error: `Database update failed: ${updateError.message}`,
            })
            failureCount++
          } else {
            results.push({
              imageId: image.id,
              filename: image.original_filename,
              success: true,
              ipId: result.ipId,
              tokenId: result.tokenId,
              txHash: result.txHash,
              licenseWarning: "licenseError" in result ? result.licenseError : undefined,
            })
            successCount++
          }
        } else {
          // Update status to failed
          await supabase
            .from("training_images")
            .update({
              story_registration_status: "failed",
            })
            .eq("id", image.id)

          const errorMsg = "error" in result ? result.error : "Unknown registration error"
          console.error(
            `[REGISTER IP BACKEND] ❌ Failed to register IP for ${image.original_filename}:`,
            errorMsg
          )
          results.push({
            imageId: image.id,
            filename: image.original_filename,
            success: false,
            error: errorMsg,
          })
          failureCount++
        }

        // Add a small delay between registrations to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(
          `[REGISTER IP BACKEND] Error processing image ${image.original_filename}:`,
          error
        )

        // Update status to failed
        await supabase
          .from("training_images")
          .update({
            story_registration_status: "failed",
          })
          .eq("id", image.id)

        results.push({
          imageId: image.id,
          filename: image.original_filename,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
        failureCount++
      }
    }

    console.log(
      `[REGISTER IP BACKEND] Completed: ${successCount} successful, ${failureCount} failed`
    )

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      results,
      message: `Registered ${successCount} out of ${trainingImages.length} IP assets`,
    })
  } catch (error) {
    console.error("[REGISTER IP BACKEND] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
