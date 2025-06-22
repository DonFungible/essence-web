"use client"

import { useState } from "react"
import Image, { type ImageProps } from "next/image"

/**
 * Next/Image wrapper that swaps to a placeholder when the original src fails.
 * Keeps aspect-ratio with `fill` or width/height exactly like <Image />.
 */
export default function SafeImage({
  fallbackSrc = "/placeholder.svg",
  ...props
}: ImageProps & { fallbackSrc?: string }) {
  const [src, setSrc] = useState(props.src)

  return (
    <Image
      {...props}
      src={src || "/placeholder.svg"}
      onError={() => setSrc(fallbackSrc)}
      // When the remote image is large or hosted elsewhere, disabling optimisation
      // avoids a second request to Vercel’s image optimiser that might 404 again.
      unoptimized
    />
  )
}
