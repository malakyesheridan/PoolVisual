-- Migration 051: Rename school_district to suburb
-- This migration renames the school_district column to suburb in the jobs table

ALTER TABLE jobs RENAME COLUMN school_district TO suburb;

-- Add comment to document the change
COMMENT ON COLUMN jobs.suburb IS 'Suburb or locality where the property is located';

