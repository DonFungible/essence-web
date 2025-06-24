import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

// Hook for hiding/deleting training jobs (models)
export function useDeleteModel() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (modelId: string) => {
      const response = await fetch(`/api/training-jobs/${modelId}/hide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete model")
      }

      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "Model Deleted",
        description: "The model has been successfully deleted.",
      })

      // Refresh the router to refetch server-side data
      router.refresh()

      // Also invalidate any React Query caches for good measure
      queryClient.invalidateQueries({ queryKey: ["models"] })
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete the model. Please try again.",
        variant: "destructive",
      })
    },
  })
}

// Hook for hiding/deleting image generations
export function useDeleteGeneration() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (generationId: string) => {
      const response = await fetch(`/api/image-generations/${generationId}/hide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete generation")
      }

      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "Generation Deleted",
        description: "The image generation has been successfully deleted.",
      })

      // Refresh the router to refetch server-side data
      router.refresh()

      // Also invalidate generation queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["image-generations"] })
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete the generation. Please try again.",
        variant: "destructive",
      })
    },
  })
}
