-- Migration 049: Add match_suggestions table for Buyer-Property Match Alerts & Follow-Up Prompts

CREATE TABLE match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_tier TEXT NOT NULL CHECK (match_tier IN ('strong', 'medium', 'weak')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'dismissed')),
  source TEXT NOT NULL DEFAULT 'auto_match_v1',
  created_by_user_id UUID REFERENCES users(id),
  acted_by_user_id UUID REFERENCES users(id),
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast queries
CREATE INDEX idx_match_suggestions_org_property ON match_suggestions(org_id, property_id);
CREATE INDEX idx_match_suggestions_org_opportunity ON match_suggestions(org_id, opportunity_id);
CREATE INDEX idx_match_suggestions_org_status ON match_suggestions(org_id, status);
CREATE INDEX idx_match_suggestions_org_property_status ON match_suggestions(org_id, property_id, status);

-- Unique constraint to prevent duplicate suggestions for same property-opportunity pair
CREATE UNIQUE INDEX idx_match_suggestions_property_opportunity_unique 
  ON match_suggestions(property_id, opportunity_id) 
  WHERE status IN ('new', 'in_progress');

-- Add comment
COMMENT ON TABLE match_suggestions IS 'Tracks buyer-property match suggestions for follow-up prompts';
COMMENT ON COLUMN match_suggestions.match_tier IS 'Match quality tier: strong (≥75), medium (≥50), weak (≥30)';
COMMENT ON COLUMN match_suggestions.status IS 'Suggestion status: new, in_progress, completed, dismissed';
COMMENT ON COLUMN match_suggestions.source IS 'Source of the suggestion (e.g., auto_match_v1)';

