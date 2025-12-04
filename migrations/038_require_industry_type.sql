-- Migration 038: Require industry_type for all users
-- Sets default value for existing users and adds NOT NULL constraint
-- This ensures all users must have an industry type selected

-- Step 1: Set default for existing users without industry
-- Use 'pool' as the default (most common trade industry)
UPDATE users 
SET industry_type = 'pool' 
WHERE industry_type IS NULL;

-- Step 2: Add NOT NULL constraint and default value
ALTER TABLE users 
  ALTER COLUMN industry_type SET NOT NULL,
  ALTER COLUMN industry_type SET DEFAULT 'pool';

-- Step 3: Add check constraint for valid values
-- Drop existing constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_industry_type') THEN
    ALTER TABLE users DROP CONSTRAINT valid_industry_type;
  END IF;
END $$;

-- Add check constraint for valid industry types
ALTER TABLE users 
  ADD CONSTRAINT valid_industry_type 
  CHECK (industry_type IN ('pool', 'landscaping', 'building', 'electrical', 'plumbing', 'real_estate', 'other'));

-- Add comment for documentation
COMMENT ON COLUMN users.industry_type IS 'User industry type: pool, landscaping, building, electrical, plumbing, real_estate, or other. Required for all users.';

