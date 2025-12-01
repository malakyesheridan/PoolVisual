-- Migration 028: User-Centric Architecture
-- Moves all data ownership from organizations to users
-- This enables complete data isolation and personalization per user

-- ============================================
-- PART 1: Add User-Level Fields
-- ============================================

-- Add personalization and subscription fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS industry_type TEXT CHECK (industry_type IN ('pool', 'landscaping', 'building', 'electrical', 'plumbing', 'real_estate', 'other')),
ADD COLUMN IF NOT EXISTS credits_balance BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_credits_granted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_plan_id UUID REFERENCES subscription_plans(id),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'expired', 'incomplete')),
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 't1' CHECK (subscription_tier IN ('t1', 't2', 't3')),
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_trial_ends_at TIMESTAMP;

-- Add user-level settings (migrated from org settings)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'AUD',
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,4) DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS deposit_default_pct NUMERIC(5,4) DEFAULT 0.30,
ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS pdf_terms TEXT;

-- ============================================
-- PART 2: Add user_id to Jobs Table
-- ============================================

-- Add user_id column to jobs
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Migrate: For each job, find the user who created it via org_members
-- This maps created_by (org_member.id) -> user_id
UPDATE jobs j
SET user_id = (
  SELECT om.user_id 
  FROM org_members om 
  WHERE om.id = j.created_by
  LIMIT 1
)
WHERE user_id IS NULL AND created_by IS NOT NULL;

-- Handle edge case: jobs with no created_by (shouldn't happen, but be safe)
-- Assign to first owner of the org
UPDATE jobs j
SET user_id = (
  SELECT om.user_id 
  FROM org_members om 
  WHERE om.org_id = j.org_id 
  AND om.role = 'owner'
  LIMIT 1
)
WHERE user_id IS NULL;

-- Make user_id NOT NULL after migration
-- First, handle any remaining NULLs by assigning to a system user or first user
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM users LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE jobs SET user_id = first_user_id WHERE user_id IS NULL;
  END IF;
END $$;

-- Now make it NOT NULL
ALTER TABLE jobs 
ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- PART 3: Update Masks Table
-- ============================================

-- Add user_id column to masks
ALTER TABLE masks 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Migrate: Get user_id from org_members via created_by
UPDATE masks m
SET user_id = (
  SELECT om.user_id 
  FROM org_members om 
  WHERE om.id = m.created_by
  LIMIT 1
)
WHERE user_id IS NULL AND created_by IS NOT NULL;

-- Handle edge case: masks with no created_by
-- Get user from photo -> job -> user_id
UPDATE masks m
SET user_id = (
  SELECT j.user_id
  FROM photos p
  JOIN jobs j ON j.id = p.job_id
  WHERE p.id = m.photo_id
  LIMIT 1
)
WHERE user_id IS NULL;

-- Make user_id NOT NULL after migration
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM users LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE masks SET user_id = first_user_id WHERE user_id IS NULL;
  END IF;
END $$;

ALTER TABLE masks 
ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- PART 4: Update Materials Table
-- ============================================

-- Add user_id column to materials (nullable - NULL means global material)
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Migrate: Move org-specific materials to user who owns the org
-- Materials with org_id get assigned to the org owner
UPDATE materials m
SET user_id = (
  SELECT om.user_id 
  FROM org_members om 
  WHERE om.org_id = m.org_id 
  AND om.role = 'owner'
  LIMIT 1
)
WHERE m.org_id IS NOT NULL AND m.user_id IS NULL;

-- Global materials (org_id IS NULL) remain NULL (global)

-- ============================================
-- PART 5: Update Labor Rules Table
-- ============================================

-- Add user_id column to labor_rules
ALTER TABLE labor_rules 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Migrate: Get user from org owner
UPDATE labor_rules lr
SET user_id = (
  SELECT om.user_id 
  FROM org_members om 
  WHERE om.org_id = lr.org_id 
  AND om.role = 'owner'
  LIMIT 1
)
WHERE user_id IS NULL AND org_id IS NOT NULL;

-- Make user_id NOT NULL after migration
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM users LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE labor_rules SET user_id = first_user_id WHERE user_id IS NULL;
  END IF;
END $$;

ALTER TABLE labor_rules 
ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- PART 6: Migrate Settings to Users
-- ============================================

-- Migrate settings from orgs to users
-- Each org's settings go to the org owner
UPDATE users u
SET 
  currency_code = s.currency_code,
  tax_rate = s.tax_rate,
  deposit_default_pct = s.deposit_default_pct,
  validity_days = s.validity_days,
  pdf_terms = s.pdf_terms
FROM settings s
JOIN org_members om ON om.org_id = s.org_id
WHERE om.user_id = u.id 
AND om.role = 'owner'
AND (u.currency_code IS NULL OR u.currency_code = 'AUD');

-- ============================================
-- PART 7: Migrate Industry and Credits from Orgs to Users
-- ============================================

-- Migrate industry from org to org owner
UPDATE users u
SET industry_type = o.industry
FROM orgs o
JOIN org_members om ON om.org_id = o.id
WHERE om.user_id = u.id 
AND om.role = 'owner'
AND u.industry_type IS NULL
AND o.industry IS NOT NULL;

-- Migrate credits from org to org owner
UPDATE users u
SET credits_balance = COALESCE(u.credits_balance, 0) + COALESCE(o.credits_balance, 0)
FROM orgs o
JOIN org_members om ON om.org_id = o.id
WHERE om.user_id = u.id 
AND om.role = 'owner'
AND o.credits_balance IS NOT NULL
AND o.credits_balance > 0;

-- Migrate subscription info from org to org owner
UPDATE users u
SET 
  subscription_plan_id = o.subscription_plan_id,
  subscription_status = o.subscription_status,
  subscription_tier = o.subscription_tier,
  stripe_customer_id = o.stripe_customer_id,
  stripe_subscription_id = o.stripe_subscription_id,
  subscription_started_at = o.subscription_started_at,
  subscription_expires_at = o.subscription_expires_at,
  subscription_trial_ends_at = o.subscription_trial_ends_at
FROM orgs o
JOIN org_members om ON om.org_id = o.id
WHERE om.user_id = u.id 
AND om.role = 'owner'
AND u.subscription_plan_id IS NULL
AND o.subscription_plan_id IS NOT NULL;

-- ============================================
-- PART 8: Update Subscription History
-- ============================================

-- Add user_id to subscription_history
ALTER TABLE subscription_history 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Migrate: Get user from org owner
UPDATE subscription_history sh
SET user_id = (
  SELECT om.user_id 
  FROM org_members om 
  WHERE om.org_id = sh.org_id 
  AND om.role = 'owner'
  LIMIT 1
)
WHERE user_id IS NULL;

-- ============================================
-- PART 9: Update Audit Logs
-- ============================================

-- Audit logs already have user_id, but we should ensure org_id is optional
-- Keep org_id for backward compatibility but make it nullable
ALTER TABLE audit_logs 
ALTER COLUMN org_id DROP NOT NULL;

-- ============================================
-- PART 10: Create Indexes for Performance
-- ============================================

-- Indexes for user-based queries
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_masks_user_id ON masks(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_labor_rules_user_id ON labor_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id) WHERE user_id IS NOT NULL;

-- Indexes for user personalization
CREATE INDEX IF NOT EXISTS idx_users_industry_type ON users(industry_type) WHERE industry_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_credits_balance ON users(credits_balance) WHERE credits_balance > 0;
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_photos_job_created ON photos(job_id, created_at);

-- ============================================
-- PART 11: Update Foreign Key Constraints
-- ============================================

-- Jobs: Remove org_id constraint (keep column for now, but make it nullable)
ALTER TABLE jobs 
ALTER COLUMN org_id DROP NOT NULL;

-- Jobs: Remove created_by constraint (keep column for now, but make it nullable)
ALTER TABLE jobs 
ALTER COLUMN created_by DROP NOT NULL;

-- Masks: Remove created_by constraint (keep column for now, but make it nullable)
ALTER TABLE masks 
ALTER COLUMN created_by DROP NOT NULL;

-- Materials: Remove org_id constraint (keep column for now, but make it nullable)
ALTER TABLE materials 
ALTER COLUMN org_id DROP NOT NULL;

-- Labor rules: Remove org_id constraint (keep column for now, but make it nullable)
ALTER TABLE labor_rules 
ALTER COLUMN org_id DROP NOT NULL;

-- ============================================
-- PART 12: Add Comments for Documentation
-- ============================================

COMMENT ON COLUMN users.industry_type IS 'User industry preference: pool, landscaping, building, electrical, plumbing, real_estate, or other';
COMMENT ON COLUMN users.credits_balance IS 'User credits balance in microdollars (e.g., 1000000 = $1.00)';
COMMENT ON COLUMN users.trial_credits_granted IS 'Whether trial credits have been granted to this user';
COMMENT ON COLUMN jobs.user_id IS 'Owner of this job (replaces org_id for data isolation)';
COMMENT ON COLUMN masks.user_id IS 'Owner of this mask (replaces created_by org_member reference)';
COMMENT ON COLUMN materials.user_id IS 'Owner of this material (NULL = global material, UUID = user-specific)';
COMMENT ON COLUMN labor_rules.user_id IS 'Owner of this labor rule (replaces org_id)';

-- ============================================
-- PART 13: Verification Queries
-- ============================================

-- Verify all jobs have user_id
DO $$
DECLARE
  null_jobs_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_jobs_count FROM jobs WHERE user_id IS NULL;
  IF null_jobs_count > 0 THEN
    RAISE WARNING 'Found % jobs with NULL user_id', null_jobs_count;
  END IF;
END $$;

-- Verify all masks have user_id
DO $$
DECLARE
  null_masks_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_masks_count FROM masks WHERE user_id IS NULL;
  IF null_masks_count > 0 THEN
    RAISE WARNING 'Found % masks with NULL user_id', null_masks_count;
  END IF;
END $$;

-- Verify all labor_rules have user_id
DO $$
DECLARE
  null_labor_rules_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_labor_rules_count FROM labor_rules WHERE user_id IS NULL;
  IF null_labor_rules_count > 0 THEN
    RAISE WARNING 'Found % labor_rules with NULL user_id', null_labor_rules_count;
  END IF;
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Update RLS policies (migration 029)
-- 2. Update application code to use user_id instead of org_id
-- 3. Test data isolation
-- 4. Optionally remove org_id columns in future migration
