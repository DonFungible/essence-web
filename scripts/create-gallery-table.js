const { createClient } = require("@supabase/supabase-js")
const fs = require("fs")

async function createGalleryTable() {
  console.log("🏗️ Creating gallery_images table...\n")

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing environment variables:")
    console.error("NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl)
    console.error("SUPABASE_SERVICE_ROLE_KEY:", !!supabaseKey)
    console.log("\n💡 Make sure to load your .env.local file or set these in your shell")
    return
  }

  console.log("✅ Environment variables found")
  console.log(`📡 Connecting to: ${supabaseUrl.substring(0, 30)}...`)

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Check if table already exists
    console.log("\n🔍 Checking if gallery_images table exists...")

    const { data: existingTable, error: checkError } = await supabase
      .from("gallery_images")
      .select("count(*)")
      .limit(1)

    if (!checkError) {
      console.log("✅ gallery_images table already exists!")
      console.log("   If you're still getting errors, the table might need Realtime enabled.")
      return
    }

    if (checkError && !checkError.message.includes("does not exist")) {
      console.error("❌ Unexpected error checking table:", checkError.message)
      return
    }

    console.log("📋 Table does not exist, creating it...")

    // Read the schema file
    const schemaSQL = fs.readFileSync("scripts/008-gallery-images-schema.sql", "utf8")

    // Extract just the CREATE TABLE part (avoid INSERT conflicts)
    const createTableSQL = `
-- Create gallery_images table
CREATE TABLE IF NOT EXISTS gallery_images (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  src TEXT NOT NULL,
  alt TEXT NOT NULL,
  aspect TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT NOT NULL,
  model TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow anyone to read gallery images
CREATE POLICY "Allow public read access" ON gallery_images
FOR SELECT USING (true);

-- Allow service role to manage all records
CREATE POLICY "Service role full access" ON gallery_images
FOR ALL USING (
  current_setting('role') = 'service_role'
);

-- Enable Realtime
ALTER TABLE gallery_images REPLICA IDENTITY FULL;
`

    console.log("🚀 Creating table structure...")

    // Execute the SQL - Note: Supabase client doesn't support raw SQL execution
    // We'll need to create the table manually or use the SQL editor
    console.log("⚠️ Unable to execute raw SQL via Supabase client.")
    console.log("📝 Please copy the following SQL and run it in your Supabase SQL Editor:")
    console.log("\n" + "=".repeat(60))
    console.log(createTableSQL)
    console.log("=".repeat(60))
    console.log("\n💡 After running the SQL:")
    console.log("1. Go to Supabase Dashboard → SQL Editor")
    console.log("2. Paste the SQL above")
    console.log('3. Click "Run"')
    console.log("4. Restart your Next.js development server")
  } catch (error) {
    console.error("❌ Error:", error.message)
  }
}

// Run the script
createGalleryTable().catch(console.error)
