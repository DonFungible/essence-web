-- Migration: Add Story Protocol IP asset tracking
-- This adds columns to track IP assets and their relationships

-- Add Story Protocol columns to training_images table
ALTER TABLE training_images 
ADD COLUMN IF NOT EXISTS story_ip_id TEXT, -- Story Protocol IP Asset ID
ADD COLUMN IF NOT EXISTS story_nft_contract TEXT, -- NFT contract address on Story
ADD COLUMN IF NOT EXISTS story_token_id TEXT, -- Token ID on Story
ADD COLUMN IF NOT EXISTS story_tx_hash TEXT, -- Transaction hash for IP registration
ADD COLUMN IF NOT EXISTS story_registration_status TEXT DEFAULT 'pending'; -- pending, registered, failed

-- Add Story Protocol columns to training_jobs table  
ALTER TABLE training_jobs
ADD COLUMN IF NOT EXISTS story_model_ip_id TEXT, -- Story Protocol IP Asset ID for the trained model
ADD COLUMN IF NOT EXISTS story_model_nft_contract TEXT, -- NFT contract for the model
ADD COLUMN IF NOT EXISTS story_model_token_id TEXT, -- Token ID for the model
ADD COLUMN IF NOT EXISTS story_model_tx_hash TEXT, -- Transaction hash for model IP registration
ADD COLUMN IF NOT EXISTS story_model_registration_status TEXT DEFAULT 'pending', -- pending, registered, failed
ADD COLUMN IF NOT EXISTS story_parent_ip_ids TEXT[], -- Array of parent IP IDs (from training images)
ADD COLUMN IF NOT EXISTS story_derivative_tx_hash TEXT; -- Transaction hash for derivative registration

-- Create indexes for Story Protocol columns
CREATE INDEX IF NOT EXISTS idx_training_images_story_ip_id 
ON training_images (story_ip_id);

CREATE INDEX IF NOT EXISTS idx_training_images_story_registration_status 
ON training_images (story_registration_status);

CREATE INDEX IF NOT EXISTS idx_training_jobs_story_model_ip_id 
ON training_jobs (story_model_ip_id);

CREATE INDEX IF NOT EXISTS idx_training_jobs_story_model_registration_status 
ON training_jobs (story_model_registration_status);

-- Add comments for documentation
COMMENT ON COLUMN training_images.story_ip_id IS 
'Story Protocol IP Asset ID for this training image';

COMMENT ON COLUMN training_images.story_registration_status IS 
'Status of IP registration: pending, registered, failed';

COMMENT ON COLUMN training_jobs.story_model_ip_id IS 
'Story Protocol IP Asset ID for the trained model';

COMMENT ON COLUMN training_jobs.story_parent_ip_ids IS 
'Array of parent IP Asset IDs from training images';

COMMENT ON COLUMN training_jobs.story_derivative_tx_hash IS 
'Transaction hash when registering model as derivative of training images';

-- Create a view for Story Protocol IP relationships
CREATE OR REPLACE VIEW story_ip_relationships AS
SELECT 
  tj.id as training_job_id,
  tj.trigger_word,
  tj.story_model_ip_id,
  tj.story_model_registration_status,
  tj.story_parent_ip_ids,
  array_agg(ti.story_ip_id) FILTER (WHERE ti.story_ip_id IS NOT NULL) as training_image_ip_ids,
  array_agg(ti.original_filename) as training_image_filenames,
  count(ti.id) as total_training_images,
  count(ti.story_ip_id) FILTER (WHERE ti.story_ip_id IS NOT NULL) as registered_training_images
FROM training_jobs tj
LEFT JOIN training_images ti ON tj.id = ti.training_job_id
WHERE tj.has_individual_images = true
GROUP BY tj.id, tj.trigger_word, tj.story_model_ip_id, tj.story_model_registration_status, tj.story_parent_ip_ids;

COMMENT ON VIEW story_ip_relationships IS 
'View showing Story Protocol IP asset relationships between training jobs and their images'; 