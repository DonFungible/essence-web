#!/usr/bin/env node

/**
 * Apply database migration to add training input columns
 * This stores actual training parameters from Replicate webhooks
 */

const fs = require('fs')
const path = require('path')

async function showMigration() {
  console.log('🔧 Training Input Columns Migration\n')

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '004-add-training-input-columns.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📂 Migration file:', migrationPath)
    console.log('📝 This migration adds columns to store training input data from successful webhooks\n')

    console.log('⚠️  Please run this migration manually in your Supabase SQL editor:')
    console.log('📍 Go to: https://supabase.com/dashboard/project/[your-project]/sql')
    console.log('📋 Copy and paste the following SQL:\n')
    console.log('--- START MIGRATION ---')
    console.log(migrationSQL)
    console.log('--- END MIGRATION ---\n')

    console.log('💡 After running the migration:')
    console.log('   ✅ Webhooks will store training input data (trigger_word, input_images, etc.)')
    console.log('   ✅ Performance indexes will be added')
    console.log('   ✅ Timing data will be captured from Replicate')
    console.log('\n🔄 Test the enhanced webhook: pnpm test:webhook:lifecycle')

  } catch (error) {
    console.error('💥 Error reading migration file:', error.message)
  }
}

// Run the migration display
showMigration()
