import Link from "next/link"
import SafeImage from "@/components/safe-image"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import { models } from "@/lib/models-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Plus } from "lucide-react"

export default function ModelsPage() {
  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">AI Models</h1>
                <p className="text-slate-500 mt-1">Explore our fine-tuned models or train your own.</p>
              </div>
              <Button asChild>
                <Link href="/train">
                  <Plus className="mr-2 h-4 w-4" />
                  Train New Model
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {models.map((model) => (
                <Card key={model.id} className="flex flex-col hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <div className="w-full h-40 rounded-lg overflow-hidden mb-4">
                      <SafeImage
                        src={model.exampleImages[0] || "/placeholder.svg"}
                        alt={`Example from ${model.name}`}
                        width={400}
                        height={250}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardTitle className="text-xl">{model.name}</CardTitle>
                    <Badge variant="secondary" className="w-fit">
                      {model.version}
                    </Badge>
                    <CardDescription className="pt-2">{model.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <h4 className="text-sm font-semibold text-slate-600 mb-2">Key Styles</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {model.styles.slice(0, 4).map((style) => (
                        <Badge key={style} variant="outline">
                          {style}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full">
                      <Link href={`/models/${model.id}`}>
                        Explore Model <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
