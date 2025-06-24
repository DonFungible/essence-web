/**
 * Test script for style image extraction from training zip files
 * Run with: node scripts/test-style-extraction.js
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000"

async function testStyleExtraction() {
  console.log("🧪 Testing Style Image Extraction API")
  console.log("=====================================")

  // Test data - you can replace these with real values
  const testData = {
    zipUrl: "https://example.com/path-to-training-images.zip", // Replace with real zip URL
    triggerWord: "TEST_STYLE_001",
    maxImages: 4,
    jobId: "test-job-" + Date.now(),
  }

  console.log("📝 Test Parameters:")
  console.log(`   Trigger Word: ${testData.triggerWord}`)
  console.log(`   Max Images: ${testData.maxImages}`)
  console.log(`   Job ID: ${testData.jobId}`)
  console.log(`   API URL: ${API_BASE_URL}/api/extract-style-images`)
  console.log("")

  try {
    console.log("🚀 Starting extraction...")

    const response = await fetch(`${API_BASE_URL}/api/extract-style-images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    })

    const result = await response.json()

    if (response.ok && result.success) {
      console.log("✅ Style image extraction successful!")
      console.log("")
      console.log("📊 Results:")
      console.log(`   Images extracted: ${result.totalExtracted}`)
      console.log(`   Storage path: ${result.storagePath}`)
      console.log(`   From cache: ${result.fromCache ? "Yes" : "No"}`)
      console.log("")

      if (result.uploadedImages && result.uploadedImages.length > 0) {
        console.log("🖼️ Uploaded Images:")
        result.uploadedImages.forEach((img, index) => {
          console.log(`   ${index + 1}. ${img.originalFilename}`)
          console.log(`      Storage: ${img.storagePath}`)
          console.log(`      Size: ${Math.round(img.size / 1024)}KB`)
          console.log(`      URL: ${img.publicUrl}`)
          console.log("")
        })
      }

      // Verify images are accessible
      if (result.uploadedImages && result.uploadedImages.length > 0) {
        console.log("🔍 Verifying image accessibility...")
        const firstImage = result.uploadedImages[0]

        try {
          const imageResponse = await fetch(firstImage.publicUrl, { method: "HEAD" })
          if (imageResponse.ok) {
            console.log("✅ First image is accessible via public URL")
          } else {
            console.log("⚠️ First image URL returned:", imageResponse.status)
          }
        } catch (imgError) {
          console.log("⚠️ Could not verify image accessibility:", imgError.message)
        }
      }
    } else {
      console.log("❌ Style image extraction failed!")
      console.log(`   Status: ${response.status}`)
      console.log(`   Error: ${result.error}`)
      if (result.details) {
        console.log(`   Details: ${result.details}`)
      }
    }
  } catch (error) {
    console.log("💥 Test failed with error:")
    console.log(`   ${error.message}`)
    console.log("")
    console.log("🔧 Possible issues:")
    console.log("   - API server not running")
    console.log("   - Invalid zip URL")
    console.log("   - Supabase configuration issues")
    console.log("   - JSZip dependency not installed")
  }

  console.log("")
  console.log("📋 Manual Testing Steps:")
  console.log("1. Replace zipUrl with a real training zip file URL")
  console.log("2. Check your Supabase assets bucket for uploaded images")
  console.log("3. Verify database updates in training_jobs table")
  console.log("4. Test with different trigger words and zip files")
}

// Auto-run if called directly
if (require.main === module) {
  testStyleExtraction()
}

module.exports = { testStyleExtraction }
