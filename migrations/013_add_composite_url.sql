-- Migration 013: Add Composite URL Caching
-- Adds composite image URL and generation timestamp to photos table for caching
-- This enables efficient composite generation by caching results and only regenerating when masks change

-- Add composite URL column (nullable - existing photos won't have composites)
ALTER TABLE photos 
ADD COLUMN IF NOT EXISTS composite_url TEXT;

-- Add composite generation timestamp (nullable - tracks when composite was last generated)
ALTER TABLE photos 
ADD COLUMN IF NOT EXISTS composite_generated_at TIMESTAMP WITH TIME ZONE;

-- Add index on composite_url for efficient lookups (sparse index - only non-null values)
CREATE INDEX IF NOT EXISTS idx_photos_composite_url ON photos(composite_url) 
WHERE composite_url IS NOT NULL;

-- Add index on composite_generated_at for cache invalidation queries
CREATE INDEX IF NOT EXISTS idx_photos_composite_generated_at ON photos(composite_generated_at) 
WHERE composite_generated_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN photos.composite_url IS 'Cached URL of the generated composite image (with materials applied). Stored in cloud storage (Vercel Blob/S3).';
COMMENT ON COLUMN photos.composite_generated_at IS 'Timestamp when the composite was last generated. Used to determine if regeneration is needed based on mask updates.';

-- Add audit log entry for this migration (only if audit_logs table exists and allows NULL org_id)
DO $$
BEGIN
    -- Check if we can insert with NULL org_id (some databases may have constraints)
    BEGIN
        INSERT INTO audit_logs (org_id, user_id, action, entity, payload_json, created_at)
        VALUES (
            (SELECT id FROM orgs LIMIT 1), -- Use first org if available, otherwise will be NULL
            NULL, -- System migration
            'SCHEMA_MIGRATION',
            'photos',
            '{"migration": "013_add_composite_url", "description": "Added composite URL caching to photos table for optimized preview generation"}'::jsonb,
            NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        -- If insert fails (e.g., due to constraints), skip audit log entry
        -- Migration itself is more important than audit logging
        NULL;
    END;
END $$;
