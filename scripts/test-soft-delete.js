/**
 * Test script for soft delete functionality
 * Run with: node scripts/test-soft-delete.js
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000"

async function testSoftDelete() {
  console.log("🧪 Testing Soft Delete Functionality")
  console.log("===================================")

  // Test data - replace with real IDs from your database
  const testData = {
    trainingJobId: "your-training-job-id-here", // Replace with a real training job ID
    imageGenerationId: "your-generation-id-here", // Replace with a real generation ID
  }

  console.log("📝 Test Parameters:")
  console.log(`   Training Job ID: ${testData.trainingJobId}`)
  console.log(`   Image Generation ID: ${testData.imageGenerationId}`)
  console.log(`   API Base URL: ${API_BASE_URL}`)
  console.log("")

  // Test 1: Hide a training job (model)
  console.log("🗑️ Test 1: Hiding Training Job (Model)")
  console.log("--------------------------------------")

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/training-jobs/${testData.trainingJobId}/hide`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    )

    const result = await response.json()

    if (response.ok && result.success) {
      console.log("✅ Training job hidden successfully!")
      console.log(`   Message: ${result.message}`)
      console.log("   Updated data:", result.data)
    } else {
      console.log("❌ Failed to hide training job")
      console.log(`   Status: ${response.status}`)
      console.log(`   Error: ${result.error}`)
    }
  } catch (error) {
    console.log("💥 Error testing training job hide:", error.message)
  }

  console.log("")

  // Test 2: Hide an image generation
  console.log("🗑️ Test 2: Hiding Image Generation")
  console.log("----------------------------------")

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/image-generations/${testData.imageGenerationId}/hide`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    )

    const result = await response.json()

    if (response.ok && result.success) {
      console.log("✅ Image generation hidden successfully!")
      console.log(`   Message: ${result.message}`)
      console.log("   Updated data:", result.data)
    } else {
      console.log("❌ Failed to hide image generation")
      console.log(`   Status: ${response.status}`)
      console.log(`   Error: ${result.error}`)
    }
  } catch (error) {
    console.log("💥 Error testing image generation hide:", error.message)
  }

  console.log("")
  console.log("📋 Manual Testing Steps:")
  console.log("1. Replace the test IDs with real database IDs")
  console.log("2. Apply the database migration: 011-add-is-hidden-columns.sql")
  console.log("3. Test the UI delete buttons on models and generations")
  console.log("4. Verify items disappear from the UI but remain in database")
  console.log("5. Check database directly to see is_hidden = true")
  console.log("")
  console.log("📊 Database Queries to Verify:")
  console.log("-- Check hidden training jobs:")
  console.log(
    "SELECT id, trigger_word, is_hidden, hidden_at FROM training_jobs WHERE is_hidden = true;"
  )
  console.log("")
  console.log("-- Check hidden image generations:")
  console.log(
    "SELECT id, prompt, is_hidden, hidden_at FROM image_generations WHERE is_hidden = true;"
  )
  console.log("")
  console.log("-- Restore a hidden item (if needed):")
  console.log("UPDATE training_jobs SET is_hidden = false WHERE id = 'your-id-here';")
}

// Auto-run if called directly
if (require.main === module) {
  testSoftDelete()
}

module.exports = { testSoftDelete }
