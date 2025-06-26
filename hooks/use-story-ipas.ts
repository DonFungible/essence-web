import { useQuery } from "@tanstack/react-query"

interface AssetsPaginationOptions {
  after?: string
  before?: string
  limit?: number
}

interface AssetsOptions {
  orderBy?: string
  orderDirection?: "asc" | "desc"
  pagination?: AssetsPaginationOptions
}

interface AssetsRequest {
  options?: AssetsOptions
}

interface NftMetadata {
  chainId: string
  imageUrl: string
  name: string
  tokenContract: string
  tokenId: string
  tokenUri: string
}

export interface StoryAsset {
  ancestorCount: number
  blockNumber: string
  blockTimestamp: string
  childrenCount: number
  descendantCount: number
  id: string
  ipId: string
  isGroup: boolean
  latestArbitrationPolicy: string
  nftMetadata: NftMetadata
  parentCount: number
  rootCount: number
  rootIpIds: string[]
  transactionHash: string
}

export interface AssetsResponse {
  data: StoryAsset[]
  hasNextPage: boolean
  hasPreviousPage: boolean
  next: string
  prev: string
}

// Function to fetch assets from Story APIs
async function fetchStoryAssets(request: AssetsRequest): Promise<AssetsResponse> {
  const response = await fetch("https://api.storyapis.com/api/v3/assets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": "MhBsxkU1z9fG6TofE59KqiiWV-YlYE8Q4awlLQehF3U",
      "X-Chain": "story",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Story assets: ${response.statusText}`)
  }

  return response.json()
}

// Hook to use Story assets with React Query
export function useStoryAssets(options?: AssetsOptions) {
  return useQuery({
    queryKey: ["story-assets", options],
    queryFn: () => fetchStoryAssets({ options }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  })
}
