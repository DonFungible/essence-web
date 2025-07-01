import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import type { Asset } from "@/lib/assets-data"

interface ModelConfig {
  trigger_word: string
  description?: string
  training_steps: number
}

interface GenerateModelParams {
  selectedAssets: Asset[]
  modelConfig: ModelConfig
}

interface GenerateModelResponse {
  success: boolean
  trainingJobId: string
  replicateJobId: string
  message: string
  ipIds: string[]
}

export function useGenerateModel() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ selectedAssets, modelConfig }: GenerateModelParams) => {
      const response = await fetch("/api/generate-model-from-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedAssets,
          modelConfig,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate model")
      }

      return response.json() as Promise<GenerateModelResponse>
    },
    onSuccess: (data) => {
      toast({
        title: "Model Generation Started",
        description: data.message,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Model Generation Failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })
}
