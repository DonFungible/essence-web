-- Migration: Create image_generations table for storing Replicate image generation requests
-- This stores async image generation jobs with webhook processing

-- Create image_generations table
CREATE TABLE IF NOT EXISTS image_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Model and generation info
  model_id TEXT NOT NULL, -- The trained model ID (replicate_job_id from training_jobs)
  replicate_prediction_id TEXT UNIQUE NOT NULL, -- Replicate prediction ID for this generation
  
  -- User and session info (allow anonymous generations)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT, -- For tracking anonymous users
  
  -- Generation parameters
  prompt TEXT NOT NULL,
  full_prompt TEXT, -- prompt with trigger word appended
  aspect_ratio TEXT DEFAULT '1:1',
  output_format TEXT DEFAULT 'jpg',
  safety_tolerance INTEGER DEFAULT 2,
  finetune_strength REAL DEFAULT 1.0,
  image_prompt_strength REAL DEFAULT 0.1,
  raw BOOLEAN DEFAULT false,
  
  -- Output data
  image_url TEXT, -- Original Replicate URL
  supabase_image_url TEXT, -- URL to image stored in Supabase
  supabase_storage_path TEXT, -- Path in Supabase storage
  image_size TEXT, -- e.g., '1024x1024'
  
  -- Generation metadata
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, succeeded, failed
  error_message TEXT,
  generation_time_seconds REAL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_image_generations_model_id 
ON image_generations (model_id);

CREATE INDEX IF NOT EXISTS idx_image_generations_user_id 
ON image_generations (user_id);

CREATE INDEX IF NOT EXISTS idx_image_generations_session_id 
ON image_generations (session_id);

CREATE INDEX IF NOT EXISTS idx_image_generations_status 
ON image_generations (status);

CREATE INDEX IF NOT EXISTS idx_image_generations_created_at 
ON image_generations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_generations_replicate_prediction_id 
ON image_generations (replicate_prediction_id);

-- Add trigger for updated_at
CREATE TRIGGER set_timestamp_image_generations
BEFORE UPDATE ON image_generations
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS (Row Level Security)
ALTER TABLE image_generations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to see their own generations
CREATE POLICY "Users can view own generations" ON image_generations
FOR SELECT USING (
  auth.uid() = user_id OR 
  user_id IS NULL -- Allow viewing anonymous generations
);

-- Allow users to insert their own generations
CREATE POLICY "Users can create generations" ON image_generations
FOR INSERT WITH CHECK (
  auth.uid() = user_id OR 
  user_id IS NULL -- Allow anonymous generations
);

-- Allow users to update their own generations
CREATE POLICY "Users can update own generations" ON image_generations
FOR UPDATE USING (
  auth.uid() = user_id OR 
  user_id IS NULL -- Allow updating anonymous generations
);

-- Allow service role to manage all records (for webhooks)
CREATE POLICY "Service role full access" ON image_generations
FOR ALL USING (
  current_setting('role') = 'service_role'
);

-- Enable Realtime
ALTER TABLE image_generations REPLICA IDENTITY FULL;

-- Add comments for documentation
COMMENT ON TABLE image_generations IS 
'Stores async image generation jobs processed via Replicate webhooks';

COMMENT ON COLUMN image_generations.model_id IS 
'Reference to the trained model used for generation (replicate_job_id)';

COMMENT ON COLUMN image_generations.replicate_prediction_id IS 
'Unique Replicate prediction ID for tracking generation status';

COMMENT ON COLUMN image_generations.full_prompt IS 
'Complete prompt including trigger word appended';

COMMENT ON COLUMN image_generations.supabase_image_url IS 
'Public URL to image stored in Supabase Storage';

COMMENT ON COLUMN image_generations.session_id IS 
'Session identifier for anonymous users to track their generations'; 