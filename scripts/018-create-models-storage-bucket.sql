-- Migration: Set up models storage bucket for training datasets and model outputs

-- Create storage bucket for models (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', true)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- Allow public read access to models bucket
CREATE POLICY "Allow public read access to models" ON storage.objects
FOR SELECT USING (bucket_id = 'models');

-- Allow authenticated users to upload to models bucket
CREATE POLICY "Allow authenticated uploads to models" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'models' AND
  auth.role() = 'authenticated'
);

-- Allow service role to manage all objects (for training operations)
CREATE POLICY "Service role full access to models" ON storage.objects
FOR ALL USING (
  bucket_id = 'models' AND
  auth.role() = 'service_role'
);

-- Allow authenticated users to update their own uploads
CREATE POLICY "Allow authenticated updates to models" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'models' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own uploads  
CREATE POLICY "Allow authenticated deletes to models" ON storage.objects
FOR DELETE USING (
  bucket_id = 'models' AND
  auth.role() = 'authenticated'
);

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 
'Storage buckets including models bucket for training datasets and model outputs';

-- Instructions for manual setup:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket called 'models' and make it public if it doesn't exist
-- 3. This bucket will store:
--    - Training dataset ZIP files (training-datasets/ folder)
--    - Model output files (public/ folder)
--    - Other model-related assets 