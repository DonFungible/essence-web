"use client"

import { useState } from "react"
import { usePrivy } from "@privy-io/react-auth"
import {
  registerIPAssetWithWallet,
  checkNetworkAndSwitch,
  getSPGNftContract,
  isStoryClientConfigured,
  type IPMetadata,
} from "@/lib/story-protocol-client"

interface UseStoryIPRegistrationResult {
  registerTrainingImages: (images: TrainingImageData[]) => Promise<void>
  isRegistering: boolean
  error: string | null
  registrationProgress: {
    total: number
    completed: number
    current?: string
  } | null
}

interface TrainingImageData {
  id: string
  original_filename: string
  content_type: string
  file_size: number
  training_job_id: string
}

export function useStoryIPRegistration(): UseStoryIPRegistrationResult {
  const { authenticated, user } = usePrivy()
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registrationProgress, setRegistrationProgress] = useState<{
    total: number
    completed: number
    current?: string
  } | null>(null)

  const registerTrainingImages = async (images: TrainingImageData[]) => {
    if (!authenticated || !user?.wallet?.address) {
      setError("Please connect your wallet to register IP assets")
      return
    }

    if (!isStoryClientConfigured()) {
      setError("Story Protocol not configured")
      return
    }

    setIsRegistering(true)
    setError(null)
    setRegistrationProgress({ total: images.length, completed: 0 })

    try {
      // Check and switch to Story network if needed
      const networkReady = await checkNetworkAndSwitch()
      if (!networkReady) {
        throw new Error("Failed to connect to Story Protocol network")
      }

      const spgContract = getSPGNftContract()

      for (let i = 0; i < images.length; i++) {
        const image = images[i]

        setRegistrationProgress({
          total: images.length,
          completed: i,
          current: image.original_filename,
        })

        try {
          // Create metadata for the training image
          const metadata: IPMetadata = {
            title: `Training Image: ${image.original_filename}`,
            description: `Training image used for AI model development. Original filename: ${image.original_filename}`,
            ipType: "image",
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

          // Register as IP asset with user's wallet
          const result = await registerIPAssetWithWallet({
            spgNftContract: spgContract,
            metadata,
            userAddress: user.wallet.address,
          })

          if (result.success) {
            // Update database with Story Protocol information
            await updateImageWithStoryData(image.id, {
              story_ip_id: result.ipId,
              story_nft_contract: spgContract,
              story_token_id: result.tokenId?.toString(),
              story_tx_hash: result.txHash,
              story_registration_status: "registered",
            })

            console.log(`✅ Registered IP for image ${image.original_filename}: ${result.ipId}`)
          } else {
            console.error(
              `❌ Failed to register IP for image ${image.original_filename}:`,
              result.error
            )

            // Update status to failed
            await updateImageWithStoryData(image.id, {
              story_registration_status: "failed",
            })
          }
        } catch (error) {
          console.error(`Error processing image ${image.original_filename}:`, error)

          // Update status to failed
          await updateImageWithStoryData(image.id, {
            story_registration_status: "failed",
          })
        }
      }

      setRegistrationProgress({ total: images.length, completed: images.length })
      console.log(`✅ Completed IP registration for ${images.length} images`)
    } catch (error) {
      console.error("Error in IP registration:", error)
      setError(error instanceof Error ? error.message : "Failed to register IP assets")
    } finally {
      setIsRegistering(false)
      // Clear progress after a delay
      setTimeout(() => setRegistrationProgress(null), 3000)
    }
  }

  return {
    registerTrainingImages,
    isRegistering,
    error,
    registrationProgress,
  }
}

// Helper function to update image with Story Protocol data
async function updateImageWithStoryData(imageId: string, data: any) {
  try {
    const response = await fetch(`/api/training-images/${imageId}/story`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`Failed to update image: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Error updating image ${imageId} with Story data:`, error)
    throw error
  }
}
