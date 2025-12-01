-- Migration: Create opportunities tables for real estate CRM functionality
-- This creates a comprehensive opportunities/CRM system for real estate

-- Main opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  org_id UUID REFERENCES orgs(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  property_address TEXT,
  property_job_id UUID REFERENCES jobs(id), -- Link to property/job
  status TEXT DEFAULT 'new' NOT NULL CHECK (status IN ('new', 'contacted', 'qualified', 'viewing', 'offer', 'closed_won', 'closed_lost')),
  pipeline_stage TEXT DEFAULT 'new', -- Customizable stage name
  estimated_value NUMERIC(12,2) CHECK (estimated_value >= 0),
  probability_pct INTEGER DEFAULT 0 CHECK (probability_pct >= 0 AND probability_pct <= 100),
  expected_close_date DATE,
  actual_close_date DATE,
  source TEXT, -- referral, website, social, cold_call, etc.
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL
);

-- Follow-up tasks/checklist
CREATE TABLE IF NOT EXISTS opportunity_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
  task_text TEXT NOT NULL,
  due_date TIMESTAMP,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  task_order INTEGER DEFAULT 0, -- For ordering tasks
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT, -- e.g., "every_3_days", "weekly"
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Opportunity notes (separate from property notes)
CREATE TABLE IF NOT EXISTS opportunity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  note_text TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'call', 'email', 'meeting', 'other')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Activity timeline (tracks all interactions)
CREATE TABLE IF NOT EXISTS opportunity_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'status_change', 'stage_change', 'document_upload', 'other')),
  activity_title TEXT NOT NULL,
  activity_description TEXT,
  activity_data JSONB DEFAULT '{}'::jsonb, -- Flexible data storage
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Documents attached to opportunities
CREATE TABLE IF NOT EXISTS opportunity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_user ON opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline_stage ON opportunities(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_expected_close ON opportunities(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_property_job ON opportunities(property_job_id);

-- Indexes for follow-ups
CREATE INDEX IF NOT EXISTS idx_opportunity_followups_opportunity ON opportunity_followups(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_followups_due_date ON opportunity_followups(due_date) WHERE completed = FALSE;
CREATE INDEX IF NOT EXISTS idx_opportunity_followups_assigned ON opportunity_followups(assigned_to) WHERE completed = FALSE;

-- Indexes for notes
CREATE INDEX IF NOT EXISTS idx_opportunity_notes_opportunity ON opportunity_notes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_notes_created ON opportunity_notes(created_at DESC);

-- Indexes for activities
CREATE INDEX IF NOT EXISTS idx_opportunity_activities_opportunity ON opportunity_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_activities_created ON opportunity_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_activities_type ON opportunity_activities(activity_type);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_opportunity_documents_opportunity ON opportunity_documents(opportunity_id);

-- Add comments
COMMENT ON TABLE opportunities IS 'Real estate opportunities/CRM pipeline for tracking clients and deals';
COMMENT ON TABLE opportunity_followups IS 'Follow-up tasks and checklists for opportunities';
COMMENT ON TABLE opportunity_notes IS 'Notes associated with opportunities';
COMMENT ON TABLE opportunity_activities IS 'Activity timeline tracking all interactions with opportunities';
COMMENT ON TABLE opportunity_documents IS 'Documents attached to opportunities';

