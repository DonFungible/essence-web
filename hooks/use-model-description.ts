import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { useEffect } from "react"

// Hook to fetch a single model's data
export function useModel(modelId: string) {
  return useQuery({
    queryKey: ["model", modelId],
    queryFn: async () => {
      if (!modelId) {
        throw new Error("No model ID provided")
      }

      const response = await fetch(`/api/models/${modelId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch model")
      }

      const result = await response.json()
      return result.data
    },
    enabled: !!modelId, // Only run query if modelId is provided
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Hook for updating model descriptions
export function useUpdateModelDescription(modelId: string) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Set up real-time subscription for model updates
  useEffect(() => {
    const channel = supabase
      .channel(`model-description-${modelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "training_jobs",
          filter: `replicate_job_id=eq.${modelId}`,
        },
        (payload) => {
          console.log("🔄 Real-time model description update:", payload)

          // Invalidate and refetch queries that might show this model
          queryClient.invalidateQueries({
            queryKey: ["models"],
          })
          queryClient.invalidateQueries({
            queryKey: ["model", modelId],
          })

          // Force refetch the specific model
          queryClient.refetchQueries({
            queryKey: ["model", modelId],
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [modelId, queryClient, supabase])

  return useMutation({
    mutationFn: async ({ description }: { description: string }) => {
      const response = await fetch(`/api/models/${modelId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update description")
      }

      return response.json()
    },
    onSuccess: (data) => {
      // Optimistically update the cache with the new description
      queryClient.setQueryData(["model", modelId], (oldData: any) => {
        if (oldData) {
          return {
            ...oldData,
            description: data.data.description,
          }
        }
        return oldData
      })

      // Also invalidate and refetch to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ["models"],
      })
      queryClient.refetchQueries({
        queryKey: ["model", modelId],
      })
    },
    onError: (error) => {
      console.error("Error updating model description:", error)
    },
  })
}
