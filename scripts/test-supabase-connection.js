// Load environment variables
try {
  require("dotenv").config({ path: ".env.local" })
} catch (e) {
  console.log("⚠️ dotenv not available - using existing environment variables")
}

async function testSupabaseConnection() {
  console.log("🧪 Testing Supabase connection (without Realtime)...\n")

  // Test 1: Check environment variables
  console.log("1️⃣ Checking environment variables...")

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL is missing")
    return
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing")
    return
  }

  console.log(`✅ Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...`)
  console.log(`✅ Anon Key: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 30)}...`)

  // Test 2: Basic connection without Realtime
  try {
    console.log("\n2️⃣ Testing basic connection (no Realtime)...")

    const { createClient } = require("@supabase/supabase-js")

    // Create client with Realtime disabled
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        realtime: {
          disabled: true, // Disable Realtime to avoid WebSocket issues
        },
      }
    )

    // Test basic query
    const { data, error } = await supabase.from("training_jobs").select("count(*)").limit(1)

    if (error) {
      console.error("❌ Database query failed:", error.message)

      // Check if it's an auth issue
      if (error.message.includes("JWT")) {
        console.log("💡 This might be a JWT/auth token issue")
      }

      // Check if it's a network issue
      if (error.message.includes("Failed to fetch") || error.message.includes("network")) {
        console.log("💡 This might be a network connectivity issue")
      }
    } else {
      console.log("✅ Basic database query successful")
      console.log(`   - Query result: ${JSON.stringify(data)}`)
    }
  } catch (error) {
    console.error("❌ Connection test failed:", error.message)
  }

  // Test 3: Network connectivity to Supabase
  try {
    console.log("\n3️⃣ Testing network connectivity...")

    const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/", {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })

    if (response.ok) {
      console.log("✅ Network connectivity to Supabase working")
      console.log(`   - Status: ${response.status}`)
    } else {
      console.error(`❌ Network connectivity issue - Status: ${response.status}`)
    }
  } catch (error) {
    console.error("❌ Network test failed:", error.message)
  }

  console.log("\n🎉 Supabase connection test completed!")
  console.log("\n💡 If basic queries work but Realtime fails:")
  console.log("   - Your Supabase project might have Realtime disabled")
  console.log("   - Check your Supabase project settings in the dashboard")
  console.log("   - Consider using polling instead of real-time subscriptions")
}

// Run the test
testSupabaseConnection().catch(console.error)
