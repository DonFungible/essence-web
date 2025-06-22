import Image from "next/image"
import Link from "next/link"
import { getImageById } from "@/components/image-grid" // Assuming image-grid exports these
import { ArrowLeft, User, Info, Cpu, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Sidebar from "@/components/sidebar" // Re-using sidebar for consistent layout
import TopBar from "@/components/top-bar" // Re-using topbar

interface ImageDetailPageProps {
  params: {
    id: string
  }
}

export default function ImageDetailPage({ params }: ImageDetailPageProps) {
  const imageId = Number.parseInt(params.id, 10)
  const image = getImageById(imageId)

  if (!image) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-100">
          <TopBar />
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <h1 className="text-2xl font-semibold text-slate-700 mb-4">Image not found</h1>
            <p className="text-slate-500 mb-6">Sorry, we couldn't find the image you're looking for.</p>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Go back to Explore
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <div className="max-w-6xl mx-auto">
            <Button variant="outline" asChild className="mb-6 text-slate-600 hover:bg-slate-50">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Explore
              </Link>
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Image Display Column */}
              <div className="lg:col-span-2 rounded-xl overflow-hidden shadow-xl">
                <Image
                  src={image.src || "/placeholder.svg"}
                  alt={image.alt}
                  width={1200} // Larger width for detail view
                  height={image.aspect === "portrait" ? 1800 : 800} // Adjusted height
                  className="w-full h-auto object-contain bg-slate-50"
                />
              </div>

              {/* Details Column */}
              <div className="lg:col-span-1 space-y-6">
                <div className="p-6 bg-slate-50 rounded-xl shadow-lg">
                  <h1 className="text-3xl font-bold text-slate-800 mb-3">{image.title}</h1>

                  <div className="flex items-center text-sm text-slate-600 mb-4">
                    <User className="w-4 h-4 mr-2 text-slate-500" />
                    <span>Created by: {image.author}</span>
                  </div>

                  <div className="space-y-1 mb-5">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                      <Info className="w-4 h-4 mr-2" />
                      Description
                    </h2>
                    <p className="text-slate-700 text-sm leading-relaxed">{image.description}</p>
                  </div>

                  <div className="space-y-1 mb-5">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                      <Cpu className="w-4 h-4 mr-2" />
                      AI Model
                    </h2>
                    <Badge variant="secondary" className="text-sm">
                      {image.model}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                      <Tag className="w-4 h-4 mr-2" />
                      Tags
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Surreal</Badge>
                      <Badge variant="outline">Landscape</Badge>
                      <Badge variant="outline">Monolith</Badge>
                      {/* Add more tags based on image data if available */}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-xl shadow-lg space-y-3">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Actions</h2>
                  <Button className="w-full">Download Image</Button>
                  <Button variant="outline" className="w-full">
                    Add to Collection
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-300 hover:border-red-400"
                  >
                    Report Image
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
