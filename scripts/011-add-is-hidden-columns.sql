-- Migration: Add isHidden columns for soft delete functionality
-- This allows users to "delete" models and generations without permanent data loss

-- Add isHidden column to training_jobs table
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP WITH TIME ZONE;

-- Add isHidden column to image_generations table  
ALTER TABLE image_generations 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance when filtering hidden items
CREATE INDEX IF NOT EXISTS idx_training_jobs_is_hidden 
ON training_jobs (is_hidden);

CREATE INDEX IF NOT EXISTS idx_image_generations_is_hidden 
ON image_generations (is_hidden);

-- Add comments to document the new columns
COMMENT ON COLUMN training_jobs.is_hidden IS 
'Soft delete flag - when true, model is hidden from UI but data is preserved';

COMMENT ON COLUMN image_generations.is_hidden IS 
'Soft delete flag - when true, generation is hidden from UI but data is preserved';

-- Example queries to demonstrate usage
/*
-- Hide a training job (soft delete)
UPDATE training_jobs 
SET is_hidden = true 
WHERE id = 'some-job-id';

-- Get only visible training jobs
SELECT * FROM training_jobs 
WHERE is_hidden = false OR is_hidden IS NULL;

-- Hide an image generation (soft delete)
UPDATE image_generations 
SET is_hidden = true 
WHERE id = 'some-generation-id';

-- Get only visible image generations
SELECT * FROM image_generations 
WHERE is_hidden = false OR is_hidden IS NULL;

-- Admin query to see all items including hidden
SELECT 
  id, 
  trigger_word, 
  status, 
  is_hidden,
  created_at 
FROM training_jobs 
ORDER BY created_at DESC;
*/ 