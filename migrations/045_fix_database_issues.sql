-- Migration 045: Fix database schema issues
-- Fixes missing columns and function issues

-- 1. Ensure enhancements_balance column exists (in case migration 040 wasn't run or failed)
DO $$ 
BEGIN
  -- Check if enhancements_balance exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'enhancements_balance'
  ) THEN
    -- Check if credits_balance exists and rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'credits_balance'
    ) THEN
      ALTER TABLE users RENAME COLUMN credits_balance TO enhancements_balance;
    ELSE
      -- Create the column if neither exists
      ALTER TABLE users ADD COLUMN enhancements_balance NUMERIC(20,0) DEFAULT 0;
    END IF;
    
    -- Add constraint
    ALTER TABLE users 
      ADD CONSTRAINT enhancements_balance_non_negative 
      CHECK (enhancements_balance >= 0);
  END IF;
END $$;

-- 2. Fix system_get_materials function to use thumbnail_url instead of image_url
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
    m.updated_at
  FROM materials m
  WHERE m.is_active = TRUE
    AND (org_uuid IS NULL OR m.org_id = org_uuid OR m.org_id IS NULL)
    AND (category_filter IS NULL OR m.category = category_filter);
  -- Industry filtering would need trade_category_mapping join - simplified for now
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION system_get_materials IS 'Bypasses RLS to get materials. Uses thumbnail_url as image_url for backward compatibility.';

