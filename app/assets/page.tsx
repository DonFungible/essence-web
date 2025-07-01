"use client"

import type React from "react"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import AssetsView from "@/components/assets-view"
import { useStoryAssets, type StoryAsset } from "@/hooks/use-story-ipas"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Asset } from "@/lib/assets-data"

// Define CSS variables for dynamic sticky top positioning
const topBarHeight = "64px"

// Adapter function to transform StoryAsset to Asset
function transformStoryAssetToAsset(storyAsset: StoryAsset): Asset {
  // Clean up the name by removing numeric prefixes like "1514: "
  const cleanName = (storyAsset.nftMetadata.name || `Asset ${storyAsset.id.slice(0, 8)}`)
    .replace(/^\d+:\s*/, "") // Remove pattern like "1514: " from the beginning
    .trim()

  // Replace IPFS URLs with dweb.link gateway
  const processImageUrl = (url: string) => {
    if (!url) return "/placeholder.jpg"

    // Replace https://ipfs.io/ipfs/ with https://dweb.link/ipfs/
    if (url.startsWith("https://ipfs.io/ipfs/")) {
      return url.replace("https://ipfs.io/ipfs/", "https://dweb.link/ipfs/")
    }

    // Replace ipfs:// protocol with https://dweb.link/ipfs/
    if (url.startsWith("ipfs://")) {
      return url.replace("ipfs://", "https://dweb.link/ipfs/")
    }

    return url
  }

  return {
    id: storyAsset.id,
    name: cleanName,
    src: processImageUrl(storyAsset.nftMetadata.imageUrl),
    alt: `Story Protocol asset: ${cleanName}`,
    tags: [
      "story-protocol",
      ...(storyAsset.isGroup ? ["group"] : []),
      ...(storyAsset.rootIpIds.length > 0 ? ["derivative"] : ["original"]),
    ],
    category: "Story Assets",
    ipId: storyAsset.ipId, // Include the Story Protocol IP Asset ID
  }
}

export default function AssetsPage() {
  const {
    data: assetsResponse,
    isLoading,
    error,
    isError,
  } = useStoryAssets({
    orderDirection: "desc",
    pagination: {
      limit: 50,
    },
  })

  // Transform Story assets to the expected Asset format and filter out assets without valid images
  const transformedAssets: Asset[] =
    assetsResponse?.data.map(transformStoryAssetToAsset).filter((asset) => {
      // Skip assets with placeholder images or no images
      return asset.src && asset.src !== "/placeholder.jpg" && !asset.src.includes("placeholder")
    }) || []

  return (
    <div
      className="flex h-screen bg-slate-100"
      style={{ "--top-bar-height": topBarHeight } as React.CSSProperties}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-slate-800">Assets Library</h1>
            <p className="text-slate-600">Browse, select, and manage your Story Protocol assets.</p>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                <span className="text-slate-600">Loading assets...</span>
              </div>
            </div>
          )}

          {isError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load assets: {error?.message || "Unknown error occurred"}
              </AlertDescription>
            </Alert>
          )}

          {assetsResponse && transformedAssets.length > 0 && (
            <AssetsView initialAssets={transformedAssets} />
          )}

          {assetsResponse && transformedAssets.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No assets found</h3>
                <p className="text-slate-600">
                  No Story Protocol assets are available at this time.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
