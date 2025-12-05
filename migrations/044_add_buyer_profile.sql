-- Migration: Add buyerProfile JSONB field to contacts table
-- This stores structured buyer specifications for matching and reporting

-- Add buyer_profile JSONB column to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS buyer_profile JSONB DEFAULT '{}'::jsonb;

-- Add index for JSONB queries (GIN index for efficient JSON queries)
CREATE INDEX IF NOT EXISTS idx_contacts_buyer_profile ON contacts USING GIN (buyer_profile);

-- Add index for contacts with buyer profiles (for filtering)
CREATE INDEX IF NOT EXISTS idx_contacts_has_buyer_profile ON contacts(user_id, org_id) WHERE buyer_profile IS NOT NULL AND buyer_profile != '{}'::jsonb;

