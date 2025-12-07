-- Migration: Add cold-start fields to jobs table
-- This adds support for listing cold-start boost feature

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS initial_report_generated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS seller_launch_insights JSONB;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_jobs_initial_report_generated_at ON jobs(initial_report_generated_at) WHERE initial_report_generated_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN jobs.initial_report_generated_at IS 'Timestamp when the initial cold-start seller report was generated';
COMMENT ON COLUMN jobs.seller_launch_insights IS 'JSON object containing buyer match count, top matched buyers, and generation timestamp';

