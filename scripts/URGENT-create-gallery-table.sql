-- URGENT: Create missing gallery_images table
-- Copy and paste this entire script into your Supabase SQL Editor and click "Run"

-- Create gallery_images table
CREATE TABLE IF NOT EXISTS gallery_images (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  src TEXT NOT NULL,
  alt TEXT NOT NULL,
  aspect TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT NOT NULL,
  model TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add trigger for updated_at (only if function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
    CREATE TRIGGER set_timestamp_gallery_images
    BEFORE UPDATE ON gallery_images
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;

-- Enable RLS (Row Level Security)
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow anyone to read gallery images
DROP POLICY IF EXISTS "Allow public read access" ON gallery_images;
CREATE POLICY "Allow public read access" ON gallery_images
FOR SELECT USING (true);

-- Allow service role to manage all records
DROP POLICY IF EXISTS "Service role full access" ON gallery_images;
CREATE POLICY "Service role full access" ON gallery_images
FOR ALL USING (
  current_setting('role') = 'service_role'
);

-- Enable Realtime
ALTER TABLE gallery_images REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE gallery_images;

-- Insert sample data (only if table is empty)
INSERT INTO gallery_images (id, title, src, alt, aspect, author, description, model) 
SELECT * FROM (
  VALUES
  (1, 'Gallery Image 1', '/gallery/mj1.png', 'Gallery artwork 1', 'portrait', 'Artist', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
  (2, 'Gallery Image 2', '/gallery/mj13.png', 'Gallery artwork 2', 'landscape', 'Artist', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
  (3, 'Gallery Image 3', '/gallery/mj3.png', 'Gallery artwork 3', 'portrait', 'Artist', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
  (4, 'Gallery Image 4', '/gallery/mj4.png', 'Gallery artwork 4', 'landscape', 'Artist', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
  (5, 'Gallery Image 5', '/gallery/mj5.png', 'Gallery artwork 5', 'landscape', 'Artist', 'AI-generated artwork from the gallery collection.', 'Essence 3.0')
) AS new_data(id, title, src, alt, aspect, author, description, model)
WHERE NOT EXISTS (SELECT 1 FROM gallery_images LIMIT 1);

-- Add comments for documentation
COMMENT ON TABLE gallery_images IS 'Stores metadata for gallery images with editable descriptions';
COMMENT ON COLUMN gallery_images.description IS 'User-editable description of the gallery image';

-- Success message
SELECT 'gallery_images table created successfully! 🎉' AS result; 