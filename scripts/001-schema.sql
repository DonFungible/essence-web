-- Create a table to store AI model training jobs
CREATE TABLE
  training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    replicate_job_id TEXT, -- ID from Replicate
    status TEXT NOT NULL DEFAULT 'pending', -- e.g., pending, starting, processing, succeeded, failed
    input_parameters JSONB, -- Store all user-defined parameters and blob URL
    output_model_url TEXT, -- URL or identifier of the trained model from Replicate
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp ()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row modification
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON training_jobs
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Enable Realtime on the training_jobs table
ALTER TABLE training_jobs REPLICA IDENTITY FULL;
-- For a new table, you might need to publish changes explicitly if not done by default
-- Check Supabase dashboard under Database > Replication for publication settings.
-- Typically, 'supabase_realtime' publication includes all tables.
-- If not, you might need: ALTER PUBLICATION supabase_realtime ADD TABLE training_jobs;
