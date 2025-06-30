"use client"

import { StoryClient, StoryConfig } from "@story-protocol/core-sdk"
import { custom } from "viem"
import { storyAeneid } from "viem/chains"
import { toHex, keccak256, stringToBytes } from "viem"

// Type for MetaMask ethereum provider
interface MetaMaskProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>
  isMetaMask?: boolean
}

export interface IPMetadata {
  title: string
  description?: string
  ipType: "image" | "model"
  image?: string
  attributes?: Array<{
    trait_type: string
    value: string
  }>
}

/**
 * Create a Story Protocol client using the user's connected wallet
 */
export function createStoryClientWithWallet(): StoryClient | null {
  if (typeof window === "undefined" || !window.ethereum) {
    console.warn("MetaMask not available")
    return null
  }

  try {
    const storyConfig: StoryConfig = {
      transport: custom(window.ethereum as any),
      chainId: "aeneid", // Story testnet
    }

    return StoryClient.newClient(storyConfig)
  } catch (error) {
    console.error("Error creating Story client:", error)
    return null
  }
}

/**
 * Register an NFT as an IP Asset using the user's wallet
 */
export async function registerIPAssetWithWallet(params: {
  spgNftContract: string
  metadata: IPMetadata
  userAddress: string
}) {
  try {
    const client = createStoryClientWithWallet()
    if (!client) {
      throw new Error("Failed to create Story client")
    }

    // Create metadata URI
    const metadataJSON = JSON.stringify(params.metadata)
    const metadataURI = `data:application/json;base64,${Buffer.from(metadataJSON).toString(
      "base64"
    )}`

    // Generate proper 32-byte hash of the metadata
    const metadataHash = keccak256(stringToBytes(metadataJSON))

    console.log(`[STORY CLIENT] Minting and registering IP Asset with user wallet`)

    const response = await client.ipAsset.mintAndRegisterIp({
      spgNftContract: params.spgNftContract as `0x${string}`,
      ipMetadata: {
        ipMetadataURI: metadataURI,
        ipMetadataHash: metadataHash,
        nftMetadataURI: metadataURI,
        nftMetadataHash: metadataHash,
      },
      recipient: params.userAddress as `0x${string}`,
    })

    console.log(
      `[STORY CLIENT] IP Asset registered: ${response.ipId} (token: ${response.tokenId}, tx: ${response.txHash})`
    )

    return {
      success: true,
      ipId: response.ipId,
      tokenId: response.tokenId,
      txHash: response.txHash,
    }
  } catch (error) {
    console.error("[STORY CLIENT] Error registering IP Asset:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check if the user's wallet is connected to the correct network
 */
export async function checkNetworkAndSwitch(): Promise<boolean> {
  if (typeof window === "undefined" || !window.ethereum) {
    return false
  }

  try {
    const ethereum = window.ethereum as any
    const chainId = await ethereum.request({ method: "eth_chainId" })
    const storyChainId = `0x${storyAeneid.id.toString(16)}`

    if (chainId !== storyChainId) {
      // Request network switch
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: storyChainId }],
        })
        return true
      } catch (switchError: any) {
        // If network doesn't exist, add it
        if (switchError.code === 4902) {
          try {
            await ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: storyChainId,
                  chainName: storyAeneid.name,
                  rpcUrls: storyAeneid.rpcUrls.default.http,
                  nativeCurrency: storyAeneid.nativeCurrency,
                  blockExplorerUrls: storyAeneid.blockExplorers?.default
                    ? [storyAeneid.blockExplorers.default.url]
                    : [],
                },
              ],
            })
            return true
          } catch (addError) {
            console.error("Error adding Story network:", addError)
            return false
          }
        }
        console.error("Error switching network:", switchError)
        return false
      }
    }

    return true
  } catch (error) {
    console.error("Error checking network:", error)
    return false
  }
}

/**
 * Get the SPG NFT contract address from environment
 */
export function getSPGNftContract(): string {
  const contract = process.env.NEXT_PUBLIC_STORY_SPG_NFT_CONTRACT
  if (!contract) {
    throw new Error("NEXT_PUBLIC_STORY_SPG_NFT_CONTRACT environment variable is required")
  }
  return contract
}

/**
 * Check if client-side Story Protocol is properly configured
 */
export function isStoryClientConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_STORY_SPG_NFT_CONTRACT &&
    typeof window !== "undefined" &&
    window.ethereum
  )
}

/**
 * Register IP assets using the backend wallet via API call
 */
export async function registerIpAssetWithBackend(params: {
  trainingImages: Array<{
    id: string
    original_filename: string
    content_type: string
    file_size: number
    training_job_id: string
  }>
}) {
  try {
    console.log(
      `[STORY BACKEND] Registering ${params.trainingImages.length} IP assets with backend wallet`
    )

    const response = await fetch("/api/register-ip-backend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trainingImages: params.trainingImages,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to register IP assets")
    }

    const result = await response.json()
    console.log(`[STORY BACKEND] Successfully registered ${result.successCount} IP assets`)

    return {
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      results: result.results,
    }
  } catch (error) {
    console.error("[STORY BACKEND] Error registering IP assets:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
