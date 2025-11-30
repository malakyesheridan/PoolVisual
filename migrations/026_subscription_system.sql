-- Migration 026: Subscription System
-- Adds subscription management, plans, and history tracking

-- ============================================
-- PART 1: Subscription Plans Table
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL CHECK (industry IN ('trades', 'real_estate')),
  tier TEXT NOT NULL CHECK (tier IN ('t1', 't2', 't3')),
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_subscription_plans_industry ON subscription_plans(industry);
CREATE INDEX idx_subscription_plans_tier ON subscription_plans(tier);
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active);

-- ============================================
-- PART 2: Update Orgs Table
-- ============================================

ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS subscription_plan_id UUID REFERENCES subscription_plans(id),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'expired', 'incomplete')),
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 't1' CHECK (subscription_tier IN ('t1', 't2', 't3')),
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_trial_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS industry_locked BOOLEAN DEFAULT TRUE;

-- Update existing orgs
UPDATE orgs 
SET industry = 'pool' 
WHERE industry IS NULL;

UPDATE orgs 
SET industry_locked = TRUE 
WHERE industry_locked IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orgs_subscription_plan ON orgs(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_orgs_subscription_status ON orgs(subscription_status);
CREATE INDEX IF NOT EXISTS idx_orgs_industry_locked ON orgs(industry_locked);
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer ON orgs(stripe_customer_id);

-- ============================================
-- PART 3: Subscription History Table
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'activated', 'updated', 'canceled', 'expired', 
    'payment_succeeded', 'payment_failed', 'trial_started', 'trial_ended'
  )),
  from_status TEXT,
  to_status TEXT,
  from_tier TEXT,
  to_tier TEXT,
  stripe_event_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_subscription_history_org ON subscription_history(org_id);
CREATE INDEX idx_subscription_history_event ON subscription_history(event_type);
CREATE INDEX idx_subscription_history_created ON subscription_history(created_at DESC);

-- ============================================
-- PART 4: Admin Industry View Preference
-- ============================================

-- Store admin's preferred industry view (doesn't affect org)
CREATE TABLE IF NOT EXISTS admin_industry_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_industry TEXT CHECK (preferred_industry IN ('pool', 'landscaping', 'building', 'electrical', 'plumbing', 'real_estate', 'other')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PART 5: Comments
-- ============================================

COMMENT ON TABLE subscription_plans IS 'Available subscription plans for different industries and tiers';
COMMENT ON TABLE subscription_history IS 'Audit trail of all subscription changes';
COMMENT ON TABLE admin_industry_preferences IS 'Admin users preferred industry view (doesn''t affect org industry)';
COMMENT ON COLUMN orgs.subscription_plan_id IS 'Current subscription plan';
COMMENT ON COLUMN orgs.subscription_status IS 'Current subscription status';
COMMENT ON COLUMN orgs.subscription_tier IS 'Current subscription tier (t1, t2, t3)';
COMMENT ON COLUMN orgs.industry_locked IS 'Whether industry can be changed (locked after subscription)';
