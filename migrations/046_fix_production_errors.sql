-- Migration 046: Fix Production Errors
-- Fixes three critical production issues:
-- 1. Add updated_at column to materials table
-- 2. Ensure trial_enhancements_granted column exists on users table
-- 3. (Redis fixes are in code, not schema)

-- ============================================
-- PART 1: Add updated_at to materials table
-- ============================================

-- Add updated_at column to materials table if it doesn't exist
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;

-- Backfill existing rows: set updated_at to created_at for existing materials
UPDATE materials
  SET updated_at = created_at
  WHERE updated_at IS NULL OR updated_at < created_at;

-- Create trigger function if it doesn't exist (used by other tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row updates
-- (Only if trigger doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_materials_updated_at'
  ) THEN
    CREATE TRIGGER update_materials_updated_at
      BEFORE UPDATE ON materials
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- PART 2: Ensure trial_enhancements_granted exists
-- ============================================

-- Add trial_enhancements_granted column if it doesn't exist
-- This column was supposed to be created by migration 040, but may not have run
DO $$
BEGIN
  -- Check if column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'trial_enhancements_granted'
  ) THEN
    -- Check if old column name exists (trial_credits_granted)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'trial_credits_granted'
    ) THEN
      -- Rename old column to new name
      ALTER TABLE users 
        RENAME COLUMN trial_credits_granted TO trial_enhancements_granted;
    ELSE
      -- Create new column with default value
      ALTER TABLE users 
        ADD COLUMN trial_enhancements_granted BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
    
    -- Add comment
    COMMENT ON COLUMN users.trial_enhancements_granted IS 'True if user has been granted trial enhancements';
  END IF;
END $$;

-- ============================================
-- PART 3: Update system_get_materials function to ensure it works with updated_at
-- ============================================

-- Re-create the function to ensure it correctly selects updated_at
-- (This ensures the function works after the column is added)
CREATE OR REPLACE FUNCTION system_get_materials(
  org_uuid UUID DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  industry_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  org_id UUID,
  name TEXT,
  sku TEXT,
  category TEXT,
  unit TEXT,
  price DECIMAL,
  image_url TEXT,
  texture_url TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.org_id,
    m.name,
    m.sku,
    m.category,
    m.unit,
    m.price,
    m.thumbnail_url AS image_url,  -- Use thumbnail_url as image_url for backward compatibility
    m.texture_url,
    m.is_active,
    m.created_at,
    m.updated_at  -- Now this column exists after PART 1
  FROM materials m
  WHERE m.is_active = TRUE
    AND (org_uuid IS NULL OR m.org_id = org_uuid OR m.org_id IS NULL)
    AND (category_filter IS NULL OR m.category = category_filter);
  -- Industry filtering would need trade_category_mapping join - simplified for now
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION system_get_materials IS 'Bypasses RLS to get materials. Uses thumbnail_url as image_url for backward compatibility. Requires updated_at column on materials table.';

