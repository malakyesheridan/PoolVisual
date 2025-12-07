-- Migration: Add activity tracking fields to opportunities table
-- This adds support for agent performance nudges feature

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS last_seller_update TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_agent_activity TIMESTAMP WITH TIME ZONE;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_opportunities_last_seller_update ON opportunities(last_seller_update) WHERE last_seller_update IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_last_agent_activity ON opportunities(last_agent_activity) WHERE last_agent_activity IS NOT NULL;

-- Add comments
COMMENT ON COLUMN opportunities.last_seller_update IS 'Timestamp when the agent last sent an update to the seller';
COMMENT ON COLUMN opportunities.last_agent_activity IS 'Timestamp when the agent last performed any meaningful activity on this opportunity';

