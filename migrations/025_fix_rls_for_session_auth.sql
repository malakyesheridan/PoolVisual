-- Migration 025: Fix RLS for Session-Based Authentication
-- Replaces auth.uid() with application-provided user context
-- Creates helper functions that accept user_id parameter
-- This fixes the issue where RLS policies fail for session-based auth

-- ============================================
-- PART 1: Create User Context Function
-- ============================================

-- Function to set user context for RLS policies
-- This will be called by application code before queries
CREATE OR REPLACE FUNCTION set_user_context(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Store user context in session variable
  PERFORM set_config('app.user_id', user_uuid::text, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get current user context
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.user_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- PART 2: Update Helper Functions
-- ============================================

-- Update get_user_org_ids to use context or parameter
-- Use function overloading to support both signatures
DROP FUNCTION IF EXISTS get_user_org_ids(UUID);
DROP FUNCTION IF EXISTS get_user_org_ids();

CREATE OR REPLACE FUNCTION get_user_org_ids(user_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
  IF user_uuid IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  
  RETURN ARRAY(
    SELECT org_id 
    FROM org_members 
    WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Overload for RLS policies (no parameters - uses context)
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] AS $$
DECLARE
  effective_user_id UUID;
BEGIN
  effective_user_id := get_current_user_id();
  
  IF effective_user_id IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;
  
  RETURN ARRAY(
    SELECT org_id 
    FROM org_members 
    WHERE user_id = effective_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update is_user_member_of_org
-- Use function overloading to support both signatures
DROP FUNCTION IF EXISTS is_user_member_of_org(UUID, UUID);
DROP FUNCTION IF EXISTS is_user_member_of_org(UUID);

CREATE OR REPLACE FUNCTION is_user_member_of_org(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  effective_user_id UUID;
BEGIN
  effective_user_id := COALESCE(user_uuid, get_current_user_id());
  
  IF effective_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS(
    SELECT 1 
    FROM org_members 
    WHERE user_id = effective_user_id AND org_id = org_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Overload for RLS policies (no parameters - uses context)
CREATE OR REPLACE FUNCTION is_user_member_of_org(org_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  effective_user_id UUID;
BEGIN
  effective_user_id := get_current_user_id();
  
  IF effective_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS(
    SELECT 1 
    FROM org_members 
    WHERE user_id = effective_user_id AND org_id = org_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_user_org_role
-- Use function overloading to support both signatures
DROP FUNCTION IF EXISTS get_user_org_role(UUID, UUID);
DROP FUNCTION IF EXISTS get_user_org_role(UUID);

CREATE OR REPLACE FUNCTION get_user_org_role(user_uuid UUID, org_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  effective_user_id UUID;
  user_role TEXT;
BEGIN
  effective_user_id := COALESCE(user_uuid, get_current_user_id());
  
  IF effective_user_id IS NULL THEN
    RETURN 'none';
  END IF;
  
  SELECT role INTO user_role
  FROM org_members 
  WHERE user_id = effective_user_id AND org_id = org_uuid;
  
  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Overload for RLS policies (no user_uuid - uses context)
CREATE OR REPLACE FUNCTION get_user_org_role(org_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  effective_user_id UUID;
  user_role TEXT;
BEGIN
  effective_user_id := get_current_user_id();
  
  IF effective_user_id IS NULL THEN
    RETURN 'none';
  END IF;
  
  SELECT role INTO user_role
  FROM org_members 
  WHERE user_id = effective_user_id AND org_id = org_uuid;
  
  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update is_admin_user to use context
-- Use function overloading to support both signatures
DROP FUNCTION IF EXISTS is_admin_user(UUID);
DROP FUNCTION IF EXISTS is_admin_user();

CREATE OR REPLACE FUNCTION is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS(
    SELECT 1 FROM users 
    WHERE id = user_uuid AND is_admin = true AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Overload for RLS policies (no parameters - uses context)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
  effective_user_id UUID;
BEGIN
  effective_user_id := get_current_user_id();
  
  IF effective_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS(
    SELECT 1 FROM users 
    WHERE id = effective_user_id AND is_admin = true AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 3: Update RLS Policies
-- ============================================

-- Update all policies to use get_current_user_id() instead of auth.uid()

-- ORGS POLICIES
DROP POLICY IF EXISTS "orgs_select_policy" ON orgs;
CREATE POLICY "orgs_select_policy" ON orgs FOR SELECT
    USING (
      is_admin_user() 
      OR id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "orgs_update_policy" ON orgs;
CREATE POLICY "orgs_update_policy" ON orgs FOR UPDATE
    USING (
      is_admin_user() 
      OR (
        id = ANY(get_user_org_ids()) 
        AND get_user_org_role(id) = 'owner'
      )
    );

DROP POLICY IF EXISTS "orgs_insert_policy" ON orgs;
CREATE POLICY "orgs_insert_policy" ON orgs FOR INSERT
    WITH CHECK (is_admin_user() OR true);

-- ORGANIZATION MEMBERS POLICIES
DROP POLICY IF EXISTS "org_members_select_policy" ON org_members;
CREATE POLICY "org_members_select_policy" ON org_members FOR SELECT
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "org_members_insert_policy" ON org_members;
CREATE POLICY "org_members_insert_policy" ON org_members FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR get_user_org_role(org_id) = 'owner'
    );

DROP POLICY IF EXISTS "org_members_update_policy" ON org_members;
CREATE POLICY "org_members_update_policy" ON org_members FOR UPDATE
    USING (
      is_admin_user() 
      OR get_user_org_role(org_id) = 'owner'
    );

DROP POLICY IF EXISTS "org_members_delete_policy" ON org_members;
CREATE POLICY "org_members_delete_policy" ON org_members FOR DELETE
    USING (
      is_admin_user() 
      OR get_user_org_role(org_id) = 'owner'
    );

-- SETTINGS POLICIES
DROP POLICY IF EXISTS "settings_select_policy" ON settings;
CREATE POLICY "settings_select_policy" ON settings FOR SELECT
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "settings_update_policy" ON settings;
CREATE POLICY "settings_update_policy" ON settings FOR UPDATE
    USING (
      is_admin_user() 
      OR get_user_org_role(org_id) = 'owner'
    );

-- MATERIALS POLICIES
DROP POLICY IF EXISTS "materials_select_policy" ON materials;
CREATE POLICY "materials_select_policy" ON materials FOR SELECT
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids()) 
      OR org_id IS NULL
    );

DROP POLICY IF EXISTS "materials_insert_policy" ON materials;
CREATE POLICY "materials_insert_policy" ON materials FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids()) 
      OR org_id IS NULL
    );

DROP POLICY IF EXISTS "materials_update_policy" ON materials;
CREATE POLICY "materials_update_policy" ON materials FOR UPDATE
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "materials_delete_policy" ON materials;
CREATE POLICY "materials_delete_policy" ON materials FOR DELETE
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

-- LABOR RULES POLICIES
DROP POLICY IF EXISTS "labor_rules_select_policy" ON labor_rules;
CREATE POLICY "labor_rules_select_policy" ON labor_rules FOR SELECT
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids()) 
      OR org_id IS NULL
    );

DROP POLICY IF EXISTS "labor_rules_insert_policy" ON labor_rules;
CREATE POLICY "labor_rules_insert_policy" ON labor_rules FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "labor_rules_update_policy" ON labor_rules;
CREATE POLICY "labor_rules_update_policy" ON labor_rules FOR UPDATE
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "labor_rules_delete_policy" ON labor_rules;
CREATE POLICY "labor_rules_delete_policy" ON labor_rules FOR DELETE
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

-- JOBS POLICIES
DROP POLICY IF EXISTS "jobs_select_policy" ON jobs;
CREATE POLICY "jobs_select_policy" ON jobs FOR SELECT
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "jobs_insert_policy" ON jobs;
CREATE POLICY "jobs_insert_policy" ON jobs FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "jobs_update_policy" ON jobs;
CREATE POLICY "jobs_update_policy" ON jobs FOR UPDATE
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "jobs_delete_policy" ON jobs;
CREATE POLICY "jobs_delete_policy" ON jobs FOR DELETE
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

-- PHOTOS POLICIES
DROP POLICY IF EXISTS "photos_select_policy" ON photos;
CREATE POLICY "photos_select_policy" ON photos FOR SELECT
    USING (
      is_admin_user() 
      OR job_id IN (
        SELECT id FROM jobs 
        WHERE org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "photos_insert_policy" ON photos;
CREATE POLICY "photos_insert_policy" ON photos FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR job_id IN (
        SELECT id FROM jobs 
        WHERE org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "photos_update_policy" ON photos;
CREATE POLICY "photos_update_policy" ON photos FOR UPDATE
    USING (
      is_admin_user() 
      OR job_id IN (
        SELECT id FROM jobs 
        WHERE org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "photos_delete_policy" ON photos;
CREATE POLICY "photos_delete_policy" ON photos FOR DELETE
    USING (
      is_admin_user() 
      OR job_id IN (
        SELECT id FROM jobs 
        WHERE org_id = ANY(get_user_org_ids())
      )
    );

-- MASKS POLICIES
DROP POLICY IF EXISTS "masks_select_policy" ON masks;
CREATE POLICY "masks_select_policy" ON masks FOR SELECT
    USING (
      is_admin_user() 
      OR photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "masks_insert_policy" ON masks;
CREATE POLICY "masks_insert_policy" ON masks FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "masks_update_policy" ON masks;
CREATE POLICY "masks_update_policy" ON masks FOR UPDATE
    USING (
      is_admin_user() 
      OR photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "masks_delete_policy" ON masks;
CREATE POLICY "masks_delete_policy" ON masks FOR DELETE
    USING (
      is_admin_user() 
      OR photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids())
      )
    );

-- QUOTES POLICIES
DROP POLICY IF EXISTS "quotes_select_policy" ON quotes;
CREATE POLICY "quotes_select_policy" ON quotes FOR SELECT
    USING (
      is_admin_user() 
      OR job_id IN (
        SELECT id FROM jobs 
        WHERE org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "quotes_insert_policy" ON quotes;
CREATE POLICY "quotes_insert_policy" ON quotes FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR job_id IN (
        SELECT id FROM jobs 
        WHERE org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "quotes_update_policy" ON quotes;
CREATE POLICY "quotes_update_policy" ON quotes FOR UPDATE
    USING (
      is_admin_user() 
      OR job_id IN (
        SELECT id FROM jobs 
        WHERE org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "quotes_delete_policy" ON quotes;
CREATE POLICY "quotes_delete_policy" ON quotes FOR DELETE
    USING (
      is_admin_user() 
      OR job_id IN (
        SELECT id FROM jobs 
        WHERE org_id = ANY(get_user_org_ids())
      )
    );

-- QUOTE ITEMS POLICIES
DROP POLICY IF EXISTS "quote_items_select_policy" ON quote_items;
CREATE POLICY "quote_items_select_policy" ON quote_items FOR SELECT
    USING (
      is_admin_user() 
      OR quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "quote_items_insert_policy" ON quote_items;
CREATE POLICY "quote_items_insert_policy" ON quote_items FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "quote_items_update_policy" ON quote_items;
CREATE POLICY "quote_items_update_policy" ON quote_items FOR UPDATE
    USING (
      is_admin_user() 
      OR quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids())
      )
    );

DROP POLICY IF EXISTS "quote_items_delete_policy" ON quote_items;
CREATE POLICY "quote_items_delete_policy" ON quote_items FOR DELETE
    USING (
      is_admin_user() 
      OR quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids())
      )
    );

-- NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT
    USING (
      is_admin_user() 
      OR user_id = get_current_user_id()
    );

DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR user_id = get_current_user_id()
    );

DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
CREATE POLICY "notifications_update_policy" ON notifications FOR UPDATE
    USING (
      is_admin_user() 
      OR user_id = get_current_user_id()
    );

DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;
CREATE POLICY "notifications_delete_policy" ON notifications FOR DELETE
    USING (
      is_admin_user() 
      OR user_id = get_current_user_id()
    );

-- AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
CREATE POLICY "audit_logs_select_policy" ON audit_logs FOR SELECT
    USING (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON audit_logs FOR INSERT
    WITH CHECK (
      is_admin_user() 
      OR org_id = ANY(get_user_org_ids())
    );

-- PUBLIC LINKS POLICIES
DROP POLICY IF EXISTS "public_links_select_policy" ON public_links;
CREATE POLICY "public_links_select_policy" ON public_links FOR SELECT
    USING (is_admin_user() OR true);

DROP POLICY IF EXISTS "public_links_insert_policy" ON public_links;
CREATE POLICY "public_links_insert_policy" ON public_links FOR INSERT
    WITH CHECK (is_admin_user() OR get_current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "public_links_update_policy" ON public_links;
CREATE POLICY "public_links_update_policy" ON public_links FOR UPDATE
    USING (is_admin_user() OR get_current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS "public_links_delete_policy" ON public_links;
CREATE POLICY "public_links_delete_policy" ON public_links FOR DELETE
    USING (is_admin_user() OR get_current_user_id() IS NOT NULL);

-- ============================================
-- PART 4: System Functions (Bypass RLS)
-- ============================================

-- These functions are used by background jobs and bypass RLS
-- They use SECURITY DEFINER and explicit user_id parameter

CREATE OR REPLACE FUNCTION system_get_masks_by_photo(photo_uuid UUID)
RETURNS TABLE(
  id UUID,
  photo_id UUID,
  type TEXT,
  path_json JSONB,
  material_id UUID,
  calc_meta_json JSONB,
  created_by UUID,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.photo_id,
    m.type::TEXT,
    m.path_json,
    m.material_id,
    m.calc_meta_json,
    m.created_by,
    m.created_at
  FROM masks m
  WHERE m.photo_id = photo_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION system_get_masks_by_photo IS 'System function to get masks bypassing RLS. Used by background jobs.';
COMMENT ON FUNCTION set_user_context IS 'Sets user context for RLS policies. Called by application before queries.';
COMMENT ON FUNCTION get_current_user_id IS 'Gets current user context from session variable. Used by RLS policies.';
