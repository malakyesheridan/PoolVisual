-- Migration: Add photo category support for real estate
-- This allows photos to be categorized as 'marketing' or 'renovation_buyer'

-- Create enum type for photo categories
DO $$ BEGIN
    CREATE TYPE photo_category AS ENUM ('marketing', 'renovation_buyer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add category column to photos table
ALTER TABLE photos 
ADD COLUMN IF NOT EXISTS photo_category photo_category DEFAULT 'marketing' NOT NULL;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_photos_category ON photos(photo_category);
CREATE INDEX IF NOT EXISTS idx_photos_job_category ON photos(job_id, photo_category);

-- Update existing photos to default category (should already be 'marketing' due to default)
UPDATE photos SET photo_category = 'marketing' WHERE photo_category IS NULL;

-- Add comment
COMMENT ON COLUMN photos.photo_category IS 'Photo category: marketing (for listings) or renovation_buyer (for renovation/buyer photos)';

