const { createClient } = require("@supabase/supabase-js")

async function applyMigration() {
  console.log("🔧 Checking database schema for missing columns...\n")

  // Check environment variables manually
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable")
    console.log("Please check your .env.local file")
    return
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
    console.log("Please check your .env.local file")
    return
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Test if we can query the table
    const { data: testData, error: testError } = await supabase
      .from("training_jobs")
      .select("id, created_at")
      .limit(1)

    if (testError) {
      console.error("❌ Error accessing training_jobs table:", testError)
      return
    }

    console.log("✅ Successfully connected to training_jobs table")
    console.log(`📊 Found ${testData?.length || 0} existing training jobs`)

    // Try to query new columns to see which ones exist
    console.log("\n🔍 Testing for new columns...")

    const columnsToTest = [
      "processing_status",
      "zip_file_url",
      "zip_file_path",
      "zip_file_size",
      "story_zip_ip_id",
      "story_zip_token_id",
      "story_zip_tx_hash",
    ]

    const missingColumns = []

    for (const column of columnsToTest) {
      try {
        const { data, error } = await supabase.from("training_jobs").select(column).limit(1)

        if (error && error.message.includes("column") && error.message.includes("does not exist")) {
          console.log(`❌ Column '${column}' does not exist`)
          missingColumns.push(column)
        } else if (error) {
          console.log(`⚠️  Column '${column}' error:`, error.message)
          missingColumns.push(column)
        } else {
          console.log(`✅ Column '${column}' exists`)
        }
      } catch (e) {
        console.log(`❌ Column '${column}' does not exist:`, e.message)
        missingColumns.push(column)
      }
    }

    if (missingColumns.length > 0) {
      console.log("\n📋 Manual Migration Required:")
      console.log("The following columns need to be added to the training_jobs table:")
      console.log("Access your Supabase dashboard > Table Editor > training_jobs > Add Column")
      console.log("")
      missingColumns.forEach((col) => {
        switch (col) {
          case "processing_status":
            console.log(`${col}: type=text, default='pending'`)
            break
          case "zip_file_size":
            console.log(`${col}: type=bigint`)
            break
          default:
            console.log(`${col}: type=text`)
        }
      })
    } else {
      console.log("\n✅ All required columns exist!")
    }
  } catch (error) {
    console.error("❌ Exception during migration check:", error)
  }
}

applyMigration()
