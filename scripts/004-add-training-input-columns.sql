-- Migration: Add training input columns to store data from successful webhooks
-- This stores the actual training parameters used by Replicate

-- Add columns for training input data
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS input_images_url TEXT,
ADD COLUMN IF NOT EXISTS trigger_word TEXT,
ADD COLUMN IF NOT EXISTS captioning TEXT,
ADD COLUMN IF NOT EXISTS training_steps INTEGER,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS predict_time REAL,
ADD COLUMN IF NOT EXISTS total_time REAL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_jobs_trigger_word 
ON training_jobs (trigger_word);

CREATE INDEX IF NOT EXISTS idx_training_jobs_completed_at 
ON training_jobs (completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_jobs_status 
ON training_jobs (status);

-- Add comments to document the new columns
COMMENT ON COLUMN training_jobs.input_images_url IS 
'URL to the training dataset ZIP file used by Replicate';

COMMENT ON COLUMN training_jobs.trigger_word IS 
'The trigger word/model name used to activate the trained model';

COMMENT ON COLUMN training_jobs.captioning IS 
'Captioning mode used during training (automatic, manual, disabled)';

COMMENT ON COLUMN training_jobs.training_steps IS 
'Number of training steps used for fine-tuning';

COMMENT ON COLUMN training_jobs.completed_at IS 
'Timestamp when training completed (from Replicate webhook)';

COMMENT ON COLUMN training_jobs.started_at IS 
'Timestamp when training started (from Replicate webhook)';

COMMENT ON COLUMN training_jobs.predict_time IS 
'Time spent on actual training/prediction in seconds';

COMMENT ON COLUMN training_jobs.total_time IS 
'Total time from start to completion in seconds';
