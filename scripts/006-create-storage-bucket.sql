CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'generated-images' AND
  auth.role() = 'authenticated'
);

-- Allow public access to view/download images (since bucket is public)
CREATE POLICY "Allow public downloads" ON storage.objects
FOR SELECT USING (
  bucket_id = 'generated-images'
);

-- Allow service role to manage all objects (for webhook operations)
CREATE POLICY "Service role full access" ON storage.objects
FOR ALL USING (
  bucket_id = 'generated-images' AND
  auth.role() = 'service_role'
);

-- Allow authenticated users to update their own uploads
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'generated-images' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own uploads  
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE USING (
  bucket_id = 'generated-images' AND
  auth.role() = 'authenticated'
);
