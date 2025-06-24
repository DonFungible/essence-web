"use client"

import Image from "next/image"
import Link from "next/link"
import { Clock, Cpu, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface TrainingModelCardProps {
  name: string
  description: string
  imageUrl: string
  status: string
  trainingSteps?: number | string
  captioning?: string
  createdAt: string
  href: string
}

export default function TrainingModelCard({
  name,
  description,
  imageUrl,
  status,
  trainingSteps,
  captioning,
  createdAt,
  href,
}: TrainingModelCardProps) {
  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMinutes = Math.floor(diffMs / (1000 * 60))

      if (diffHours > 0) {
        return `${diffHours}h ago`
      } else if (diffMinutes > 0) {
        return `${diffMinutes}m ago`
      } else {
        return "Just now"
      }
    } catch {
      return "Recently"
    }
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
      case "queued":
      case "submitted":
        return { label: "Pending", variant: "outline" as const, icon: Clock }
      case "starting":
        return { label: "Starting", variant: "secondary" as const, icon: Clock }
      case "processing":
        return { label: "Training", variant: "default" as const, icon: Loader2 }
      default:
        return { label: status, variant: "outline" as const, icon: Cpu }
    }
  }

  const statusDisplay = getStatusDisplay(status)
  const StatusIcon = statusDisplay.icon

  return (
    <Link
      href={href}
      className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded-xl"
    >
      <div className="relative w-full aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden shadow-sm transition-all duration-300 ease-in-out group-hover:shadow-lg group-hover:border-slate-400">
        {/* Training overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 z-10" />

        {/* Background image (preview or placeholder) */}
        <div className="absolute inset-0 opacity-30">
          <Image
            src={imageUrl}
            alt={`Training preview for ${name}`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>

        {/* Content */}
        <div className="absolute inset-0 z-20 p-5 flex flex-col justify-between text-slate-700">
          <div className="flex items-start justify-between">
            <Badge variant={statusDisplay.variant} className="flex items-center gap-1">
              <StatusIcon className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`} />
              {statusDisplay.label}
            </Badge>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-800 line-clamp-1">{name}</h3>

            {description && <p className="text-xs text-slate-600 line-clamp-2">{description}</p>}

            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                {trainingSteps && (
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    {trainingSteps} steps
                  </span>
                )}
                {captioning && <span className="truncate">{captioning}</span>}
              </div>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
