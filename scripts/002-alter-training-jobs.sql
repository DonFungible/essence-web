-- Add fields for error messages and logs to training_jobs table
ALTER TABLE training_jobs
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS logs TEXT;
