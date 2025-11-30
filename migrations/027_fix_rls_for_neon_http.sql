-- Migration 027: Fix RLS for Neon HTTP (stateless driver)
-- Neon HTTP doesn't support session variables, so we create SECURITY DEFINER
-- wrapper functions that accept user_id as a parameter and bypass RLS

-- ============================================
-- PART 1: User Onboarding Functions
-- ============================================

-- Drop existing functions first (to allow return type changes)
DROP FUNCTION IF EXISTS system_get_user_onboarding(UUID);
DROP FUNCTION IF EXISTS system_update_user_onboarding(UUID, TEXT, JSONB, BOOLEAN, UUID, UUID);
DROP FUNCTION IF EXISTS system_complete_user_onboarding(UUID);

-- Get user onboarding (bypasses RLS)
-- NOTE: user_onboarding table uses user_id as PRIMARY KEY (no separate id column)
CREATE OR REPLACE FUNCTION system_get_user_onboarding(user_uuid UUID)
RETURNS TABLE(
  user_id UUID,
  step TEXT,
  completed BOOLEAN,
  responses JSONB,
  first_job_id UUID,
  first_photo_id UUID,
  completed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uo.user_id,
    uo.step,
    uo.completed,
    uo.responses,
    uo.first_job_id,
    uo.first_photo_id,
    uo.completed_at,
    uo.created_at,
    uo.updated_at
  FROM user_onboarding uo
  WHERE uo.user_id = user_uuid
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user onboarding (bypasses RLS)
-- NOTE: user_onboarding table uses user_id as PRIMARY KEY (no separate id column)
CREATE OR REPLACE FUNCTION system_update_user_onboarding(
  user_uuid UUID,
  step_value TEXT,
  responses_value JSONB,
  completed_value BOOLEAN DEFAULT FALSE,
  first_job_id_value UUID DEFAULT NULL,
  first_photo_id_value UUID DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  step TEXT,
  completed BOOLEAN,
  responses JSONB,
  first_job_id UUID,
  first_photo_id UUID,
  completed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  -- Update or insert
  INSERT INTO user_onboarding (user_id, step, completed, responses, first_job_id, first_photo_id, updated_at)
  VALUES (user_uuid, step_value, completed_value, responses_value, first_job_id_value, first_photo_id_value, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    step = EXCLUDED.step,
    completed = EXCLUDED.completed,
    responses = EXCLUDED.responses,
    first_job_id = COALESCE(EXCLUDED.first_job_id, user_onboarding.first_job_id),
    first_photo_id = COALESCE(EXCLUDED.first_photo_id, user_onboarding.first_photo_id),
    updated_at = NOW();
  
  -- Return the updated/inserted record (qualify column names to avoid ambiguity)
  RETURN QUERY 
  SELECT 
    uo.user_id,
    uo.step,
    uo.completed,
    uo.responses,
    uo.first_job_id,
    uo.first_photo_id,
    uo.completed_at,
    uo.created_at,
    uo.updated_at
  FROM user_onboarding uo
  WHERE uo.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete user onboarding (bypasses RLS)
CREATE OR REPLACE FUNCTION system_complete_user_onboarding(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_onboarding
  SET completed = TRUE, updated_at = NOW()
  WHERE user_id = user_uuid;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO user_onboarding (user_id, step, completed, responses, updated_at)
    VALUES (user_uuid, 'completed', TRUE, '{}'::jsonb, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 2: Materials Functions
-- ============================================

-- Get materials for org (bypasses RLS, but filters by org_id)
CREATE OR REPLACE FUNCTION system_get_materials(
  org_uuid UUID DEFAULT NULL,
  category_filter TEXT DEFAULT NULL,
  industry_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  org_id UUID,
  name TEXT,
  sku TEXT,
  category TEXT,
  unit TEXT,
  price DECIMAL,
  image_url TEXT,
  texture_url TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.org_id,
    m.name,
    m.sku,
    m.category,
    m.unit,
    m.price,
    m.image_url,
    m.texture_url,
    m.is_active,
    m.created_at,
    m.updated_at
  FROM materials m
  WHERE m.is_active = TRUE
    AND (org_uuid IS NULL OR m.org_id = org_uuid OR m.org_id IS NULL)
    AND (category_filter IS NULL OR m.category = category_filter);
  -- Industry filtering would need trade_category_mapping join - simplified for now
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 3: User Orgs Function
-- ============================================

-- Get user orgs (bypasses RLS)
CREATE OR REPLACE FUNCTION system_get_user_orgs(user_uuid UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  industry TEXT,
  subscription_status TEXT,
  subscription_tier TEXT,
  industry_locked BOOLEAN,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    COALESCE(o.industry, 'pool') as industry,
    o.subscription_status,
    o.subscription_tier,
    o.industry_locked,
    o.created_at
  FROM orgs o
  INNER JOIN org_members om ON o.id = om.org_id
  WHERE om.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION system_get_user_onboarding IS 'Bypasses RLS to get user onboarding. Used with Neon HTTP driver.';
COMMENT ON FUNCTION system_update_user_onboarding IS 'Bypasses RLS to update user onboarding. Used with Neon HTTP driver.';
COMMENT ON FUNCTION system_complete_user_onboarding IS 'Bypasses RLS to complete user onboarding. Used with Neon HTTP driver.';
COMMENT ON FUNCTION system_get_materials IS 'Bypasses RLS to get materials. Used with Neon HTTP driver.';
COMMENT ON FUNCTION system_get_user_orgs IS 'Bypasses RLS to get user orgs. Used with Neon HTTP driver.';
