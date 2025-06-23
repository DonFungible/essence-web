import type { Metadata } from "next"

import ModelClientContent from "./model-client-content"
import { Shell } from "@/components/shell"
import { getModel } from "@/lib/api"
import { absoluteUrl } from "@/lib/utils"
import { QueryProvider } from "@/components/query-provider"

interface Props {
  params: {
    modelId: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const model = await getModel(params.modelId)

  if (!model) {
    return {
      title: "Model Not Found",
    }
  }

  return {
    title: model.name,
    description: model.description,
    openGraph: {
      title: model.name,
      description: model.description,
      url: absoluteUrl(`/models/${model.id}`),
      siteName: "Next.js",
      images: [
        {
          url: absoluteUrl(`/og.jpg`),
          width: 1200,
          height: 630,
          alt: model.name,
        },
      ],
      locale: "en_US",
      type: "website",
    },
  }
}

export default async function ModelPage({ params }: Props) {
  const model = await getModel(params.modelId)

  if (!model) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Model Not Found</h1>
        </div>
      </Shell>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
        {model.description && <p className="text-slate-600 max-w-2xl">{model.description}</p>}
      </header>

      {/* --- provide React-Query context for all hooks below --- */}
      <QueryProvider>
        <ModelClientContent model={model} />
      </QueryProvider>
    </div>
  )
}
