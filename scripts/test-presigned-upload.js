// Load environment variables manually or skip if not available
try {
  require("dotenv").config({ path: ".env.local" })
} catch (e) {
  console.log("⚠️ dotenv not available - using existing environment variables")
}

async function testAPI() {
  console.log("🧪 Testing updated API flow...\n")

  // Test 1: Verify environment variables
  try {
    console.log("1️⃣ Testing environment setup...")

    const requiredVars = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "REPLICATE_API_TOKEN",
    ]

    const missing = requiredVars.filter((varName) => !process.env[varName])

    if (missing.length > 0) {
      console.error("❌ Missing environment variables:", missing)
      console.log("💡 Make sure to set environment variables in your shell or .env.local file")
      return
    }

    console.log("✅ All required environment variables present")
  } catch (error) {
    console.error("❌ Environment check failed:", error.message)
    return
  }

  // Test 2: Verify Supabase connection
  try {
    console.log("\n2️⃣ Testing Supabase connection...")

    const { createClient } = require("@supabase/supabase-js")
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Simple query to test connection
    const { data, error } = await supabase.from("training_jobs").select("count(*)").limit(1)

    if (error) {
      console.error("❌ Supabase connection error:", error.message)
    } else {
      console.log("✅ Supabase connection working")
    }
  } catch (error) {
    console.error("❌ Supabase test failed:", error.message)
  }

  // Test 3: Verify Replicate API connection
  try {
    console.log("\n3️⃣ Testing Replicate API connection...")

    const Replicate = require("replicate")
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })

    // Test getting model info
    const model = await replicate.models.get("black-forest-labs/flux-pro-trainer")
    console.log("✅ Replicate API working - model found:", model.name)
  } catch (error) {
    console.error("❌ Replicate API error:", error.message)
  }

  console.log("\n🎉 Core component testing completed!")
  console.log("\n💡 If the above tests pass, the training flow should work correctly.")
  console.log("🚀 You can now test the actual training flow in the web interface.")
}

// Run the test
testAPI().catch(console.error)

module.exports = { testAPI }
