-- Fix Realtime setup for tables used in subscriptions
-- Run this in your Supabase SQL Editor or via psql

-- 1. Enable Realtime for training_jobs table
ALTER TABLE training_jobs REPLICA IDENTITY FULL;

-- 2. Enable Realtime for image_generations table  
ALTER TABLE image_generations REPLICA IDENTITY FULL;

-- 3. Enable Realtime for gallery_images table
ALTER TABLE gallery_images REPLICA IDENTITY FULL;

-- 4. Add tables to the Realtime publication
-- (This might already be done, but ensuring it's included)
ALTER PUBLICATION supabase_realtime ADD TABLE training_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE image_generations;
ALTER PUBLICATION supabase_realtime ADD TABLE gallery_images;

-- 5. Check current publication status
-- SELECT schemaname, tablename 
-- FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime';

-- 6. Grant necessary permissions for Realtime
-- GRANT SELECT ON training_jobs TO anon, authenticated;
-- GRANT SELECT ON image_generations TO anon, authenticated;  
-- GRANT SELECT ON gallery_images TO anon, authenticated;

-- Note: Run these commands in your Supabase SQL Editor
-- Then restart your Next.js application 