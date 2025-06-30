-- Migration: Remove ZIP file related columns from training_jobs table
-- These columns are no longer needed since we're removing ZIP file functionality
-- The ZIP file is now just a training container, not an IP asset

-- Remove ZIP file storage columns
ALTER TABLE training_jobs 
DROP COLUMN IF EXISTS zip_file_url,
DROP COLUMN IF EXISTS zip_file_path,
DROP COLUMN IF EXISTS zip_file_size;

-- Remove Story Protocol ZIP IP registration columns  
ALTER TABLE training_jobs 
DROP COLUMN IF EXISTS story_zip_ip_id,
DROP COLUMN IF EXISTS story_zip_token_id,
DROP COLUMN IF EXISTS story_zip_tx_hash;

-- Remove processing status column (if it exists)
-- This was only used for ZIP processing tracking
ALTER TABLE training_jobs 
DROP COLUMN IF EXISTS processing_status;

-- Remove related indexes
DROP INDEX IF EXISTS idx_training_jobs_processing_status;
DROP INDEX IF EXISTS idx_training_jobs_story_zip_ip_id;

-- Clean up any existing ZIP IP IDs from ip_id column
-- Set ip_id to NULL where it currently contains ZIP file IP IDs
-- (These should be re-registered as model derivative IPs via webhook or manual registration)
UPDATE training_jobs 
SET ip_id = NULL 
WHERE ip_id IS NOT NULL 
  AND story_parent_ip_ids IS NULL 
  AND status = 'succeeded'
  AND trigger_word IS NOT NULL;

-- Add comment to explain the changes
COMMENT ON TABLE training_jobs IS 
'Training jobs table - ZIP columns removed, only individual training images and final model are IP assets';

-- Display summary
SELECT 
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) as jobs_with_ip_id,
  COUNT(CASE WHEN story_parent_ip_ids IS NOT NULL THEN 1 END) as jobs_with_parent_ips,
  COUNT(CASE WHEN status = 'succeeded' AND ip_id IS NULL AND trigger_word IS NOT NULL THEN 1 END) as successful_jobs_needing_ip_registration
FROM training_jobs; 