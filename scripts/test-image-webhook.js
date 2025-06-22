#!/usr/bin/env node

/**
 * Test script for image generation webhook
 * Tests the /api/image-generation-webhook endpoint with sample data
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Sample webhook payloads for different statuses
const webhookPayloads = {
  starting: {
    id: "test-prediction-12345",
    status: "starting",
    input: {
      prompt: "a beautiful sunset over mountains in the style of anime",
      aspect_ratio: "1:1",
      output_format: "jpg"
    },
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    logs: "",
    output: null,
    error: null
  },

  processing: {
    id: "test-prediction-12345", 
    status: "processing",
    input: {
      prompt: "a beautiful sunset over mountains in the style of anime",
      aspect_ratio: "1:1",
      output_format: "jpg"
    },
    created_at: new Date(Date.now() - 30000).toISOString(),
    started_at: new Date(Date.now() - 30000).toISOString(),
    logs: "Starting image generation...\nLoading model...\nGenerating image...",
    output: null,
    error: null
  },

  succeeded: {
    id: "test-prediction-12345",
    status: "succeeded", 
    input: {
      prompt: "a beautiful sunset over mountains in the style of anime",
      aspect_ratio: "1:1",
      output_format: "jpg"
    },
    created_at: new Date(Date.now() - 120000).toISOString(),
    started_at: new Date(Date.now() - 120000).toISOString(),
    completed_at: new Date().toISOString(),
    logs: "Starting image generation...\nLoading model...\nGenerating image...\nImage generation completed successfully.",
    output: [
      "https://replicate.delivery/pbxt/test-image-url.jpg"
    ],
    error: null,
    metrics: {
      predict_time: 45.2
    }
  },

  failed: {
    id: "test-prediction-12345",
    status: "failed",
    input: {
      prompt: "a beautiful sunset over mountains in the style of anime", 
      aspect_ratio: "1:1",
      output_format: "jpg"
    },
    created_at: new Date(Date.now() - 60000).toISOString(),
    started_at: new Date(Date.now() - 60000).toISOString(),
    completed_at: new Date().toISOString(),
    logs: "Starting image generation...\nLoading model...\nError: Model failed to load",
    output: null,
    error: "Model failed to load due to insufficient memory"
  }
}

async function testWebhook(status, payload) {
  console.log(`\n🧪 Testing ${status} webhook...`)
  
  try {
    const response = await fetch(`${BASE_URL}/api/image-generation-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()
    
    console.log(`📊 Status: ${response.status}`)
    console.log(`📝 Response:`, JSON.stringify(data, null, 2))
    
    if (response.ok) {
      console.log(`✅ ${status} webhook test passed`)
    } else {
      console.log(`❌ ${status} webhook test failed`)
    }
    
  } catch (error) {
    console.error(`💥 Error testing ${status} webhook:`, error.message)
  }
}

async function createTestGenerationRecord() {
  console.log('\n🗃️ Creating test generation record in database...')
  console.log('Note: You need to manually create a test record in the image_generations table:')
  console.log(`
INSERT INTO image_generations (
  model_id,
  replicate_prediction_id,
  prompt,
  full_prompt,
  status
) VALUES (
  'test-model-id',
  'test-prediction-12345',
  'a beautiful sunset over mountains',
  'a beautiful sunset over mountains in the style of anime',
  'pending'
);`)
  console.log('\nOr run this in your Supabase SQL editor before testing.')
}

async function runTests() {
  console.log('🚀 Starting image generation webhook tests...')
  console.log(`📍 Testing against: ${BASE_URL}/api/image-generation-webhook`)
  
  await createTestGenerationRecord()
  
  // Test all webhook statuses
  for (const [status, payload] of Object.entries(webhookPayloads)) {
    await testWebhook(status, payload)
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('\n🏁 All webhook tests completed!')
  console.log('\n💡 Next steps:')
  console.log('1. Check your database for updated records')
  console.log('2. Verify images are stored in Supabase Storage (for succeeded test)')
  console.log('3. Check server logs for any errors')
  console.log('4. Test with real Replicate webhooks')
}

// Check if script is run directly
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = { testWebhook, webhookPayloads } 