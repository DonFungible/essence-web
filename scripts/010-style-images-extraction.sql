-- Migration: Add style image extraction tracking columns
-- This tracks when style images have been extracted from training zip files

-- Add columns to track style image extraction
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS style_images_extracted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS style_images_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS style_images_storage_path TEXT,
ADD COLUMN IF NOT EXISTS style_images_extracted_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_jobs_style_images_extracted 
ON training_jobs (style_images_extracted);

CREATE INDEX IF NOT EXISTS idx_training_jobs_style_images_extracted_at 
ON training_jobs (style_images_extracted_at DESC);

-- Add comments to document the new columns
COMMENT ON COLUMN training_jobs.style_images_extracted IS 
'Whether style reference images have been extracted from the training dataset';

COMMENT ON COLUMN training_jobs.style_images_count IS 
'Number of style reference images extracted and uploaded to assets bucket';

COMMENT ON COLUMN training_jobs.style_images_storage_path IS 
'Storage path where extracted style images are stored (e.g., assets/TRIGGER_WORD/)';

COMMENT ON COLUMN training_jobs.style_images_extracted_at IS 
'Timestamp when style images were extracted and uploaded';

-- Update existing successful jobs to trigger style image extraction if needed
-- This can be run manually to process existing models
/*
UPDATE training_jobs 
SET style_images_extracted = false,
    style_images_count = 0
WHERE status = 'succeeded' 
  AND trigger_word IS NOT NULL 
  AND input_images_url IS NOT NULL
  AND style_images_extracted IS NULL;
*/

-- Example query to check style image extraction status
/*
SELECT 
  trigger_word,
  status,
  style_images_extracted,
  style_images_count,
  style_images_storage_path,
  style_images_extracted_at,
  created_at
FROM training_jobs 
WHERE status = 'succeeded'
ORDER BY created_at DESC;
*/ 