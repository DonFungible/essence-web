"use client"

import { useState, useEffect } from "react"
import { type ModelType, models as staticModels, transformDbModelToUIModel } from "@/lib/models-data"
import { createClient } from "@/utils/supabase/client"

export function useModels() {
  const [models, setModels] = useState<ModelType[]>(staticModels)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTrainedModels = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.from("training_jobs").select("*").eq("status", "succeeded")

        if (error) {
          throw error
        }

        const trainedModels = data.map(transformDbModelToUIModel)

        // Combine and remove duplicates, giving preference to trained models
        setModels((prevModels) => {
          const staticModelIds = new Set(prevModels.map((m) => m.id))
          const newTrainedModels = trainedModels.filter((tm) => !staticModelIds.has(tm.id))
          return [...prevModels, ...newTrainedModels]
        })
      } catch (error) {
        console.error("Error fetching trained models:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrainedModels()
  }, [])

  return { models, isLoading }
}
