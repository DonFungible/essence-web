import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { PromptBar } from "@/components/prompt-bar"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      {/* 
        You can apply the background image class directly to the body.
        The `bg-[url('/path/to/texture.png')]` class tells Tailwind to use that image.
        The `bg-repeat` class ensures it tiles.
      */}
      <body
        className={cn(
          "bg-background text-foreground", // Your existing background/text colors
          "bg-[url('/subtle-noise-texture.png')] bg-repeat", // Add texture
        )}
      >
        <main className="relative pb-32">{children}</main>
        <PromptBar />
        <Toaster />
      </body>
    </html>
  )
}
