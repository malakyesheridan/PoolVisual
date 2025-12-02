-- Migration: Add contacts, pipelines, stages, and extend opportunities for Kanban board
-- This extends the opportunities system with contacts, pipelines, and Kanban functionality

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  org_id UUID REFERENCES orgs(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  org_id UUID REFERENCES orgs(id),
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  stage_order TEXT[] DEFAULT '{}', -- Array of stage IDs in order
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Pipeline Stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0 NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Extend opportunities table with new fields
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id),
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id),
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id),
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS value NUMERIC(12,2);

-- Copy estimated_value to value if value is null
UPDATE opportunities SET value = estimated_value WHERE value IS NULL AND estimated_value IS NOT NULL;

-- Update opportunities: set title from client_name if title is null
UPDATE opportunities SET title = client_name WHERE title IS NULL AND client_name IS NOT NULL;

-- Make title required for new records (but allow null for existing)
-- We'll handle this in the application layer

-- Rename opportunity_followups to opportunity_tasks (create new table, migrate data, drop old)
CREATE TABLE IF NOT EXISTS opportunity_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed')),
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  assignee_id UUID REFERENCES users(id),
  task_order INTEGER DEFAULT 0,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Migrate data from opportunity_followups to opportunity_tasks
INSERT INTO opportunity_tasks (
  id, opportunity_id, title, description, status, due_date, completed_at, 
  completed_by, assignee_id, task_order, is_recurring, recurrence_pattern, 
  created_at, updated_at
)
SELECT 
  id, opportunity_id, task_text, NULL, 
  CASE WHEN completed THEN 'completed' ELSE 'pending' END,
  due_date, completed_at, completed_by, assigned_to, 
  task_order, is_recurring, recurrence_pattern, created_at, updated_at
FROM opportunity_followups
ON CONFLICT (id) DO NOTHING;

-- Indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;

-- Indexes for pipelines
CREATE INDEX IF NOT EXISTS idx_pipelines_user ON pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_org ON pipelines(org_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_default ON pipelines(user_id, is_default) WHERE is_default = TRUE;

-- Indexes for pipeline_stages
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON pipeline_stages(pipeline_id, "order");

-- Indexes for opportunities (new fields)
CREATE INDEX IF NOT EXISTS idx_opportunities_contact ON opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline ON opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_tags ON opportunities USING GIN(tags);

-- Indexes for opportunity_tasks
CREATE INDEX IF NOT EXISTS idx_opportunity_tasks_opportunity ON opportunity_tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_tasks_status ON opportunity_tasks(opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunity_tasks_due_date ON opportunity_tasks(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_opportunity_tasks_assignee ON opportunity_tasks(assignee_id) WHERE status = 'pending';

-- Add comments
COMMENT ON TABLE contacts IS 'Contacts/clients for real estate CRM';
COMMENT ON TABLE pipelines IS 'Sales pipelines for organizing opportunities';
COMMENT ON TABLE pipeline_stages IS 'Stages within a pipeline (e.g., New, Qualified, Viewing, Offer)';
COMMENT ON TABLE opportunity_tasks IS 'Tasks/checklist items for opportunities';

