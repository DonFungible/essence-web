-- Manual Migration: Clean up redundant columns in training_jobs table
-- Run these commands one by one in your Supabase SQL Editor

-- Step 1: Add the new consolidated ip_id column
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS ip_id TEXT;

-- Step 2: Migrate data from old IP columns to new ip_id column
-- Priority: story_zip_ip_id (ZIP file IP) over story_model_ip_id (model IP)
UPDATE training_jobs 
SET ip_id = COALESCE(story_zip_ip_id, story_model_ip_id)
WHERE story_zip_ip_id IS NOT NULL OR story_model_ip_id IS NOT NULL;

-- Step 3: Drop the existing view that depends on old columns
DROP VIEW IF EXISTS story_ip_relationships;

-- Step 4: Drop redundant columns (run these one by one)
ALTER TABLE training_jobs DROP COLUMN IF EXISTS zip_file_size;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_zip_token_id;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_model_nft_contract;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_model_token_id;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_derivative_tx_hash;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_model_registration_status;

-- Step 5: Drop the old IP ID columns
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_zip_ip_id;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_model_ip_id;

-- Step 6: Drop old indexes
DROP INDEX IF EXISTS idx_training_jobs_story_zip_ip_id;
DROP INDEX IF EXISTS idx_training_jobs_story_model_ip_id;
DROP INDEX IF EXISTS idx_training_jobs_story_model_registration_status;

-- Step 7: Create new index for consolidated ip_id column
CREATE INDEX IF NOT EXISTS idx_training_jobs_ip_id 
ON training_jobs (ip_id);

-- Step 8: Add comment for the new column
COMMENT ON COLUMN training_jobs.ip_id IS 
'Story Protocol IP Asset ID for this training job (consolidated from ZIP and model IPs)';

-- Step 9: Recreate the view with updated column references
CREATE OR REPLACE VIEW story_ip_relationships AS
SELECT 
  tj.id as training_job_id,
  tj.trigger_word,
  tj.ip_id,
  tj.story_parent_ip_ids,
  array_agg(ti.story_ip_id) FILTER (WHERE ti.story_ip_id IS NOT NULL) as training_image_ip_ids,
  array_agg(ti.original_filename) as training_image_filenames,
  count(ti.id) as total_training_images,
  count(ti.story_ip_id) FILTER (WHERE ti.story_ip_id IS NOT NULL) as registered_training_images
FROM training_jobs tj
LEFT JOIN training_images ti ON tj.id = ti.training_job_id
WHERE tj.has_individual_images = true
GROUP BY tj.id, tj.trigger_word, tj.ip_id, tj.story_parent_ip_ids;

-- Step 10: Add comment to the updated view
COMMENT ON VIEW story_ip_relationships IS 
'View showing Story Protocol IP asset relationships between training jobs and their images (updated for consolidated schema)';

-- Verification queries (run these to check the migration worked)
-- Check that ip_id column exists and has data
SELECT COUNT(*) as total_jobs, COUNT(ip_id) as jobs_with_ip_id FROM training_jobs;

-- Check that old columns are gone (these should error)
-- SELECT story_zip_ip_id FROM training_jobs LIMIT 1;
-- SELECT story_model_ip_id FROM training_jobs LIMIT 1; 