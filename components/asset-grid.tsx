"use client"

import { useState } from "react"
import AssetItem from "./asset-item"
import { Button } from "@/components/ui/button"
import { ImageIcon, Wand2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGenerateModel } from "@/hooks/use-model-generation"
import { useRouter } from "next/navigation"
import type { Asset } from "@/lib/assets-data"

interface AssetGridProps {
  assets: Asset[] // Changed from initialAssets to assets, assuming filtering might happen before this component
}

export default function AssetGrid({ assets }: AssetGridProps) {
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [modelConfig, setModelConfig] = useState({
    trigger_word: "",
    description: "",
    training_steps: 300,
  })

  const generateModel = useGenerateModel()
  const router = useRouter()

  const handleSelectAsset = (assetId: string) => {
    setSelectedAssets((prevSelected) => {
      const newSelected = new Set(prevSelected)
      if (newSelected.has(assetId)) {
        newSelected.delete(assetId)
      } else {
        newSelected.add(assetId)
      }
      console.log("Selected assets:", Array.from(newSelected))
      return newSelected
    })
  }

  const handleCompileSelected = () => {
    if (selectedAssets.size === 0) {
      alert("Please select at least one asset to generate a model.")
      return
    }

    // Check if any selected assets have IP IDs
    const selectedAssetDetails = assets.filter((asset) => selectedAssets.has(asset.id))
    const assetsWithIpIds = selectedAssetDetails.filter((asset) => asset.ipId)

    if (assetsWithIpIds.length === 0) {
      alert("Selected assets must have IP IDs to generate a model.")
      return
    }

    if (assetsWithIpIds.length < selectedAssetDetails.length) {
      alert(
        `Warning: Only ${assetsWithIpIds.length} of ${selectedAssetDetails.length} selected assets have IP IDs and will be used for model generation.`
      )
    }

    setIsConfigDialogOpen(true)
  }

  const handleGenerateModel = async () => {
    if (!modelConfig.trigger_word.trim()) {
      alert("Please enter a trigger word for your model.")
      return
    }

    const selectedAssetDetails = assets.filter((asset) => selectedAssets.has(asset.id))
    const assetsWithIpIds = selectedAssetDetails.filter((asset) => asset.ipId)

    try {
      const result = await generateModel.mutateAsync({
        selectedAssets: assetsWithIpIds,
        modelConfig: {
          trigger_word: modelConfig.trigger_word.trim(),
          description: modelConfig.description.trim() || undefined,
          training_steps: modelConfig.training_steps,
        },
      })

      setIsConfigDialogOpen(false)
      setSelectedAssets(new Set())
      setModelConfig({ trigger_word: "", description: "", training_steps: 300 })

      // Redirect to models page to see the training progress
      router.push("/models")
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  // Assuming loading state is handled by parent if assets are fetched/filtered there
  // if (isLoading) { ... }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-center p-4 border border-dashed rounded-lg border-slate-300">
        <ImageIcon className="h-12 w-12 text-slate-400 mb-4" />
        <h3 className="text-xl font-semibold text-slate-700 mb-1">No Assets Found</h3>
        <p className="text-slate-500">
          No assets match your current filters, or your library is empty.
        </p>
      </div>
    )
  }

  return (
    <div>
      {selectedAssets.size > 0 && (
        <div className="mb-6 p-4 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-between top-[calc(var(--top-bar-height,64px)+var(--filter-bar-height,120px))] z-20 shadow-sm">
          {/* Adjusted sticky top value if TopBar and FilterBar have fixed heights */}
          <p className="text-sm font-medium text-slate-700">
            {selectedAssets.size} asset{selectedAssets.size === 1 ? "" : "s"} selected
          </p>
          <Button onClick={handleCompileSelected} size="sm" variant="default">
            Generate Model
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {assets.map((asset) => (
          <AssetItem
            key={asset.id}
            asset={asset}
            isSelected={selectedAssets.has(asset.id)}
            onSelectToggle={handleSelectAsset}
          />
        ))}
      </div>

      {/* Model Configuration Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate AI Model</DialogTitle>
            <DialogDescription>
              Configure your AI model settings. The model will be trained using{" "}
              {selectedAssets.size} selected IP assets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="trigger_word">Model Name / Trigger Word</Label>
              <Input
                id="trigger_word"
                placeholder="e.g., MyUniqueStyle, ArtByYourName"
                value={modelConfig.trigger_word}
                onChange={(e) => setModelConfig({ ...modelConfig, trigger_word: e.target.value })}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                A unique word to activate your model. No spaces allowed.
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe your model's style or purpose..."
                value={modelConfig.description}
                onChange={(e) => setModelConfig({ ...modelConfig, description: e.target.value })}
                className="mt-1"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-slate-500 mt-1">
                {modelConfig.description.length}/200 characters
              </p>
            </div>

            <div>
              <Label htmlFor="training_steps">Training Steps</Label>
              <Select
                value={modelConfig.training_steps.toString()}
                onValueChange={(value) =>
                  setModelConfig({ ...modelConfig, training_steps: parseInt(value) })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="149">149</SelectItem>
                  <SelectItem value="300">300</SelectItem>
                  <SelectItem value="400">400</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="600">600</SelectItem>
                  <SelectItem value="700">700</SelectItem>
                  <SelectItem value="800">800</SelectItem>
                  <SelectItem value="900">900</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfigDialogOpen(false)}
              disabled={generateModel.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateModel}
              disabled={generateModel.isPending || !modelConfig.trigger_word.trim()}
            >
              {generateModel.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Model
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
