-- Migration: Create actions table for action tracking system
-- This creates an actions table for tracking tasks and follow-ups across the CRM

-- Actions table
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id),
  agent_id UUID REFERENCES users(id), -- User who created or owns the action
  contact_id UUID REFERENCES contacts(id),
  opportunity_id UUID REFERENCES opportunities(id),
  property_id UUID REFERENCES jobs(id), -- Property/job reference
  action_type TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for actions
CREATE INDEX IF NOT EXISTS idx_actions_org ON actions(org_id);
CREATE INDEX IF NOT EXISTS idx_actions_agent ON actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_actions_contact ON actions(contact_id);
CREATE INDEX IF NOT EXISTS idx_actions_opportunity ON actions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_actions_property ON actions(property_id);
CREATE INDEX IF NOT EXISTS idx_actions_type ON actions(action_type);
CREATE INDEX IF NOT EXISTS idx_actions_priority ON actions(priority);
CREATE INDEX IF NOT EXISTS idx_actions_created ON actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_completed ON actions(completed_at) WHERE completed_at IS NULL;

-- Add comment
COMMENT ON TABLE actions IS 'Action items and tasks for tracking follow-ups and activities across the CRM';

