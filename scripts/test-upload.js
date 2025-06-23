#!/usr/bin/env node

/**
 * Test script for upload URL generation
 * Usage: node scripts/test-upload.js
 */

const BASE_URL = 'http://localhost:3000'

async function testUploadUrl() {
  console.log('🧪 Testing Upload URL Generation...\n')

  try {
    const response = await fetch(`${BASE_URL}/api/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'test-dataset.zip',
        fileSize: 25 * 1024 * 1024, // 25MB
        fileType: 'application/zip'
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ Upload URL generation failed:', error)
      return
    }

    const result = await response.json()
    console.log('✅ Upload URL generated successfully:')
    console.log('📁 File Name:', result.fileName)
    console.log('🔗 Upload URL:', result.uploadUrl.substring(0, 50) + '...')
    console.log('🌐 Public URL:', result.publicUrl.substring(0, 50) + '...')
    console.log('📂 Storage Path:', result.storagePath)
    console.log('')

    // Test file size validation
    console.log('🧪 Testing file size validation (150MB)...')
    const oversizeResponse = await fetch(`${BASE_URL}/api/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'large-dataset.zip',
        fileSize: 150 * 1024 * 1024, // 150MB (over limit)
        fileType: 'application/zip'
      }),
    })

    if (!oversizeResponse.ok) {
      const error = await oversizeResponse.json()
      console.log('✅ File size validation working:', error.error)
    } else {
      console.log('❌ File size validation failed - should reject 150MB files')
    }

    // Test file type validation
    console.log('\n🧪 Testing file type validation...')
    const wrongTypeResponse = await fetch(`${BASE_URL}/api/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'image.jpg',
        fileSize: 5 * 1024 * 1024, // 5MB
        fileType: 'image/jpeg'
      }),
    })

    if (!wrongTypeResponse.ok) {
      const error = await wrongTypeResponse.json()
      console.log('✅ File type validation working:', error.error)
    } else {
      console.log('❌ File type validation failed - should reject non-ZIP files')
    }

    console.log('\n🎉 All tests completed!')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.log('\n💡 Make sure the dev server is running: pnpm dev')
  }
}

// Run the test
testUploadUrl()
