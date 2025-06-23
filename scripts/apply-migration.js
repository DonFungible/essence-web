#!/usr/bin/env node

/**
 * Apply database migration to add unique constraint on replicate_job_id
 * This will clean up existing duplicates and prevent future ones
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function applyMigration() {
  console.log('🔧 Applying database migration for unique replicate_job_id...\n')

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '003-unique-replicate-job-id.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📂 Reading migration file:', migrationPath)
    console.log('📝 Migration content preview:')
    console.log(migrationSQL.substring(0, 200) + '...\n')

    // Check current duplicates before migration
    console.log('🔍 Checking for existing duplicates...')
    const { data: duplicates, error: checkError } = await supabase
      .from('training_jobs')
      .select('replicate_job_id, count(*)')
      .not('replicate_job_id', 'is', null)
      .group('replicate_job_id')
      .having('count(*)', 'gt', 1)

    if (checkError) {
      console.error('❌ Error checking duplicates:', checkError)
      return
    }

    if (duplicates && duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate replicate_job_id entries:`)
      duplicates.forEach(dup => {
        console.log(`   - ${dup.replicate_job_id}: ${dup.count} records`)
      })
      console.log('')
    } else {
      console.log('✅ No duplicates found\n')
    }

    // Apply the migration (Note: Supabase JS client doesn't support multi-statement SQL)
    console.log('⚠️  Please run this migration manually in your Supabase SQL editor:')
    console.log('📍 Go to: https://supabase.com/dashboard/project/[your-project]/sql')
    console.log('📋 Copy and paste the following SQL:\n')
    console.log('--- START MIGRATION ---')
    console.log(migrationSQL)
    console.log('--- END MIGRATION ---\n')

    console.log('💡 After running the migration, duplicates will be cleaned up and prevented.')
    console.log('🔄 Then run the lifecycle test again: pnpm test:webhook:lifecycle')

  } catch (error) {
    console.error('💥 Error applying migration:', error.message)
  }
}

// Run the migration
applyMigration()
