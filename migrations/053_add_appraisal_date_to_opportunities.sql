-- Migration: Add appraisal_date field to opportunities table
-- This adds support for tracking when appraisals were completed

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS appraisal_date DATE;

-- Add index for efficient querying of opportunities by appraisal date
CREATE INDEX IF NOT EXISTS idx_opportunities_appraisal_date ON opportunities(appraisal_date) WHERE appraisal_date IS NOT NULL;

-- Add comment
COMMENT ON COLUMN opportunities.appraisal_date IS 'Date when the property appraisal was completed';

