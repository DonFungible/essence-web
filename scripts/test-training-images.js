#!/usr/bin/env node

/**
 * Test script for training images functionality
 * Usage: node scripts/test-training-images.js [modelName]
 */

const { createClient } = require("@supabase/supabase-js")

const modelName = process.argv[2] || "TESTMODEL"

async function testTrainingImages() {
  console.log(`🧪 Testing Training Images Functionality for model: ${modelName}\n`)

  try {
    // Create Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    console.log("🔍 Checking for training jobs with individual images...")

    // Check for training jobs with individual images
    const { data: trainingJobs, error: jobsError } = await supabase
      .from("training_jobs")
      .select("id, trigger_word, has_individual_images, individual_images_count, created_at")
      .eq("has_individual_images", true)
      .order("created_at", { ascending: false })

    if (jobsError) {
      console.error("❌ Error fetching training jobs:", jobsError)
      return
    }

    if (!trainingJobs || trainingJobs.length === 0) {
      console.log("📭 No training jobs with individual images found")
      console.log("\n💡 To test this feature:")
      console.log("   1. Train a model using individual images (not ZIP)")
      console.log("   2. The system will automatically record each image")
      console.log("   3. Style references will show ALL training images")
      return
    }

    console.log(`✅ Found ${trainingJobs.length} training job(s) with individual images:`)
    trainingJobs.forEach((job, index) => {
      console.log(`   ${index + 1}. ${job.trigger_word} - ${job.individual_images_count} images`)
    })

    // Test the specific model or use the first one
    const targetJob = trainingJobs.find((job) => job.trigger_word === modelName) || trainingJobs[0]

    console.log(`\n🔍 Testing training images for: ${targetJob.trigger_word}`)

    // Fetch individual training images
    const { data: trainingImages, error: imagesError } = await supabase
      .from("training_images")
      .select("*")
      .eq("training_job_id", targetJob.id)
      .order("display_order", { ascending: true })

    if (imagesError) {
      console.error("❌ Error fetching training images:", imagesError)
      return
    }

    if (!trainingImages || trainingImages.length === 0) {
      console.log("📭 No training images found in database")
      console.log("   This might indicate the images weren't properly recorded during upload")
      return
    }

    console.log(`✅ Found ${trainingImages.length} training images:`)
    trainingImages.forEach((img, index) => {
      console.log(`   ${index + 1}. ${img.original_filename}`)
      console.log(`      Size: ${Math.round(img.file_size / 1024)}KB`)
      console.log(`      URL: ${img.supabase_public_url.substring(0, 50)}...`)
    })

    // Test the style reference function logic
    console.log(`\n🧪 Testing style reference retrieval for model: ${targetJob.trigger_word}`)

    const styleImages = trainingImages.map((img) => ({
      src: img.supabase_public_url,
      alt: `${targetJob.trigger_word} training image - ${img.original_filename.replace(
        /\.[^/.]+$/,
        ""
      )}`,
    }))

    console.log(`✅ Style reference system would return ${styleImages.length} images`)
    console.log(`📊 UI behavior:`)
    if (styleImages.length <= 12) {
      console.log(`   - All ${styleImages.length} images displayed immediately`)
    } else {
      console.log(`   - First 12 images displayed`)
      console.log(`   - "Show All ${styleImages.length} Images" button available`)
    }

    console.log(`\n🎉 Training images functionality working correctly!`)
    console.log(
      `💡 These images will appear in the Style Reference section for model: ${targetJob.trigger_word}`
    )
  } catch (error) {
    console.error("❌ Test failed:", error.message)
    console.log("\n💡 Make sure:")
    console.log("   - Database migration 012-training-images-schema.sql has been applied")
    console.log("   - Environment variables are set correctly")
    console.log("   - You have trained a model using individual images")
  }
}

// Run the test
testTrainingImages()
