"use client"

import Image from "next/image"
import Link from "next/link"
import { CheckCircle, Users, MessageSquare } from "lucide-react"

interface ModelHoverCardProps {
  name: string
  description: string // Kept in props for potential future use, but not rendered
  imageUrl: string
  followers: number | string
  posts: number | string
  isVerified?: boolean
  href: string
}

export default function ModelHoverCard({
  name,
  imageUrl,
  followers,
  posts,
  isVerified = false,
  href,
}: ModelHoverCardProps) {
  return (
    <Link
      href={href}
      className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded-xl"
    >
      <div className="relative w-full aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden shadow-lg transition-shadow duration-300 ease-in-out group-hover:shadow-2xl">
        {/* Image Container: Always full height */}
        <div className="absolute inset-0">
          <Image
            src={imageUrl || `/placeholder.svg?width=300&height=400&query=model+image+${encodeURIComponent(name)}`}
            alt={`Image for ${name}`}
            fill
            className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>

        {/* Permanent Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/50 to-transparent pointer-events-none" />

        {/* Content Block: Static position at the bottom */}
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          {/* Name & Verified Icon */}
          <div className="flex items-center mb-2">
            <h3 className="text-xl font-serif font-medium mr-1.5 text-white">{name}</h3>
            {isVerified && <CheckCircle className="w-5 h-5 text-sky-400" />}
          </div>

          {/* Stats (Followers, Posts) */}
          <div className="flex items-center text-xs text-slate-300">
            <div className="flex items-center mr-4">
              <Users className="w-3.5 h-3.5 mr-1" />
              <span>{followers}</span>
            </div>
            <div className="flex items-center">
              <MessageSquare className="w-3.5 h-3.5 mr-1" />
              <span>{posts}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
