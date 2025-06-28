-- Migration: Create training_images table for storing individual training images
-- This stores individual images when users upload multiple images instead of a ZIP file

-- Create training_images table
CREATE TABLE IF NOT EXISTS training_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to training job
  training_job_id UUID REFERENCES training_jobs(id) ON DELETE CASCADE,
  replicate_job_id TEXT, -- Also store replicate job ID for easier querying
  
  -- Image metadata
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- Size in bytes
  content_type TEXT NOT NULL, -- MIME type (image/jpeg, image/png, etc.)
  
  -- Storage info
  supabase_storage_path TEXT NOT NULL, -- Path in Supabase storage
  supabase_public_url TEXT NOT NULL, -- Public URL for the image
  
  -- Display order (for consistent ordering in UI)
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_images_training_job_id 
ON training_images (training_job_id);

CREATE INDEX IF NOT EXISTS idx_training_images_replicate_job_id 
ON training_images (replicate_job_id);

CREATE INDEX IF NOT EXISTS idx_training_images_display_order 
ON training_images (training_job_id, display_order);

-- Add trigger for updated_at
CREATE TRIGGER set_timestamp_training_images
BEFORE UPDATE ON training_images
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS (Row Level Security)
ALTER TABLE training_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to view training images for their own training jobs
CREATE POLICY "Users can view own training images" ON training_images
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM training_jobs 
    WHERE training_jobs.id = training_images.training_job_id 
    AND training_jobs.user_id = auth.uid()
  )
);

-- Allow users to insert training images for their own training jobs
CREATE POLICY "Users can create training images" ON training_images
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM training_jobs 
    WHERE training_jobs.id = training_images.training_job_id 
    AND training_jobs.user_id = auth.uid()
  )
);

-- Allow service role to manage all records (for automated processes)
CREATE POLICY "Service role full access" ON training_images
FOR ALL USING (
  current_setting('role') = 'service_role'
);

-- Add columns to training_jobs table to track individual image uploads
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS has_individual_images BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS individual_images_count INTEGER DEFAULT 0;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_training_jobs_has_individual_images 
ON training_jobs (has_individual_images);

-- Add comments for documentation
COMMENT ON TABLE training_images IS 
'Stores individual training images when users upload multiple images instead of a ZIP file';

COMMENT ON COLUMN training_images.training_job_id IS 
'Reference to the training job this image belongs to';

COMMENT ON COLUMN training_images.replicate_job_id IS 
'Replicate job ID for easier querying and linking';

COMMENT ON COLUMN training_images.display_order IS 
'Order for displaying images in UI (0-based)';

COMMENT ON COLUMN training_jobs.has_individual_images IS 
'Whether this training job was created with individual images (vs ZIP file)';

COMMENT ON COLUMN training_jobs.individual_images_count IS 
'Number of individual training images uploaded for this job';

-- Enable Realtime
ALTER TABLE training_images REPLICA IDENTITY FULL; 