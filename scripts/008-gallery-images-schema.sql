-- Migration: Create gallery_images table for storing gallery image metadata

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

-- Add trigger for updated_at
CREATE TRIGGER set_timestamp_gallery_images
BEFORE UPDATE ON gallery_images
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS (Row Level Security)
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow anyone to read gallery images
CREATE POLICY "Allow public read access" ON gallery_images
FOR SELECT USING (true);

-- Only authenticated users can update descriptions
CREATE POLICY "Allow authenticated updates" ON gallery_images
FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow service role to manage all records
CREATE POLICY "Service role full access" ON gallery_images
FOR ALL USING (
  current_setting('role') = 'service_role'
);

-- Insert initial gallery data
INSERT INTO gallery_images (id, title, src, alt, aspect, author, description, model) VALUES
(1, 'Gallery Image 1', '/gallery/mj1.png', 'Gallery artwork 1', 'portrait', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(2, 'Gallery Image 2', '/gallery/mj13.png', 'Gallery artwork 2', 'landscape', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(3, 'Gallery Image 3', '/gallery/mj3.png', 'Gallery artwork 3', 'portrait', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(4, 'Gallery Image 4', '/gallery/mj4.png', 'Gallery artwork 4', 'landscape', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(5, 'Gallery Image 5', '/gallery/mj5.png', 'Gallery artwork 5', 'landscape', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(6, 'Gallery Image 6', '/gallery/mj6.png', 'Gallery artwork 6', 'portrait', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(7, 'Gallery Image 7', '/gallery/mj7.png', 'Gallery artwork 7', 'landscape', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(8, 'Gallery Image 8', '/gallery/mj8.png', 'Gallery artwork 8', 'portrait', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(9, 'Gallery Image 9', '/gallery/mj9.png', 'Gallery artwork 9', 'landscape', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(10, 'Gallery Image 10', '/gallery/mj10.png', 'Gallery artwork 10', 'portrait', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(11, 'Gallery Image 11', '/gallery/mj11.png', 'Gallery artwork 11', 'landscape', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(12, 'Gallery Image 12', '/gallery/mj12.png', 'Gallery artwork 12', 'portrait', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(13, 'Gallery Image 13', '/gallery/mj2.png', 'Gallery artwork 13', 'landscape', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(14, 'Gallery Image 14', '/gallery/mj14.png', 'Gallery artwork 14', 'landscape', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0'),
(15, 'Gallery Image 15', '/gallery/mj15.png', 'Gallery artwork 15', 'landscape', 'Name', 'AI-generated artwork from the gallery collection.', 'Essence 3.0')
ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE gallery_images IS 'Stores metadata for gallery images with editable descriptions';
COMMENT ON COLUMN gallery_images.description IS 'User-editable description of the gallery image';

-- Enable Realtime
ALTER TABLE gallery_images REPLICA IDENTITY FULL; 