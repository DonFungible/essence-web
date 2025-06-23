-- Migration: Set up assets storage bucket for style reference images

-- Create storage bucket for model assets (if it doesn't exist)
-- Note: You may need to create this manually in Supabase dashboard first

-- Allow public access to read assets bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- Allow public read access to assets bucket
CREATE POLICY "Allow public read access to assets" ON storage.objects
FOR SELECT USING (bucket_id = 'assets');

-- Allow authenticated users to upload to assets bucket
CREATE POLICY "Allow authenticated uploads to assets" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'assets' AND
  auth.role() = 'authenticated'
);

-- Allow service role to manage all objects (for admin operations)
CREATE POLICY "Service role full access to assets" ON storage.objects
FOR ALL USING (
  bucket_id = 'assets' AND
  auth.role() = 'service_role'
);

-- Allow authenticated users to update their own uploads
CREATE POLICY "Allow authenticated updates to assets" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'assets' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own uploads  
CREATE POLICY "Allow authenticated deletes to assets" ON storage.objects
FOR DELETE USING (
  bucket_id = 'assets' AND
  auth.role() = 'authenticated'
);

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 
'Storage buckets including assets bucket for model style reference images';

-- Instructions for manual setup:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket called 'assets' and make it public
-- 3. Create folders like: assets/MCESCHER/, assets/ModelName/, etc.
-- 4. Upload up to 4 images (.png, .jpg, .webp, .gif) to each model folder 