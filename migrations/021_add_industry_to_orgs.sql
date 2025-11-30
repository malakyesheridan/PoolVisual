-- Migration 021: Add Industry Field to Organizations
-- Adds industry field to orgs table to support multi-trade functionality
-- This enables EasyFlow Studio to support pool, landscaping, building, electrical, plumbing, and real estate

-- Add industry field to orgs table
ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS industry TEXT;

-- Default existing orgs to 'pool' for backward compatibility
UPDATE orgs 
SET industry = 'pool' 
WHERE industry IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orgs_industry ON orgs(industry);

-- Add constraint for valid industries (drop first if exists, then add)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_industry') THEN
    ALTER TABLE orgs DROP CONSTRAINT check_industry;
  END IF;
END $$;

ALTER TABLE orgs 
ADD CONSTRAINT check_industry 
CHECK (industry IS NULL OR industry IN ('pool', 'landscaping', 'building', 'electrical', 'plumbing', 'real_estate', 'other'));

-- Add comment for documentation
COMMENT ON COLUMN orgs.industry IS 'Industry/trade type: pool, landscaping, building, electrical, plumbing, real_estate, or other';

