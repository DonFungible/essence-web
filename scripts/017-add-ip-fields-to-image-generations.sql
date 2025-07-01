-- Migration: Add IP Asset fields to image_generations table
-- This enables registering generated images as derivatives of AI models

-- Add IP Asset related columns
ALTER TABLE image_generations 
ADD COLUMN IF NOT EXISTS ip_id TEXT, -- Story Protocol IP Asset ID for this generated image
ADD COLUMN IF NOT EXISTS story_image_tx_hash TEXT, -- Transaction hash for image IP registration
ADD COLUMN IF NOT EXISTS story_derivative_tx_hash TEXT, -- Transaction hash for derivative relationship
ADD COLUMN IF NOT EXISTS story_parent_model_ip_id TEXT, -- Parent AI model IP ID
ADD COLUMN IF NOT EXISTS story_registration_status TEXT DEFAULT 'pending'; -- pending, registered, failed

-- Add index for IP lookups
CREATE INDEX IF NOT EXISTS idx_image_generations_ip_id 
ON image_generations (ip_id) WHERE ip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_image_generations_parent_model_ip_id 
ON image_generations (story_parent_model_ip_id) WHERE story_parent_model_ip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_image_generations_registration_status 
ON image_generations (story_registration_status);

-- Add comments for documentation
COMMENT ON COLUMN image_generations.ip_id IS 
'Story Protocol IP Asset ID for this generated image';

COMMENT ON COLUMN image_generations.story_image_tx_hash IS 
'Transaction hash for registering this image as an IP asset';

COMMENT ON COLUMN image_generations.story_derivative_tx_hash IS 
'Transaction hash for registering derivative relationship with parent AI model';

COMMENT ON COLUMN image_generations.story_parent_model_ip_id IS 
'IP Asset ID of the parent AI model that generated this image';

COMMENT ON COLUMN image_generations.story_registration_status IS 
'Status of IP registration: pending, registered, failed'; 