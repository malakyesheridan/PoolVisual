-- Migration: Add opportunityType field to opportunities table
-- This adds buyer/seller/both tagging for real estate opportunities

-- Add opportunity_type column with default 'buyer' for backward compatibility
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS opportunity_type TEXT DEFAULT 'buyer' CHECK (opportunity_type IN ('buyer', 'seller', 'both'));

-- Update existing records: if status suggests seller (e.g., 'closed_won' with property), set to 'seller' or 'both'
-- For now, default all existing to 'buyer' as specified (safer than guessing)
-- This can be refined later based on business logic

-- Add index for filtering by opportunity type
CREATE INDEX IF NOT EXISTS idx_opportunities_opportunity_type ON opportunities(opportunity_type);

-- Add index for org_id + opportunity_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_opportunities_org_type ON opportunities(org_id, opportunity_type) WHERE org_id IS NOT NULL;

