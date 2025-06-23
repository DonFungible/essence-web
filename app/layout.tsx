import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { PromptBar } from "@/components/prompt-bar"
import { Toaster } from "@/components/ui/sonner"

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
      <body>
        <main className="relative pb-32">{children}</main>
        <PromptBar />
        <Toaster />
      </body>
    </html>
  )
}
