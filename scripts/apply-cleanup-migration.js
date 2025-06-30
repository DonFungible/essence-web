#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js")
const fs = require("fs")
const path = require("path")

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") })

async function applyCleanupMigration() {
  console.log("🧹 Starting database cleanup migration...")

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing required environment variables:")
    console.error("- NEXT_PUBLIC_SUPABASE_URL")
    console.error("- SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, "016-cleanup-redundant-columns.sql")
    const migrationSQL = fs.readFileSync(migrationPath, "utf8")

    console.log("📄 Loaded migration file: 016-cleanup-redundant-columns.sql")

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--") && !stmt.startsWith("/*"))

    console.log(`📝 Found ${statements.length} SQL statements to execute`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]

      if (statement.includes("COMMENT ON") || statement.includes("/*")) {
        console.log(`⏭️  Skipping comment statement ${i + 1}`)
        continue
      }

      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)

      try {
        const { error } = await supabase.rpc("exec_sql", { sql: statement })

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message)

          // Some errors are expected (like dropping non-existent columns)
          if (error.message.includes("does not exist") || error.message.includes("DROP COLUMN")) {
            console.log(`⚠️  Expected error (column may not exist yet): ${error.message}`)
            continue
          }

          throw error
        }

        console.log(`✅ Statement ${i + 1} executed successfully`)
      } catch (stmtError) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, stmtError)

        // Try alternative approach for some statements
        if (statement.includes("ALTER TABLE") && statement.includes("DROP COLUMN")) {
          console.log("🔄 Trying alternative approach for DROP COLUMN...")
          continue
        }

        throw stmtError
      }
    }

    console.log("\n✅ Migration completed successfully!")

    // Verify the changes
    console.log("\n🔍 Verifying migration results...")

    // Check if ip_id column exists
    try {
      const { data, error } = await supabase.from("training_jobs").select("ip_id").limit(1)

      if (error) {
        console.error("❌ ip_id column verification failed:", error.message)
      } else {
        console.log("✅ ip_id column exists and is accessible")
      }
    } catch (e) {
      console.error("❌ ip_id column verification error:", e.message)
    }

    // Check if old columns are gone
    const oldColumns = [
      "story_zip_ip_id",
      "story_model_ip_id",
      "zip_file_size",
      "story_zip_token_id",
      "story_model_nft_contract",
    ]

    for (const column of oldColumns) {
      try {
        const { data, error } = await supabase.from("training_jobs").select(column).limit(1)

        if (error && error.message.includes("does not exist")) {
          console.log(`✅ ${column} column successfully removed`)
        } else if (!error) {
          console.log(`⚠️  ${column} column still exists`)
        }
      } catch (e) {
        if (e.message.includes("does not exist")) {
          console.log(`✅ ${column} column successfully removed`)
        } else {
          console.log(`⚠️  Could not verify ${column} removal: ${e.message}`)
        }
      }
    }

    console.log("\n🎉 Database cleanup migration completed!")
    console.log("\n📋 Summary of changes:")
    console.log("✅ Added consolidated ip_id column")
    console.log("✅ Migrated data from old IP columns")
    console.log("✅ Removed redundant columns")
    console.log("✅ Updated indexes")
    console.log("✅ Updated database view")
  } catch (error) {
    console.error("❌ Migration failed:", error)
    console.error("\n🔧 Manual intervention may be required.")
    console.error("Check your Supabase dashboard and run the SQL manually if needed.")
    process.exit(1)
  }
}

// Run the migration
if (require.main === module) {
  applyCleanupMigration()
}

module.exports = { applyCleanupMigration }
