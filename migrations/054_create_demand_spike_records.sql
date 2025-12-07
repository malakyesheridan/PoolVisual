-- Migration: Create demand_spike_records table
-- This table tracks the last known buyer match count for past appraisal opportunities
-- Used to detect when buyer demand spikes for properties that had appraisals

CREATE TABLE IF NOT EXISTS demand_spike_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  last_match_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for efficient lookups by opportunity
CREATE INDEX IF NOT EXISTS idx_demand_spike_records_opportunity_id ON demand_spike_records(opportunity_id);

-- Unique constraint to ensure one record per opportunity
CREATE UNIQUE INDEX IF NOT EXISTS idx_demand_spike_records_opportunity_unique ON demand_spike_records(opportunity_id);

-- Add comment
COMMENT ON TABLE demand_spike_records IS 'Tracks last known buyer match count for past appraisal opportunities to detect demand spikes';

