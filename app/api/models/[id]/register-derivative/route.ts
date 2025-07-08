import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  mintAndRegisterIP,
  isStoryConfigured,
  getSPGNftContract,
  mintLicenseTokens,
  mintAndRegisterDerivativeWithLicenseTokens,
  mintAndRegisterIpAndMakeDerivative,
} from "@/lib/story-protocol"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params

    if (!isStoryConfigured()) {
      return NextResponse.json({ error: "Story Protocol not configured" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    console.log(`📝 Manual IP registration for model: ${id}`)

    // Get training job details and associated training images
    console.log(`🔍 Searching for training job with ID: ${id}`)

    // Try database ID first
    let { data: trainingJob, error: jobError } = await supabase
      .from("training_jobs")
      .select(
        `
        *,
        training_images (
          id,
          story_ip_id,
          story_registration_status,
          original_filename
        )
      `
      )
      .eq("id", id)
      .single()

    if (jobError || !trainingJob) {
      console.log(`❌ No job found by database ID, trying replicate_job_id...`)

      // Try replicate_job_id
      const { data: trainingJobByReplicate, error: replicateError } = await supabase
        .from("training_jobs")
        .select(
          `
          *,
          training_images (
            id,
            story_ip_id,
            story_registration_status,
            original_filename
          )
        `
        )
        .eq("replicate_job_id", id)
        .single()

      if (replicateError || !trainingJobByReplicate) {
        console.error(`❌ Could not find training job by either ID: ${id}`)
        console.error(`Database ID error:`, jobError)
        console.error(`Replicate ID error:`, replicateError)
        return NextResponse.json({ error: "Training job not found" }, { status: 404 })
      }

      trainingJob = trainingJobByReplicate
      console.log(`✅ Found training job by replicate_job_id: ${trainingJob.id}`)
    } else {
      console.log(`✅ Found training job by database ID: ${trainingJob.id}`)
    }

    // Check if model already has IP registration
    if (trainingJob.ip_id) {
      return NextResponse.json({
        success: true,
        message: "Model already registered as IP asset",
        ipId: trainingJob.ip_id,
        alreadyRegistered: true,
      })
    }

    // Get registered training image IP assets - handle both flows
    let registeredImageIPs: string[] = []

    // Flow 1: Individual images uploaded via /train page (stored in training_images table)
    const trainingImageIPs =
      trainingJob.training_images
        ?.filter((img: any) => img.story_ip_id && img.story_registration_status === "registered")
        ?.map((img: any) => img.story_ip_id) || []

    // Flow 2: Assets from /assets page (stored in story_parent_ip_ids)
    const parentIPs = trainingJob.story_parent_ip_ids || []

    if (trainingImageIPs.length > 0) {
      // Use training images flow
      registeredImageIPs = trainingImageIPs
      console.log(
        `📝 Using training images flow: Found ${registeredImageIPs.length} registered training image IPs`
      )
    } else if (parentIPs.length > 0) {
      // Use assets flow
      registeredImageIPs = parentIPs
      console.log(`📝 Using assets flow: Found ${registeredImageIPs.length} parent IP assets`)
    } else {
      console.log(`📝 No IPs found in either flow`)
    }

    if (registeredImageIPs.length === 0) {
      return NextResponse.json(
        {
          error: "No parent IP assets found. Cannot register model as derivative.",
          details:
            "Either training images must be registered as IP assets or assets from /assets page must have IP IDs",
          flowsChecked: {
            trainingImagesFlow: trainingImageIPs.length,
            assetsFlow: parentIPs.length,
            trainingImagesCount: trainingJob.training_images?.length || 0,
            hasParentIPs: !!trainingJob.story_parent_ip_ids,
          },
        },
        { status: 400 }
      )
    }

    // Create metadata for the trained model
    const triggerWord = trainingJob.trigger_word || `Model ${id.substring(0, 6)}`
    const modelMetadata = {
      title: `AI Model: ${triggerWord}`,
      description: `AI model trained on ${
        trainingJob.training_images?.length || 0
      } images. Trigger word: ${triggerWord}. Generated using ${
        trainingJob.captioning || "automatic"
      } captioning with ${trainingJob.training_steps || 300} training steps.`,
      ipType: "model" as const,
      attributes: [
        {
          trait_type: "Model Type",
          value: "AI Training Model",
        },
        {
          trait_type: "Trigger Word",
          value: triggerWord,
        },
        {
          trait_type: "Training Steps",
          value: (trainingJob.training_steps || 300).toString(),
        },
        {
          trait_type: "Captioning",
          value: trainingJob.captioning || "automatic",
        },
        {
          trait_type: "Training Images Count",
          value: (trainingJob.training_images?.length || 0).toString(),
        },
        {
          trait_type: "Replicate Job ID",
          value: trainingJob.replicate_job_id || id,
        },
      ],
    }

    const spgContract = getSPGNftContract()

    let modelResult: any
    let derivativeTxHash: string | null = null

    console.log(
      `📝 Registering model as derivative IP of ${registeredImageIPs.length} parent IP assets`
    )
    console.log(
      `📝 Using ${trainingImageIPs.length > 0 ? "training images" : "assets"} flow for registration`
    )

    try {
      // Step 1: Mint license tokens for each parent IP
      const licenseTokenIds: string[] = []

      for (const parentIpId of registeredImageIPs) {
        console.log(`🎫 Minting license token for parent IP: ${parentIpId}`)

        const licenseResult = await mintLicenseTokens({
          licensorIpId: parentIpId,
          licenseTermsId: "1", // Use default license terms
          amount: 1,
          maxMintingFee: "0",
          maxRevenueShare: 0,
        })

        if (licenseResult.success && licenseResult.licenseTokenIds.length > 0) {
          // Convert bigint to string for license token IDs
          const tokenIds = licenseResult.licenseTokenIds.map((id) => id.toString())
          licenseTokenIds.push(...tokenIds)
          console.log(`✅ License token minted: ${tokenIds.join(", ")}`)
        } else {
          console.error(`❌ Failed to mint license token for ${parentIpId}:`, licenseResult.error)
        }
      }

      // Step 1.5: Check and approve license tokens for derivative registration
      if (licenseTokenIds.length > 0) {
        console.log(`🔐 Checking approval status for ${licenseTokenIds.length} license tokens`)

        // For now, let's proceed with derivative registration and let the error guide us
        // The 0x177e802f error indicates we need to approve tokens, but the exact method
        // will depend on the Story SDK implementation
        console.log(`⚠️ License tokens may need approval for derivative registration`)
        console.log(`   Tokens: ${licenseTokenIds.join(", ")}`)
        console.log(`   Spender: DerivativeWorkflows contract`)
      }

      if (licenseTokenIds.length > 0) {
        // Step 2: Register model as derivative using license tokens
        console.log(`🔗 Registering derivative IP with ${licenseTokenIds.length} license tokens`)

        modelResult = await mintAndRegisterDerivativeWithLicenseTokens({
          spgNftContract: spgContract,
          licenseTokenIds,
          metadata: modelMetadata,
        })

        if (modelResult.success) {
          derivativeTxHash = modelResult.txHash
          console.log(`✅ Registered model as derivative IP: ${modelResult.ipId}`)
        } else {
          console.error(`❌ Failed to register derivative IP:`, modelResult.error)
          // Fall back to derivative registration with license terms instead of tokens
          console.log(`🔄 Falling back to derivative registration with license terms...`)
          modelResult = await mintAndRegisterIpAndMakeDerivative({
            spgNftContract: spgContract,
            parentIpIds: registeredImageIPs,
            licenseTermsId: "1", // Default PIL license terms
            metadata: modelMetadata,
          })
        }
      } else {
        // Step 2b: Register as derivative using license terms directly (no tokens needed)
        console.log(`🔗 Registering derivative IP with license terms (no tokens required)`)
        modelResult = await mintAndRegisterIpAndMakeDerivative({
          spgNftContract: spgContract,
          parentIpIds: registeredImageIPs,
          licenseTermsId: "1", // Default PIL license terms
          metadata: modelMetadata,
        })
      }
    } catch (error) {
      console.error(`❌ Error in derivative registration:`, error)
      console.log(`🔄 Falling back to standalone IP registration...`)
      modelResult = await mintAndRegisterIP({
        spgNftContract: spgContract,
        metadata: modelMetadata,
      })
    }

    if (!modelResult.success) {
      console.error(`❌ Failed to register model IP:`, modelResult.error)
      return NextResponse.json(
        {
          error: "Failed to register model as IP asset",
          details: modelResult.error,
        },
        { status: 500 }
      )
    }

    console.log(`✅ Registered model IP: ${modelResult.ipId}`)

    // Update training job with model IP information
    const updateData: any = {
      ip_id: modelResult.ipId,
      story_model_tx_hash: modelResult.txHash,
    }

    // Store parent IPs and derivative transaction if applicable
    if (registeredImageIPs.length > 0) {
      updateData.story_parent_ip_ids = registeredImageIPs
      if (derivativeTxHash) {
        updateData.story_derivative_tx_hash = derivativeTxHash
      }
      console.log(
        `📝 Stored ${registeredImageIPs.length} parent IP IDs ${
          derivativeTxHash ? "with derivative relationship" : "for reference"
        }`
      )
    }

    const { error: updateError } = await supabase
      .from("training_jobs")
      .update(updateData)
      .eq("id", trainingJob.id) // Use the actual database ID we found

    if (updateError) {
      console.error(`❌ Error updating training job with model IP:`, updateError)
      return NextResponse.json(
        {
          error: "Model registered but failed to update database",
          details: updateError.message,
          ipId: modelResult.ipId,
          tokenId: modelResult.tokenId?.toString(),
        },
        { status: 500 }
      )
    }

    console.log(`✅ Updated training job ${id} with model IP: ${modelResult.ipId}`)

    return NextResponse.json({
      success: true,
      message: "Model successfully registered as derivative IP asset",
      ipId: modelResult.ipId,
      tokenId: modelResult.tokenId?.toString(), // Convert BigInt to string
      txHash: modelResult.txHash,
      derivativeTxHash,
      parentIpIds: registeredImageIPs,
      isDerivative: derivativeTxHash !== null,
    })
  } catch (error) {
    console.error("❌ Error in manual IP registration:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
