-- Migration: Add unique constraint to replicate_job_id
-- This prevents duplicate entries for the same Replicate job

-- First, let's identify and clean up any existing duplicates
-- Keep the earliest created record for each replicate_job_id
WITH duplicate_jobs AS (
  SELECT 
    id,
    replicate_job_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY replicate_job_id 
      ORDER BY created_at ASC
    ) as rn
  FROM training_jobs 
  WHERE replicate_job_id IS NOT NULL
),
jobs_to_delete AS (
  SELECT id 
  FROM duplicate_jobs 
  WHERE rn > 1
)
DELETE FROM training_jobs 
WHERE id IN (SELECT id FROM jobs_to_delete);

-- Add unique constraint on replicate_job_id
ALTER TABLE training_jobs 
ADD CONSTRAINT unique_replicate_job_id 
UNIQUE (replicate_job_id);

-- Add index for better performance on webhook lookups
CREATE INDEX IF NOT EXISTS idx_training_jobs_replicate_job_id 
ON training_jobs (replicate_job_id);

-- Add comment to document the constraint
COMMENT ON CONSTRAINT unique_replicate_job_id ON training_jobs IS 
'Ensures each Replicate job ID is unique to prevent duplicate webhook processing';
