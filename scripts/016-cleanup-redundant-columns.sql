-- Migration: Clean up redundant and unnecessary columns in training_jobs table
-- This consolidates Story Protocol columns and removes unused/redundant fields

-- Step 1: Add the new consolidated ip_id column
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS ip_id TEXT;

-- Step 2: Migrate data from story_zip_ip_id and story_model_ip_id to ip_id
-- Priority: story_zip_ip_id (ZIP file IP) over story_model_ip_id (model IP)
-- Since the ZIP file represents the complete training dataset/model
UPDATE training_jobs 
SET ip_id = COALESCE(story_zip_ip_id, story_model_ip_id)
WHERE story_zip_ip_id IS NOT NULL OR story_model_ip_id IS NOT NULL;

-- Step 3: Drop the existing view that depends on the old columns
DROP VIEW IF EXISTS story_ip_relationships;

-- Step 4: Drop redundant and unnecessary columns
-- Note: We'll drop these one by one to handle potential dependencies

-- Drop ZIP-specific redundant columns
ALTER TABLE training_jobs DROP COLUMN IF EXISTS zip_file_size;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_zip_token_id;

-- Drop model-specific redundant columns  
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_model_nft_contract;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_model_token_id;

-- Drop the old IP ID columns (after data migration)
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_zip_ip_id;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_model_ip_id;

-- Drop derivative-related columns that are not currently used effectively
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_derivative_tx_hash;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS story_model_registration_status;

-- Step 5: Drop related indexes that are no longer needed
DROP INDEX IF EXISTS idx_training_jobs_story_zip_ip_id;
DROP INDEX IF EXISTS idx_training_jobs_story_model_ip_id;
DROP INDEX IF EXISTS idx_training_jobs_story_model_registration_status;

-- Step 6: Create new index for the consolidated ip_id column
CREATE INDEX IF NOT EXISTS idx_training_jobs_ip_id 
ON training_jobs (ip_id);

-- Step 7: Add comment for the new column
COMMENT ON COLUMN training_jobs.ip_id IS 
'Story Protocol IP Asset ID for this training job (consolidated from ZIP and model IPs)';

-- Step 8: Create the updated story_ip_relationships view with the new column

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

COMMENT ON VIEW story_ip_relationships IS 
'View showing Story Protocol IP asset relationships between training jobs and their images (updated for consolidated schema)';

-- Step 9: Summary of changes
/*
COLUMNS REMOVED:
- zip_file_size (redundant - file size not needed in database)
- story_zip_token_id (redundant - token ID not essential for core functionality)
- story_model_nft_contract (redundant - contract address is consistent across platform)
- story_model_token_id (redundant - token ID not essential for core functionality)
- story_zip_ip_id (consolidated into ip_id)
- story_model_ip_id (consolidated into ip_id)
- story_derivative_tx_hash (not effectively used)
- story_model_registration_status (simplified - can derive status from ip_id presence)

COLUMNS KEPT:
- ip_id (new consolidated column for Story Protocol IP Asset ID)
- story_parent_ip_ids (array of parent IP IDs - needed for derivative relationships)
- story_zip_tx_hash (transaction hash for IP registration - useful for verification)
- story_model_tx_hash (transaction hash for model registration - useful for verification)

REASONING:
- ZIP file and model represent the same IP asset (the training dataset/model)
- Token IDs and contract addresses are not essential for core functionality
- File sizes can be retrieved from storage if needed
- Registration status can be inferred from ip_id presence
- Transaction hashes are kept for verification and audit purposes
*/ 