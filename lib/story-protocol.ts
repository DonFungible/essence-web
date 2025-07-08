import { StoryClient, StoryConfig } from "@story-protocol/core-sdk"
import { http, createPublicClient, formatEther } from "viem"
import { storyAeneid } from "viem/chains"
import { toHex, keccak256, stringToBytes } from "viem"
import { privateKeyToAccount } from "viem/accounts"

// Hardcoded whitelist of addresses that can bypass balance checks
const BALANCE_CHECK_WHITELIST = [
  "0xe17aA3E4BFe9812b64354e5275A211216F1dee2a", // User-provided address
  // Add more addresses here as needed
]

// Use the specific Story RPC URL
const STORY_RPC_URL = "https://aeneid.storyrpc.io"

// Story Protocol configuration for backend wallet with timeout settings
const storyConfig: StoryConfig = {
  account: privateKeyToAccount(process.env.BACKEND_WALLET_PK as `0x${string}`), // Private key for transactions
  transport: http(STORY_RPC_URL, {
    timeout: 30000, // 30 second timeout
    retryCount: 3,
    retryDelay: 2000, // 2 second delay between retries
  }),
  chainId: "aeneid", // Story testnet
}

// Public client for reading blockchain data with timeout settings
const publicClient = createPublicClient({
  chain: storyAeneid,
  transport: http(STORY_RPC_URL, {
    timeout: 30000, // 30 second timeout
    retryCount: 3,
    retryDelay: 2000,
  }),
})

// Initialize Story client
let storyClient: StoryClient | null = null

function getStoryClient(): StoryClient {
  if (!storyClient) {
    const privateKey = process.env.STORY_PRIVATE_KEY || process.env.BACKEND_WALLET_PK
    if (!privateKey) {
      throw new Error("STORY_PRIVATE_KEY or BACKEND_WALLET_PK environment variable is required")
    }
    storyClient = StoryClient.newClient(storyConfig)
  }
  return storyClient
}

/**
 * Retry wrapper for Story Protocol operations
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      console.error(`[STORY] Attempt ${attempt}/${maxRetries} failed:`, error)

      if (attempt === maxRetries) {
        throw error
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay * attempt))
    }
  }
  throw new Error("Max retries exceeded")
}

/**
 * Check if an address is on the whitelist and can bypass balance checks
 */
export function isAddressWhitelisted(address: string): boolean {
  return BALANCE_CHECK_WHITELIST.includes(address.toLowerCase())
}

/**
 * Get the native token balance for an address on Story network
 */
export async function getStoryBalance(address: string): Promise<{
  success: boolean
  balance?: string
  balanceWei?: bigint
  error?: string
}> {
  try {
    console.log(`[STORY] Checking balance for address: ${address}`)

    const balance = await withRetry(async () => {
      return await publicClient.getBalance({
        address: address as `0x${string}`,
      })
    })

    const balanceInEther = formatEther(balance)

    console.log(`[STORY] Balance for ${address}: ${balanceInEther} IP`)

    return {
      success: true,
      balance: balanceInEther,
      balanceWei: balance,
    }
  } catch (error) {
    console.error("[STORY] Error checking balance:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check if a user can proceed with training based on balance and whitelist
 */
export async function canUserTrain(address: string): Promise<{
  canTrain: boolean
  reason?: string
  balance?: string
  isWhitelisted?: boolean
}> {
  try {
    // Check if address is whitelisted first
    const isWhitelisted = isAddressWhitelisted(address)

    if (isWhitelisted) {
      console.log(`[STORY] Address ${address} is whitelisted, allowing training`)
      return {
        canTrain: true,
        isWhitelisted: true,
        reason: "Address is whitelisted",
      }
    }

    // Check balance for non-whitelisted addresses
    const balanceResult = await getStoryBalance(address)

    if (!balanceResult.success) {
      return {
        canTrain: false,
        reason: `Failed to check balance: ${balanceResult.error}`,
        isWhitelisted: false,
      }
    }

    const hasBalance = balanceResult.balanceWei && balanceResult.balanceWei > BigInt(0)

    return {
      canTrain: !!hasBalance,
      reason: hasBalance
        ? "Sufficient balance for IP registration"
        : "Insufficient balance. You need IP tokens to cover gas fees for IP registration.",
      balance: balanceResult.balance,
      isWhitelisted: false,
    }
  } catch (error) {
    console.error("[STORY] Error in canUserTrain:", error)
    return {
      canTrain: false,
      reason: `Error checking training eligibility: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      isWhitelisted: false,
    }
  }
}

export interface IPMetadata {
  title: string
  description?: string
  createdAt?: string
  creators?: Array<{
    name: string
    address: string
    contributionPercent: number
  }>
  ipType: "image" | "model" | "AI Model" | "AI Agent"
  image?: string
  aiMetadata?: {
    modelType?: string
    triggerWord?: string
    trainingSteps?: number
    captioningMethod?: string
    replicateJobId?: string
    parentIPsCount?: number
    characterFileUrl?: string
    characterFileHash?: string
  }
  tags?: string[]
  attributes?: Array<{
    trait_type: string
    value: string
  }>
}

export interface RegisterIPAssetParams {
  nftContract: string
  tokenId: string | number
  metadata: IPMetadata
}

export interface RegisterDerivativeParams {
  childIpId: string
  parentIpIds: string[]
  licenseTermsIds: string[]
}

/**
 * Register an NFT as an IP Asset on Story Protocol
 */
export async function registerIPAsset(params: RegisterIPAssetParams) {
  try {
    const client = getStoryClient()

    // Create metadata URI (in production, this should be uploaded to IPFS)
    const metadataJSON = JSON.stringify(params.metadata)
    const metadataURI = `data:application/json;base64,${Buffer.from(metadataJSON).toString(
      "base64"
    )}`

    // Generate proper 32-byte hash of the metadata
    const metadataHash = keccak256(stringToBytes(metadataJSON))

    console.log(`[STORY] Registering IP Asset for NFT ${params.nftContract}:${params.tokenId}`)

    const response = await withRetry(async () => {
      return await client.ipAsset.register({
        nftContract: params.nftContract as `0x${string}`,
        tokenId: params.tokenId,
        ipMetadata: {
          ipMetadataURI: metadataURI,
          ipMetadataHash: metadataHash,
        },
      })
    })

    console.log(`[STORY] IP Asset registered: ${response.ipId} (tx: ${response.txHash})`)

    return {
      success: true,
      ipId: response.ipId,
      txHash: response.txHash,
    }
  } catch (error) {
    console.error("[STORY] Error registering IP Asset:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Register a derivative IP that is derived from parent IP assets
 */
export async function registerDerivativeIP(params: RegisterDerivativeParams) {
  try {
    const client = getStoryClient()

    console.log(
      `[STORY] Registering derivative IP ${
        params.childIpId
      } from parents: ${params.parentIpIds.join(", ")}`
    )

    const response = await withRetry(async () => {
      return await client.ipAsset.registerDerivative({
        childIpId: params.childIpId as `0x${string}`,
        parentIpIds: params.parentIpIds as `0x${string}`[],
        licenseTermsIds: params.licenseTermsIds.map((id) => BigInt(id)),
      })
    })

    console.log(`[STORY] Derivative IP registered (tx: ${response.txHash})`)

    return {
      success: true,
      txHash: response.txHash,
    }
  } catch (error) {
    console.error("[STORY] Error registering derivative IP:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Mint an NFT and register it as an IP Asset with license terms attached
 *
 * This ensures training images have license terms attached, enabling derivative registration.
 * Uses a two-step process: register IP first, then attach license terms.
 */
export async function mintAndRegisterIpWithPilTerms(params: {
  spgNftContract: string
  metadata: IPMetadata
  recipient?: string
}) {
  try {
    const client = getStoryClient()

    console.log(`[STORY] Minting and registering IP Asset with license terms (two-step process)`)

    // Step 1: Register the IP asset
    const ipResult = await mintAndRegisterIP(params)

    if (!ipResult.success) {
      return ipResult
    }

    console.log(`[STORY] Step 1 complete - IP registered: ${ipResult.ipId}`)

    // Step 2: Attach license terms to the newly registered IP
    console.log(`[STORY] Step 2 - Attaching license terms to IP: ${ipResult.ipId}`)

    try {
      const licenseResponse = await withRetry(async () => {
        return await client.license.attachLicenseTerms({
          ipId: ipResult.ipId as `0x${string}`,
          licenseTermsId: BigInt(1), // Use default commercial license terms
        })
      })

      console.log(
        `[STORY] IP Asset registered with license terms: ${ipResult.ipId} (license tx: ${licenseResponse.txHash})`
      )

      return {
        success: true,
        ipId: ipResult.ipId,
        tokenId: ipResult.tokenId?.toString(),
        txHash: ipResult.txHash,
        licenseTxHash: licenseResponse.txHash,
      }
    } catch (licenseError) {
      console.error(`[STORY] Failed to attach license terms to ${ipResult.ipId}:`, licenseError)

      // Return the IP registration result even if license attachment failed
      // The IP exists, just without explicit license terms
      return {
        success: true,
        ipId: ipResult.ipId,
        tokenId: ipResult.tokenId?.toString(),
        txHash: ipResult.txHash,
        licenseError:
          licenseError instanceof Error ? licenseError.message : "License attachment failed",
      }
    }
  } catch (error) {
    console.error("[STORY] Error minting and registering IP Asset with PIL terms:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Mint an NFT and register it as an IP Asset (legacy method)
 *
 * @deprecated Use mintAndRegisterIpAndAttachPilTerms for training images to ensure license terms
 */
export async function mintAndRegisterIP(params: {
  spgNftContract: string
  metadata: IPMetadata
  recipient?: string
}) {
  try {
    const client = getStoryClient()

    // Create metadata URI
    const metadataJSON = JSON.stringify(params.metadata)
    const metadataURI = `data:application/json;base64,${Buffer.from(metadataJSON).toString(
      "base64"
    )}`

    // Generate proper 32-byte hash of the metadata
    const metadataHash = keccak256(stringToBytes(metadataJSON))

    console.log(`[STORY] Minting and registering IP Asset`)

    const response = await withRetry(async () => {
      return await client.ipAsset.mintAndRegisterIp({
        spgNftContract: params.spgNftContract as `0x${string}`,
        ipMetadata: {
          ipMetadataURI: metadataURI,
          ipMetadataHash: metadataHash,
          nftMetadataURI: metadataURI,
          nftMetadataHash: metadataHash,
        },
        recipient: params.recipient as `0x${string}` | undefined,
      })
    })

    console.log(
      `[STORY] IP Asset minted and registered: ${response.ipId} (token: ${response.tokenId}, tx: ${response.txHash})`
    )

    const serializedResponse = serializeBigIntResponse(response)

    return {
      success: true,
      ipId: serializedResponse.ipId,
      tokenId: serializedResponse.tokenId,
      txHash: serializedResponse.txHash,
    }
  } catch (error) {
    console.error("[STORY] Error minting and registering IP Asset:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Convert BigInt values to strings for JSON serialization
 */
export function serializeBigIntResponse(response: any) {
  return {
    ...response,
    tokenId: response.tokenId?.toString(),
    licenseTermsIds: response.licenseTermsIds?.map((id: bigint) => id.toString()),
  }
}

/**
 * Mint license tokens for parent IP assets
 */
export async function mintLicenseTokens(params: {
  licensorIpId: string
  licenseTermsId: string
  amount?: number
  receiver?: string
  maxMintingFee?: string
  maxRevenueShare?: number
}) {
  try {
    const client = getStoryClient()

    console.log(`[STORY] Minting license tokens for IP: ${params.licensorIpId}`)

    const response = await withRetry(async () => {
      return await client.license.mintLicenseTokens({
        licensorIpId: params.licensorIpId as `0x${string}`,
        licenseTermsId: BigInt(params.licenseTermsId),
        amount: params.amount || 1,
        receiver: params.receiver as `0x${string}` | undefined,
        maxMintingFee: params.maxMintingFee || "0", // No minting fee
        maxRevenueShare: params.maxRevenueShare || 0, // No revenue share
      })
    })

    console.log(
      `[STORY] License tokens minted: ${response.licenseTokenIds?.join(", ")} (tx: ${
        response.txHash
      })`
    )

    return {
      success: true,
      licenseTokenIds: response.licenseTokenIds || [],
      txHash: response.txHash,
    }
  } catch (error) {
    console.error("[STORY] Error minting license tokens:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      licenseTokenIds: [],
    }
  }
}

/**
 * Mint NFT and register as derivative IP with license tokens
 */
export async function mintAndRegisterDerivativeWithLicenseTokens(params: {
  spgNftContract: string
  licenseTokenIds: string[]
  metadata: IPMetadata
  recipient?: string
}) {
  try {
    const client = getStoryClient()

    // Create metadata URI
    const metadataJSON = JSON.stringify(params.metadata)
    const metadataURI = `data:application/json;base64,${Buffer.from(metadataJSON).toString(
      "base64"
    )}`

    // Generate proper 32-byte hash of the metadata
    const metadataHash = keccak256(stringToBytes(metadataJSON))

    console.log(
      `[STORY] Minting and registering derivative IP with license tokens: ${params.licenseTokenIds.join(
        ", "
      )}`
    )

    const response = await withRetry(async () => {
      return await client.ipAsset.mintAndRegisterIpAndMakeDerivativeWithLicenseTokens({
        spgNftContract: params.spgNftContract as `0x${string}`,
        licenseTokenIds: params.licenseTokenIds,
        ipMetadata: {
          ipMetadataURI: metadataURI,
          ipMetadataHash: metadataHash,
          nftMetadataURI: metadataURI,
          nftMetadataHash: metadataHash,
        },
        recipient: params.recipient as `0x${string}` | undefined,
        maxRts: 100_000_000, // Maximum royalty tokens
      })
    })

    console.log(
      `[STORY] Derivative IP minted and registered: ${response.ipId} (token: ${response.tokenId}, tx: ${response.txHash})`
    )

    const serializedResponse = serializeBigIntResponse(response)

    return {
      success: true,
      ipId: serializedResponse.ipId,
      tokenId: serializedResponse.tokenId,
      txHash: serializedResponse.txHash,
    }
  } catch (error) {
    console.error("[STORY] Error minting and registering derivative IP:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Mint NFT and register as derivative IP using license terms (primary method for AI models)
 *
 * This is the primary method for registering AI models as derivatives of training images.
 * It works directly with parent IP IDs and license terms, avoiding license token complexity.
 * All AI models should use this method to establish proper derivative relationships.
 */
export async function mintAndRegisterIpAndMakeDerivative(params: {
  spgNftContract: string
  parentIpIds: string[]
  licenseTermsId: string
  metadata: IPMetadata
  recipient?: string
}) {
  try {
    const client = getStoryClient()

    // Story Protocol appears to have a limit on parent IPs per derivative call
    // Based on production testing: 16 parent IPs succeed, 21+ parent IPs fail with 0xee461474
    const MAX_PARENT_IPS = 16

    if (params.parentIpIds.length > MAX_PARENT_IPS) {
      console.warn(
        `⚠️ [STORY] Warning: ${params.parentIpIds.length} parent IPs exceeds recommended limit of ${MAX_PARENT_IPS}`
      )
      console.warn(
        `⚠️ [STORY] Using subset of first ${MAX_PARENT_IPS} parent IPs to avoid contract revert`
      )
      console.warn(`⚠️ [STORY] Full parent list: ${params.parentIpIds.join(", ")}`)

      // Use only the first MAX_PARENT_IPS to avoid contract failure
      params.parentIpIds = params.parentIpIds.slice(0, MAX_PARENT_IPS)
    }

    // Create metadata URI
    const metadataJSON = JSON.stringify(params.metadata)
    const metadataURI = `data:application/json;base64,${Buffer.from(metadataJSON).toString(
      "base64"
    )}`

    // Generate proper 32-byte hash of the metadata
    const metadataHash = keccak256(stringToBytes(metadataJSON))

    console.log(
      `[STORY] Minting and registering derivative IP for ${params.parentIpIds.length} parent IPs`
    )

    const response = await withRetry(async () => {
      return await client.ipAsset.mintAndRegisterIpAndMakeDerivative({
        spgNftContract: params.spgNftContract as `0x${string}`,
        derivData: {
          parentIpIds: params.parentIpIds as `0x${string}`[],
          licenseTermsIds: params.parentIpIds.map(() => BigInt(params.licenseTermsId)),
        },
        ipMetadata: {
          ipMetadataURI: metadataURI,
          ipMetadataHash: metadataHash,
          nftMetadataURI: metadataURI,
          nftMetadataHash: metadataHash,
        },
        recipient: params.recipient as `0x${string}` | undefined,
      })
    })

    console.log(
      `[STORY] Derivative IP minted and registered: ${response.ipId} (token: ${response.tokenId}, tx: ${response.txHash})`
    )

    const serializedResponse = serializeBigIntResponse(response)

    return {
      success: true,
      ipId: serializedResponse.ipId,
      tokenId: serializedResponse.tokenId,
      txHash: serializedResponse.txHash,
      parentIpsUsed: params.parentIpIds.length,
      parentIpsTotal: params.parentIpIds.length,
    }
  } catch (error) {
    console.error("[STORY] Error minting and registering derivative IP:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check if Story Protocol is properly configured
 */
export function isStoryConfigured(): boolean {
  const privateKey = process.env.BACKEND_WALLET_PK
  return !!(privateKey && process.env.STORY_SPG_NFT_CONTRACT)
}

/**
 * Get the configured SPG NFT contract address
 */
export function getSPGNftContract(): string {
  const contract = process.env.STORY_SPG_NFT_CONTRACT
  if (!contract) {
    throw new Error("STORY_SPG_NFT_CONTRACT environment variable is required")
  }
  return contract
}
