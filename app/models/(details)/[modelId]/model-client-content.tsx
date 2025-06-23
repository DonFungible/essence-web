"use client"

import type { ModelType } from "@/lib/models-data"
import { ImageGenerationForm } from "./image-generation-form"
import RecentGenerationsGrid from "./recent-generations-grid"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wand2 } from "lucide-react"

interface ModelClientContentProps {
  model: ModelType
}

export default function ModelClientContent({ model }: ModelClientContentProps) {
  // For database models, they might have a trigger_word. Static models might not.
  // The modelId for database models is typically a long Replicate ID.
  const isDatabaseModel = model.id.length > 20 // Heuristic to check if it's a Replicate model ID
  const triggerWord = (model as any).trigger_word || undefined

  return (
    <div className="space-y-8">
      {isDatabaseModel && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Wand2 className="mr-2 h-6 w-6 text-slate-500" />
              Generate with {model.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ImageGenerationForm modelId={model.id} triggerWord={triggerWord} />
          </CardContent>
        </Card>
      )}

      <RecentGenerationsGrid modelId={model.id} modelName={model.name} />
    </div>
  )
}
