-- Migration: Add ZIP file and processing status columns to training_jobs table
-- These columns are needed for the enhanced training process with IP registration

-- Add processing status column to track training stages
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending' 
CHECK (processing_status IN ('pending', 'uploading', 'uploading_complete', 'training', 'completed', 'failed'));

-- Add ZIP file related columns
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS zip_file_url TEXT,
ADD COLUMN IF NOT EXISTS zip_file_path TEXT,
ADD COLUMN IF NOT EXISTS zip_file_size BIGINT;

-- Add Story Protocol ZIP IP registration columns
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS story_zip_ip_id TEXT,
ADD COLUMN IF NOT EXISTS story_zip_token_id TEXT,
ADD COLUMN IF NOT EXISTS story_zip_tx_hash TEXT;

-- Update existing records to have proper processing status
UPDATE training_jobs 
SET processing_status = CASE 
  WHEN status = 'succeeded' THEN 'completed'
  WHEN status = 'failed' THEN 'failed'
  WHEN status = 'processing' THEN 'training'
  WHEN status = 'starting' THEN 'training'
  ELSE 'pending'
END
WHERE processing_status = 'pending';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_jobs_processing_status 
ON training_jobs (processing_status);

CREATE INDEX IF NOT EXISTS idx_training_jobs_story_zip_ip_id 
ON training_jobs (story_zip_ip_id);

-- Add comments to explain the new columns
COMMENT ON COLUMN training_jobs.processing_status IS 
'Detailed processing status: pending, uploading, uploading_complete, training, completed, failed';

COMMENT ON COLUMN training_jobs.zip_file_url IS 
'Public URL of the training dataset ZIP file';

COMMENT ON COLUMN training_jobs.zip_file_path IS 
'Storage path of the training dataset ZIP file';

COMMENT ON COLUMN training_jobs.zip_file_size IS 
'Size of the training dataset ZIP file in bytes';

COMMENT ON COLUMN training_jobs.story_zip_ip_id IS 
'Story Protocol IP ID for the registered ZIP file';

COMMENT ON COLUMN training_jobs.story_zip_token_id IS 
'Story Protocol NFT token ID for the registered ZIP file';

COMMENT ON COLUMN training_jobs.story_zip_tx_hash IS 
'Story Protocol transaction hash for ZIP IP registration';
