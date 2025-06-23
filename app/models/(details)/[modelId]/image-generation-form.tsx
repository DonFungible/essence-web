"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Loader2, RefreshCw, AlertCircle, ChevronDown, Settings, ImageIcon } from "lucide-react"
import {
  useRecentGenerations,
  useGeneration,
  useGenerateImage,
  useGenerationSubscription,
  type GenerationRecord
} from "@/hooks/use-image-generation"
import type { GenerationParams } from "./generate-image"

interface ImageGenerationFormProps {
  modelId: string
  triggerWord?: string
}

const ASPECT_RATIOS = [
  { value: "21:9", label: "21:9 (Ultra-wide)" },
  { value: "16:9", label: "16:9 (Widescreen)" },
  { value: "3:2", label: "3:2 (Photo)" },
  { value: "4:3", label: "4:3 (Classic)" },
  { value: "5:4", label: "5:4 (Portrait)" },
  { value: "1:1", label: "1:1 (Square)" },
  { value: "4:5", label: "4:5 (Portrait)" },
  { value: "3:4", label: "3:4 (Portrait)" },
  { value: "2:3", label: "2:3 (Portrait)" },
  { value: "9:16", label: "9:16 (Mobile)" },
  { value: "9:21", label: "9:21 (Ultra Mobile)" },
]

const OUTPUT_FORMATS = [
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
]

export function ImageGenerationForm({ modelId, triggerWord }: ImageGenerationFormProps) {
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<GenerationParams>({
    prompt: "",
    aspect_ratio: "1:1",
    output_format: "jpg",
    safety_tolerance: 2,
    finetune_strength: 1.0,
    image_prompt_strength: 0.1,
    raw: false,
  })

  // Tanstack Query hooks
  const {
    data: recentGenerations = [],
    isLoading: isLoadingRecent,
    error: recentError,
    refetch: refetchRecent
  } = useRecentGenerations(modelId)

  const {
    data: currentGeneration,
    isLoading: isLoadingCurrent,
    error: currentError
  } = useGeneration(currentGenerationId)

  const generateMutation = useGenerateImage(modelId)

  // Set up real-time subscription for current generation
  useGenerationSubscription(currentGenerationId)

  // Clear current generation when it's completed
  useEffect(() => {
    if (currentGeneration?.status === 'succeeded' || currentGeneration?.status === 'failed') {
      // Delay clearing to let user see the result
      const timer = setTimeout(() => {
        setCurrentGenerationId(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [currentGeneration?.status])

  const updateFormData = (updates: Partial<GenerationParams>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  async function handleGenerate() {
    if (!formData.prompt?.trim()) return

    try {
      const result = await generateMutation.mutateAsync(formData)
      if (result.generationId) {
        setCurrentGenerationId(result.generationId)
      }
      // Clear only the prompt, keep other settings
      updateFormData({ prompt: "" })
    } catch (error) {
      console.error('Generation failed:', error)
      // Error is handled by the mutation's onError
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'succeeded': return 'bg-green-100 text-green-800 border-green-200'
      case 'failed': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'pending': return 'Starting...'
      case 'processing': return 'Generating...'
      case 'succeeded': return 'Complete'
      case 'failed': return 'Failed'
      default: return status
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'pending':
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'failed':
        return <AlertCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  const isGenerating = generateMutation.isPending || 
    (currentGeneration?.status === 'pending' || currentGeneration?.status === 'processing')

  return (
    <div className="space-y-6">
      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Images</CardTitle>
          {triggerWord && (
            <p className="text-sm text-muted-foreground">
              Your prompt will be enhanced with "in the style of {triggerWord}"
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Text Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Enter your prompt (e.g., 'a majestic lion in a forest')"
              value={formData.prompt}
              onChange={(e) => updateFormData({ prompt: e.target.value })}
              rows={3}
              disabled={isGenerating}
            />
          </div>

          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
              <Select 
                value={formData.aspect_ratio} 
                onValueChange={(value) => updateFormData({ aspect_ratio: value })}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="output-format">Output Format</Label>
              <Select 
                value={formData.output_format} 
                onValueChange={(value) => updateFormData({ output_format: value })}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Image Prompt (if provided) */}
          <div className="space-y-2">
            <Label htmlFor="image-prompt">Image Prompt (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="image-prompt"
                type="url"
                placeholder="https://example.com/reference-image.jpg"
                value={formData.image_prompt || ""}
                onChange={(e) => updateFormData({ image_prompt: e.target.value || undefined })}
                disabled={isGenerating}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isGenerating}
                onClick={() => {
                  // Could implement file upload here
                  console.log("Upload image functionality could be added here")
                }}
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional reference image to guide the composition
            </p>
          </div>

          {/* Advanced Settings */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0">
                <Settings className="w-4 h-4" />
                Advanced Settings
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              {/* Safety Tolerance */}
              <div className="space-y-2">
                <Label>Safety Tolerance: {formData.safety_tolerance}</Label>
                <Slider
                  value={[formData.safety_tolerance || 2]}
                  onValueChange={([value]) => updateFormData({ safety_tolerance: value })}
                  min={1}
                  max={6}
                  step={1}
                  disabled={isGenerating}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  1 is most strict, 6 is most permissive
                </p>
              </div>

              {/* Finetune Strength */}
              <div className="space-y-2">
                <Label>Finetune Strength: {formData.finetune_strength?.toFixed(2)}</Label>
                <Slider
                  value={[formData.finetune_strength || 1.0]}
                  onValueChange={([value]) => updateFormData({ finetune_strength: value })}
                  min={0}
                  max={2}
                  step={0.1}
                  disabled={isGenerating}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Controls how much the fine-tuned style influences the output
                </p>
              </div>

              {/* Image Prompt Strength */}
              {formData.image_prompt && (
                <div className="space-y-2">
                  <Label>Image Prompt Strength: {formData.image_prompt_strength?.toFixed(2)}</Label>
                  <Slider
                    value={[formData.image_prompt_strength || 0.1]}
                    onValueChange={([value]) => updateFormData({ image_prompt_strength: value })}
                    min={0}
                    max={1}
                    step={0.1}
                    disabled={isGenerating}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Blend between the text prompt and the image prompt
                  </p>
                </div>
              )}

              {/* Seed */}
              <div className="space-y-2">
                <Label htmlFor="seed">Seed (Optional)</Label>
                <Input
                  id="seed"
                  type="number"
                  placeholder="Random seed for reproducible generation"
                  value={formData.seed || ""}
                  onChange={(e) => updateFormData({ seed: e.target.value ? parseInt(e.target.value) : undefined })}
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  Set a specific number for reproducible results
                </p>
              </div>

              {/* Raw Mode */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="raw-mode"
                  checked={formData.raw}
                  onCheckedChange={(checked) => updateFormData({ raw: checked })}
                  disabled={isGenerating}
                />
                <Label htmlFor="raw-mode">Raw Mode</Label>
                <p className="text-xs text-muted-foreground ml-2">
                  Generate less processed, more natural-looking images
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {generateMutation.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {generateMutation.error.message}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !formData.prompt?.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {generateMutation.isPending ? 'Starting...' : 'Generating...'}
              </>
            ) : (
              'Generate Image'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Current Generation Progress */}
      {currentGeneration && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Generation Progress
                {getStatusIcon(currentGeneration.status)}
              </CardTitle>
              <Badge className={getStatusColor(currentGeneration.status)}>
                {getStatusText(currentGeneration.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Prompt:</p>
                <p className="text-sm text-muted-foreground">{currentGeneration.prompt}</p>
              </div>

              {currentGeneration.full_prompt && (
                <div>
                  <p className="text-sm font-medium">Enhanced Prompt:</p>
                  <p className="text-sm text-muted-foreground">{currentGeneration.full_prompt}</p>
                </div>
              )}

              {/* Generation Settings */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div>Aspect: {currentGeneration.aspect_ratio}</div>
                <div>Format: {currentGeneration.output_format}</div>
                <div>Safety: {currentGeneration.safety_tolerance}</div>
                <div>Strength: {currentGeneration.finetune_strength}</div>
              </div>

              {currentGeneration.error_message && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {currentGeneration.error_message}
                  </AlertDescription>
                </Alert>
              )}

              {currentGeneration.status === 'succeeded' && currentGeneration.supabase_image_url && (
                <div>
                  <p className="text-sm font-medium mb-2">Generated Image:</p>
                  <img
                    src={currentGeneration.supabase_image_url}
                    alt={currentGeneration.prompt}
                    className="w-full max-w-md rounded-lg border"
                    loading="lazy"
                  />
                  {currentGeneration.generation_time_seconds && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Generated in {currentGeneration.generation_time_seconds.toFixed(1)}s
                    </p>
                  )}
                </div>
              )}

              {(currentGeneration.status === 'pending' || currentGeneration.status === 'processing') && (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-sm text-muted-foreground">
                    {currentGeneration.status === 'pending' ? 'Waiting to start...' : 'Generating your image...'}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Generations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Generations</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchRecent()}
              disabled={isLoadingRecent}
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingRecent ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load recent generations: {recentError.message}
              </AlertDescription>
            </Alert>
          )}

          {isLoadingRecent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading recent generations...</span>
            </div>
          ) : recentGenerations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No generations yet. Create your first image above!
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentGenerations.map((generation) => (
                <div key={generation.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(generation.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(generation.status)}
                        {getStatusText(generation.status)}
                      </span>
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(generation.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-sm font-medium line-clamp-2">{generation.prompt}</p>
                  
                  {/* Generation details */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Aspect: {generation.aspect_ratio}</div>
                    {generation.seed && <div>Seed: {generation.seed}</div>}
                  </div>
                  
                  {generation.status === 'succeeded' && generation.supabase_image_url && (
                    <img
                      src={generation.supabase_image_url}
                      alt={generation.prompt}
                      className="w-full aspect-square object-cover rounded border"
                      loading="lazy"
                    />
                  )}
                  
                  {generation.status === 'failed' && generation.error_message && (
                    <p className="text-xs text-red-600 line-clamp-2">{generation.error_message}</p>
                  )}

                  {generation.generation_time_seconds && (
                    <p className="text-xs text-muted-foreground">
                      {generation.generation_time_seconds.toFixed(1)}s
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
