#!/usr/bin/env node

/**
 * Test script for zip-images API endpoint
 * Usage: node scripts/test-zip-images.js
 */

const fs = require("fs")
const path = require("path")

const BASE_URL = "http://localhost:3000"

// Create test images (simple 1x1 pixel PNG data)
function createTestImage(name) {
  // 1x1 transparent PNG
  const pngData = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ])

  return new File([pngData], name, { type: "image/png" })
}

async function testZipImages() {
  console.log("🧪 Testing Zip Images API...\n")

  try {
    // Test 1: Valid images without training job ID
    console.log("🧪 Test 1: Creating zip from 5 images (no training job ID)...")

    const formData1 = new FormData()
    for (let i = 1; i <= 5; i++) {
      const imageBlob = new Blob(
        [
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
            0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
          ]),
        ],
        { type: "image/png" }
      )

      formData1.append("images", imageBlob, `test-image-${i}.png`)
    }

    const response1 = await fetch(`${BASE_URL}/api/zip-images`, {
      method: "POST",
      body: formData1,
    })

    if (!response1.ok) {
      const error = await response1.json()
      console.error("❌ Test 1 failed:", error)
    } else {
      const result = await response1.json()
      console.log("✅ Test 1 passed:")
      console.log("📦 ZIP created with", result.originalFileCount, "images")
      console.log("📏 ZIP size:", result.zipSizeMB, "MB")
      console.log("🔗 Public URL:", result.publicUrl.substring(0, 50) + "...")
      console.log("")
    }

    // Test 2: With training job ID (simulated)
    console.log("🧪 Test 2: Creating zip with training job ID...")

    const formData2 = new FormData()
    for (let i = 1; i <= 6; i++) {
      const imageBlob = new Blob(
        [
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
            0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
          ]),
        ],
        { type: "image/png" }
      )

      formData2.append("images", imageBlob, `training-image-${i}.png`)
    }

    // Add a test training job ID
    formData2.append("trainingJobId", "test-training-job-id-123")

    const response2 = await fetch(`${BASE_URL}/api/zip-images`, {
      method: "POST",
      body: formData2,
    })

    if (!response2.ok) {
      const error = await response2.json()
      console.log("⚠️ Test 2 (with training job ID) failed:", error.error)
      console.log("   This is expected if the training job ID doesn't exist in the database")
    } else {
      const result = await response2.json()
      console.log("✅ Test 2 passed:")
      console.log("📦 ZIP created with", result.originalFileCount, "images")
      console.log("💾 Individual images should be stored in database")
      console.log("")
    }

    // Test 3: Too few images
    console.log("🧪 Test 3: Testing minimum image requirement (3 images)...")

    const formData3 = new FormData()
    for (let i = 1; i <= 3; i++) {
      const imageBlob = new Blob(
        [
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
            0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
          ]),
        ],
        { type: "image/png" }
      )

      formData3.append("images", imageBlob, `few-image-${i}.png`)
    }

    const response3 = await fetch(`${BASE_URL}/api/zip-images`, {
      method: "POST",
      body: formData3,
    })

    if (!response3.ok) {
      const error = await response3.json()
      console.log("✅ Test 3 passed - minimum image validation working:", error.error)
    } else {
      console.log("❌ Test 3 failed - should reject less than 5 images")
    }

    // Test 4: Invalid file type
    console.log("\n🧪 Test 4: Testing invalid file type...")

    const formData4 = new FormData()
    // Add valid images first
    for (let i = 1; i <= 4; i++) {
      const imageBlob = new Blob(
        [
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
            0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
            0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
          ]),
        ],
        { type: "image/png" }
      )

      formData4.append("images", imageBlob, `valid-image-${i}.png`)
    }

    // Add invalid file type
    const textBlob = new Blob(["This is not an image"], { type: "text/plain" })
    formData4.append("images", textBlob, "invalid-file.txt")

    const response4 = await fetch(`${BASE_URL}/api/zip-images`, {
      method: "POST",
      body: formData4,
    })

    if (!response4.ok) {
      const error = await response4.json()
      console.log("✅ Test 4 passed - file type validation working:", error.error)
    } else {
      console.log("❌ Test 4 failed - should reject non-image files")
    }

    console.log("\n🎉 All zip-images tests completed!")
    console.log("\n💡 Note: Tests with training job IDs may fail if the database is not set up")
    console.log("   or if the training job ID doesn't exist. This is expected behavior.")
  } catch (error) {
    console.error("❌ Test failed:", error.message)
    console.log("\n💡 Make sure the dev server is running: pnpm dev")
    console.log("💡 Make sure the database migration has been applied")
  }
}

// Run the test
testZipImages()
