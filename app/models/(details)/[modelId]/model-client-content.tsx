"use client"

import type { ModelType } from "@/lib/models-data"
import RecentGenerationsGrid from "./recent-generations-grid"

interface ModelClientContentProps {
  model: ModelType
}

export default function ModelClientContent({ model }: ModelClientContentProps) {
  return (
    <div>
      <RecentGenerationsGrid modelId={model.id} modelName={model.name} />
    </div>
  )
}
