#!/usr/bin/env node

/**
 * Test script for upload URL generation
 * Usage: node scripts/test-upload.js
 */

import fetch from "node-fetch"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

console.log("🧪 Testing Upload System")
console.log("========================\n")

// Test Supabase configuration
async function testSupabaseConfig() {
  console.log("1. Testing Supabase Configuration")
  console.log("----------------------------------")

  const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]

  let allPresent = true
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Present`)
    } else {
      console.log(`❌ ${envVar}: Missing`)
      allPresent = false
    }
  }

  if (!allPresent) {
    console.log("\n⚠️  Missing environment variables will cause upload failures\n")
    return false
  }

  console.log("\n✅ All required environment variables are present\n")
  return true
}

// Test presigned URL generation
async function testPresignedUrlGeneration() {
  console.log("2. Testing Presigned URL Generation")
  console.log("-----------------------------------")

  try {
    const testFiles = [
      {
        name: "test1.jpg",
        size: 1024 * 1024, // 1MB
        type: "image/jpeg",
      },
      {
        name: "test2.png",
        size: 2 * 1024 * 1024, // 2MB
        type: "image/png",
      },
      {
        name: "test3.webp",
        size: 500 * 1024, // 500KB
        type: "image/webp",
      },
      {
        name: "test4.gif",
        size: 3 * 1024 * 1024, // 3MB
        type: "image/gif",
      },
      {
        name: "test5.jpg",
        size: 1.5 * 1024 * 1024, // 1.5MB
        type: "image/jpeg",
      },
    ]

    const trainingJobId = `test-${Date.now()}`

    console.log(`📤 Requesting URLs for ${testFiles.length} test files...`)

    const response = await fetch(`${BASE_URL}/api/upload-presigned`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: testFiles,
        trainingJobId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.log(`❌ Presigned URL generation failed: ${errorData.error}`)
      return false
    }

    const result = await response.json()

    // Validate response structure
    if (!result.success || !result.uploadUrls || !result.zipUpload) {
      console.log("❌ Invalid response structure")
      return false
    }

    console.log(`✅ Generated ${result.uploadUrls.length} image URLs`)
    console.log(`✅ Generated ZIP upload URL`)

    // Test URL format validation
    let validUrls = 0
    for (const upload of result.uploadUrls) {
      try {
        new URL(upload.uploadUrl)
        new URL(upload.publicUrl)
        validUrls++
      } catch (error) {
        console.log(`❌ Invalid URL format for ${upload.originalName}`)
      }
    }

    // Test ZIP URL
    try {
      new URL(result.zipUpload.uploadUrl)
      new URL(result.zipUpload.publicUrl)
      console.log(`✅ ZIP URLs are valid`)
    } catch (error) {
      console.log(`❌ Invalid ZIP URL format`)
      return false
    }

    console.log(`✅ ${validUrls}/${result.uploadUrls.length} upload URLs are valid`)

    if (validUrls === result.uploadUrls.length) {
      console.log("\n✅ Presigned URL generation test passed\n")
      return true
    } else {
      console.log("\n❌ Some URLs are invalid\n")
      return false
    }
  } catch (error) {
    console.log(`❌ Presigned URL test failed: ${error.message}`)
    return false
  }
}

// Test invalid file types
async function testFileValidation() {
  console.log("3. Testing File Validation")
  console.log("---------------------------")

  try {
    // Test invalid file type
    const invalidFiles = [
      {
        name: "document.pdf",
        size: 1024 * 1024,
        type: "application/pdf",
      },
    ]

    const response = await fetch(`${BASE_URL}/api/upload-presigned`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: invalidFiles,
        trainingJobId: "test-validation",
      }),
    })

    if (response.ok) {
      console.log("❌ File type validation failed - should reject non-image files")
      return false
    } else {
      const error = await response.json()
      console.log("✅ File type validation working:", error.error)
    }

    // Test oversized file
    const oversizedFiles = [
      {
        name: "huge.jpg",
        size: 15 * 1024 * 1024, // 15MB (over 10MB limit)
        type: "image/jpeg",
      },
    ]

    const oversizedResponse = await fetch(`${BASE_URL}/api/upload-presigned`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: oversizedFiles,
        trainingJobId: "test-validation",
      }),
    })

    if (oversizedResponse.ok) {
      console.log("❌ File size validation failed - should reject files over 10MB")
      return false
    } else {
      const error = await oversizedResponse.json()
      console.log("✅ File size validation working:", error.error)
    }

    // Test too few files
    const tooFewFiles = [
      {
        name: "single.jpg",
        size: 1024 * 1024,
        type: "image/jpeg",
      },
    ]

    const tooFewResponse = await fetch(`${BASE_URL}/api/upload-presigned`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: tooFewFiles,
        trainingJobId: "test-validation",
      }),
    })

    if (tooFewResponse.ok) {
      console.log("❌ File count validation failed - should require at least 5 images")
      return false
    } else {
      const error = await tooFewResponse.json()
      console.log("✅ File count validation working:", error.error)
    }

    console.log("\n✅ File validation tests passed\n")
    return true
  } catch (error) {
    console.log(`❌ File validation test failed: ${error.message}`)
    return false
  }
}

// Main test function
async function runTests() {
  try {
    console.log(`🌐 Testing against: ${BASE_URL}\n`)

    const configTest = await testSupabaseConfig()
    const urlTest = await testPresignedUrlGeneration()
    const validationTest = await testFileValidation()

    console.log("📊 Test Results Summary")
    console.log("=======================")
    console.log(`Configuration: ${configTest ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`URL Generation: ${urlTest ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`File Validation: ${validationTest ? "✅ PASS" : "❌ FAIL"}`)

    if (configTest && urlTest && validationTest) {
      console.log("\n🎉 All upload tests passed! The upload system should work correctly.")
    } else {
      console.log("\n⚠️  Some tests failed. Check the errors above to diagnose upload issues.")
    }
  } catch (error) {
    console.error("❌ Test execution failed:", error.message)
    console.log("\n💡 Make sure the dev server is running: pnpm dev")
  }
}

runTests()

async function testUploadUrl() {
  console.log("🧪 Testing Upload URL Generation")
  console.log("=================================\n")

  try {
    console.log(`🌐 Testing against: ${BASE_URL}`)

    // Test valid ZIP file upload URL
    console.log("\n1. Testing ZIP file upload URL generation...")
    const zipResponse = await fetch(`${BASE_URL}/api/upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: "model.zip",
        fileSize: 50 * 1024 * 1024, // 50MB
        fileType: "application/zip",
      }),
    })

    if (zipResponse.ok) {
      const zipResult = await zipResponse.json()
      console.log("✅ ZIP upload URL generated successfully")
      console.log(`   Upload URL length: ${zipResult.uploadUrl?.length || 0}`)
      console.log(`   Public URL: ${zipResult.publicUrl ? "Generated" : "Missing"}`)
    } else {
      const error = await zipResponse.json()
      console.log("❌ ZIP upload URL generation failed:", error.error)
    }

    // Test image file upload URL (should be rejected by this endpoint)
    console.log("\n2. Testing image file rejection...")
    const wrongTypeResponse = await fetch(`${BASE_URL}/api/upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: "image.jpg",
        fileSize: 5 * 1024 * 1024, // 5MB
        fileType: "image/jpeg",
      }),
    })

    if (!wrongTypeResponse.ok) {
      const error = await wrongTypeResponse.json()
      console.log("✅ File type validation working:", error.error)
    } else {
      console.log("❌ File type validation failed - should reject non-ZIP files")
    }

    console.log("\n🎉 All tests completed!")
  } catch (error) {
    console.error("❌ Test failed:", error.message)
    console.log("\n💡 Make sure the dev server is running: pnpm dev")
  }
}
