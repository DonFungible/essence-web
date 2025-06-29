-- Migration: Add IP registration method to training_jobs table
-- This allows users to choose between backend wallet or connected wallet for IP registration

-- Add ip_registration_method column to training_jobs table
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS ip_registration_method TEXT DEFAULT 'backend' 
CHECK (ip_registration_method IN ('backend', 'wallet'));

-- Update existing records to use backend method by default
UPDATE training_jobs 
SET ip_registration_method = 'backend' 
WHERE ip_registration_method IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_training_jobs_ip_registration_method 
ON training_jobs (ip_registration_method);

-- Add comment to explain the column
COMMENT ON COLUMN training_jobs.ip_registration_method IS 
'Method used for IP registration: backend (server wallet) or wallet (user wallet). Default is backend.';