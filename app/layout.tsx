import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { PromptBar } from "@/components/prompt-bar"
import { Toaster } from "@/components/ui/sonner"
import { QueryProvider } from "@/components/query-provider"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "App",
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
      <body
        className={cn(
          "bg-background text-foreground" // Your existing background/text colors
        )}
      >
        <QueryProvider>
          <main className="relative pb-32">{children}</main>
          <PromptBar />
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
