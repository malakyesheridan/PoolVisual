-- Migration: Add buyer inquiry form system
-- Creates tables for shareable buyer inquiry form links and submissions

-- Buyer Form Links table
CREATE TABLE IF NOT EXISTS buyer_form_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) NOT NULL,
  created_by_user_id UUID REFERENCES users(id) NOT NULL,
  property_id UUID REFERENCES jobs(id), -- Optional: link to a specific property
  token TEXT NOT NULL UNIQUE, -- Secure random token for public access
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'disabled')),
  expires_at TIMESTAMPTZ, -- Optional expiry
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Buyer Form Submissions table
CREATE TABLE IF NOT EXISTS buyer_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_link_id UUID REFERENCES buyer_form_links(id) ON DELETE CASCADE NOT NULL,
  org_id UUID REFERENCES orgs(id) NOT NULL,
  created_contact_id UUID REFERENCES contacts(id), -- Contact created/updated from submission
  created_opportunity_id UUID REFERENCES opportunities(id), -- Opportunity created from submission
  payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- Full form submission data
  request_ip TEXT, -- Optional: IP address (privacy-conscious)
  user_agent TEXT, -- Optional: user agent string
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for buyer_form_links
CREATE INDEX IF NOT EXISTS idx_buyer_form_links_token ON buyer_form_links(token);
CREATE INDEX IF NOT EXISTS idx_buyer_form_links_org ON buyer_form_links(org_id);
CREATE INDEX IF NOT EXISTS idx_buyer_form_links_property ON buyer_form_links(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_form_links_status ON buyer_form_links(status);
CREATE INDEX IF NOT EXISTS idx_buyer_form_links_expires ON buyer_form_links(expires_at) WHERE expires_at IS NOT NULL;

-- Indexes for buyer_form_submissions
CREATE INDEX IF NOT EXISTS idx_buyer_form_submissions_form_link ON buyer_form_submissions(form_link_id);
CREATE INDEX IF NOT EXISTS idx_buyer_form_submissions_org ON buyer_form_submissions(org_id);
CREATE INDEX IF NOT EXISTS idx_buyer_form_submissions_contact ON buyer_form_submissions(created_contact_id) WHERE created_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_form_submissions_opportunity ON buyer_form_submissions(created_opportunity_id) WHERE created_opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_form_submissions_created_at ON buyer_form_submissions(created_at DESC);

