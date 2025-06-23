import React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import {
  generateImage,
  type GenerationParams,
} from "@/app/models/(details)/[modelId]/generate-image"

export interface GenerationRecord {
  id: string
  status: "pending" | "processing" | "succeeded" | "failed"
  prompt: string
  full_prompt: string
  image_url?: string
  supabase_image_url?: string
  error_message?: string
  created_at: string
  completed_at?: string
  generation_time_seconds?: number
  model_id: string
  replicate_prediction_id: string
  aspect_ratio: string
  output_format: string
  safety_tolerance: number
  finetune_strength: number
  image_prompt_strength: number
  raw: boolean
  seed?: number
  image_prompt?: string
}

// Query Keys
export const imageGenerationKeys = {
  all: ["image-generations"] as const,
  lists: () => [...imageGenerationKeys.all, "list"] as const,
  list: (modelId: string) => [...imageGenerationKeys.lists(), modelId] as const,
  details: () => [...imageGenerationKeys.all, "detail"] as const,
  detail: (id: string) => [...imageGenerationKeys.details(), id] as const,
}

// Hook to fetch recent generations for a model with real-time updates
export function useRecentGenerations(modelId: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: imageGenerationKeys.list(modelId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("image_generations")
        .select("*")
        .eq("model_id", modelId)
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) {
        throw new Error(`Failed to fetch generations: ${error.message}`)
      }

      return data as GenerationRecord[]
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: (query) => {
      // Poll every 1 second if there are pending/processing generations
      const data = query.state.data as GenerationRecord[] | undefined
      const hasPendingGenerations = data?.some(
        (gen) => gen.status === "pending" || gen.status === "processing"
      )
      return hasPendingGenerations ? 1000 : false
    },
  })

  // Set up real-time subscription for this model's generations
  React.useEffect(() => {
    const channel = supabase
      .channel(`model-generations-${modelId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "image_generations",
          filter: `model_id=eq.${modelId}`,
        },
        (payload) => {
          console.log("🔄 Real-time model generation update:", payload)

          // Invalidate and refetch the generations list
          queryClient.invalidateQueries({
            queryKey: imageGenerationKeys.list(modelId),
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [modelId, queryClient, supabase])

  return query
}

// Hook to fetch a specific generation
export function useGeneration(generationId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: imageGenerationKeys.detail(generationId || ""),
    queryFn: async () => {
      if (!generationId) return null

      const { data, error } = await supabase
        .from("image_generations")
        .select("*")
        .eq("id", generationId)
        .single()

      if (error) {
        throw new Error(`Failed to fetch generation: ${error.message}`)
      }

      return data as GenerationRecord
    },
    enabled: !!generationId,
    refetchInterval: (query) => {
      // Refetch every 2 seconds if generation is in progress
      const data = query.state.data as GenerationRecord | null
      if (data?.status === "pending" || data?.status === "processing") {
        return 2000
      }
      // Stop refetching if completed
      return false
    },
  })
}

// Hook for generating images
export function useGenerateImage(modelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: GenerationParams) => {
      const result = await generateImage(modelId, params)
      if (!result.success) {
        throw new Error(result.error || "Generation failed")
      }
      return result
    },
    onSuccess: (data) => {
      // Invalidate and refetch recent generations
      queryClient.invalidateQueries({
        queryKey: imageGenerationKeys.list(modelId),
      })

      // If we have a generation ID, start polling for updates
      if (data.generationId) {
        queryClient.invalidateQueries({
          queryKey: imageGenerationKeys.detail(data.generationId),
        })
      }
    },
    onError: (error) => {
      console.error("Generation mutation error:", error)
    },
  })
}

// Hook for real-time updates via Supabase subscriptions
export function useGenerationSubscription(generationId: string | null) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useQuery({
    queryKey: ["subscription", generationId],
    queryFn: () => Promise.resolve(null), // No-op query function
    enabled: !!generationId,
    staleTime: Infinity, // Never stale
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    initialData: null,
    meta: {
      onMount: () => {
        if (!generationId) return

        const channel = supabase
          .channel(`generation-updates-${generationId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "image_generations",
              filter: `id=eq.${generationId}`,
            },
            (payload) => {
              console.log("🔄 Real-time generation update:", payload.new)

              // Update the specific generation cache
              queryClient.setQueryData(
                imageGenerationKeys.detail(generationId),
                payload.new as GenerationRecord
              )

              // Also invalidate the list to keep it fresh
              const generation = payload.new as GenerationRecord
              queryClient.invalidateQueries({
                queryKey: imageGenerationKeys.list(generation.model_id),
              })
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      },
    },
  })
}
