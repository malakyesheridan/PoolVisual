-- migrations/015_add_credits_to_orgs.sql
-- Add credits system columns to orgs table if they don't exist

-- Add credits_balance column (in microdollars, e.g., 100000 = $0.10)
ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS credits_balance BIGINT DEFAULT 0;

-- Add credits_updated_at timestamp
ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS credits_updated_at TIMESTAMP;

-- Add plan_id for future subscription system
ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS plan_id TEXT;

-- Create index for faster credit lookups
CREATE INDEX IF NOT EXISTS idx_orgs_credits_balance ON orgs(credits_balance) WHERE credits_balance > 0;

