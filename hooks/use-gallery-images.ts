import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/utils/supabase/client"
import { useEffect } from "react"

export interface GalleryImage {
  id: number
  title: string
  src: string
  alt: string
  aspect: "portrait" | "landscape"
  author: string
  description: string
  model: string
  created_at: string
  updated_at: string
}

// Query Keys
export const galleryImageKeys = {
  all: ["gallery-images"] as const,
  lists: () => [...galleryImageKeys.all, "list"] as const,
  list: () => [...galleryImageKeys.lists()] as const,
  details: () => [...galleryImageKeys.all, "detail"] as const,
  detail: (id: number) => [...galleryImageKeys.details(), id] as const,
}

// Hook to fetch all gallery images
export function useGalleryImages() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: galleryImageKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .order("id", { ascending: true })

      if (error) {
        throw new Error(`Failed to fetch gallery images: ${error.message}`)
      }

      return data as GalleryImage[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Set up real-time subscription for gallery images
  useEffect(() => {
    const channel = supabase
      .channel("gallery-images-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "gallery_images",
        },
        (payload) => {
          console.log("🔄 Real-time gallery image update:", payload)

          // Invalidate and refetch the gallery images list
          queryClient.invalidateQueries({
            queryKey: galleryImageKeys.list(),
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, supabase])

  return query
}

// Hook to fetch a single gallery image
export function useGalleryImage(id: number) {
  const supabase = createClient()

  return useQuery({
    queryKey: galleryImageKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .eq("id", id)
        .single()

      if (error) {
        throw new Error(`Failed to fetch gallery image: ${error.message}`)
      }

      return data as GalleryImage
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Hook for updating gallery image descriptions
export function useUpdateGalleryImageDescription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, description }: { id: number; description: string }) => {
      const response = await fetch(`/api/gallery-images/${id}`, {
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
    onSuccess: (data, variables) => {
      // Update the specific image in the cache
      queryClient.setQueryData(galleryImageKeys.detail(variables.id), data.data)

      // Update the image in the list cache
      queryClient.setQueryData(galleryImageKeys.list(), (oldData: GalleryImage[] | undefined) => {
        if (!oldData) return oldData
        return oldData.map((image) => (image.id === variables.id ? data.data : image))
      })

      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: galleryImageKeys.all,
      })
    },
    onError: (error) => {
      console.error("Error updating gallery image description:", error)
    },
  })
}
