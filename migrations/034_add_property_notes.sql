-- Migration: Add property notes table for real estate
-- This allows users to add notes to properties

CREATE TABLE IF NOT EXISTS property_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  note_text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_notes_job ON property_notes(job_id);
CREATE INDEX IF NOT EXISTS idx_property_notes_user ON property_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_property_notes_created ON property_notes(created_at DESC);

-- Add comment
COMMENT ON TABLE property_notes IS 'Notes associated with properties (jobs) for real estate industry';

