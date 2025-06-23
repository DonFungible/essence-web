-- Migration: Add preview_image_url and description to training_jobs table

ALTER TABLE training_jobs
ADD COLUMN IF NOT EXISTS preview_image_url TEXT NULL,
ADD COLUMN IF NOT EXISTS description TEXT NULL;

COMMENT ON COLUMN training_jobs.preview_image_url IS 'URL of a user-uploaded preview image for the model card';
COMMENT ON COLUMN training_jobs.description IS 'Optional user-provided description for the trained model';

-- Optional: Add indexes if you plan to query by description frequently, though likely not necessary.
-- CREATE INDEX IF NOT EXISTS idx_training_jobs_description ON training_jobs USING GIN (to_tsvector('english', description));
