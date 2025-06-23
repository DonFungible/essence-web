#!/usr/bin/env node

/**
 * Test script for style reference images from Supabase storage
 * Usage: node scripts/test-style-images.js [modelName]
 */

const { createClient } = require("@supabase/supabase-js")
require("dotenv").config()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables:")
  console.error("   NEXT_PUBLIC_SUPABASE_URL")
  console.error("   SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

async function testStyleImages(modelName = "MCESCHER") {
  console.log(`🧪 Testing Style Reference Images for model: ${modelName}\n`)

  try {
    // Create Supabase admin client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    console.log("1️⃣ Checking if assets bucket exists...")

    // Check if assets bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    if (bucketsError) {
      console.error("❌ Error listing buckets:", bucketsError)
      return
    }

    const assetsBucket = buckets.find((bucket) => bucket.id === "assets")
    if (!assetsBucket) {
      console.log("❌ Assets bucket not found. Please create it in Supabase dashboard.")
      console.log("   Go to: Supabase Dashboard > Storage > Create Bucket")
      console.log("   Name: assets")
      console.log("   Make it public: ✅")
      return
    }

    console.log("✅ Assets bucket exists and is", assetsBucket.public ? "public" : "private")

    console.log(`\n2️⃣ Listing files in assets/${modelName}/...`)

    // List files in the model folder
    const { data: files, error: listError } = await supabase.storage
      .from("assets")
      .list(modelName, {
        limit: 10,
        sortBy: { column: "name", order: "asc" },
      })

    if (listError) {
      console.error("❌ Error listing files:", listError)
      return
    }

    if (!files || files.length === 0) {
      console.log(`📁 No files found in assets/${modelName}/`)
      console.log("\n💡 To test this feature:")
      console.log(`   1. Go to Supabase Dashboard > Storage > assets`)
      console.log(`   2. Create folder: ${modelName}`)
      console.log(`   3. Upload 1-4 images (.png, .jpg, .webp, .gif) to the folder`)
      return
    }

    console.log(`✅ Found ${files.length} file(s):`)

    // Filter for image files
    const imageFiles = files.filter(
      (file) =>
        file.name && /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name) && !file.name.startsWith(".")
    )

    if (imageFiles.length === 0) {
      console.log("📄 Files found but no image files (.png, .jpg, .webp, .gif)")
      files.forEach((file) => console.log(`   - ${file.name}`))
      return
    }

    console.log(`🖼️  Found ${imageFiles.length} image file(s):`)

    // Get public URLs for images
    const styleImages = imageFiles.slice(0, 4).map((file) => {
      const { data: urlData } = supabase.storage
        .from("assets")
        .getPublicUrl(`${modelName}/${file.name}`)

      return {
        name: file.name,
        url: urlData.publicUrl,
        size: `${Math.round(file.metadata?.size / 1024) || "unknown"}KB`,
      }
    })

    styleImages.forEach((img, index) => {
      console.log(`   ${index + 1}. ${img.name} (${img.size})`)
      console.log(`      URL: ${img.url}`)
    })

    console.log(`\n✅ Style reference images system working correctly!`)
    console.log(`📊 Result: ${styleImages.length} image(s) would be displayed on model page`)
  } catch (error) {
    console.error("❌ Unexpected error:", error)
  }
}

// Get model name from command line or use default
const modelName = process.argv[2] || "MCESCHER"
testStyleImages(modelName)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
