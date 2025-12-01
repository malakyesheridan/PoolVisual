-- Migration 029: User-Centric RLS Policies
-- Updates Row Level Security policies to be user-based instead of org-based
-- This ensures complete data isolation between users

-- ============================================
-- PART 1: Drop Old Org-Based Policies
-- ============================================

-- Drop existing org-based policies
DROP POLICY IF EXISTS "orgs_select_policy" ON orgs;
DROP POLICY IF EXISTS "orgs_update_policy" ON orgs;
DROP POLICY IF EXISTS "orgs_insert_policy" ON orgs;
DROP POLICY IF EXISTS "org_members_select_policy" ON org_members;
DROP POLICY IF EXISTS "org_members_insert_policy" ON org_members;
DROP POLICY IF EXISTS "org_members_update_policy" ON org_members;
DROP POLICY IF EXISTS "org_members_delete_policy" ON org_members;
DROP POLICY IF EXISTS "settings_select_policy" ON settings;
DROP POLICY IF EXISTS "settings_update_policy" ON settings;
DROP POLICY IF EXISTS "settings_insert_policy" ON settings;
DROP POLICY IF EXISTS "materials_select_policy" ON materials;
DROP POLICY IF EXISTS "materials_insert_policy" ON materials;
DROP POLICY IF EXISTS "materials_update_policy" ON materials;
DROP POLICY IF EXISTS "materials_delete_policy" ON materials;
DROP POLICY IF EXISTS "labor_rules_select_policy" ON labor_rules;
DROP POLICY IF EXISTS "labor_rules_insert_policy" ON labor_rules;
DROP POLICY IF EXISTS "labor_rules_update_policy" ON labor_rules;
DROP POLICY IF EXISTS "labor_rules_delete_policy" ON labor_rules;
DROP POLICY IF EXISTS "Users can view org jobs" ON jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON jobs;
DROP POLICY IF EXISTS "photos_select_policy" ON photos;
DROP POLICY IF EXISTS "photos_insert_policy" ON photos;
DROP POLICY IF EXISTS "photos_update_policy" ON photos;
DROP POLICY IF EXISTS "photos_delete_policy" ON photos;
DROP POLICY IF EXISTS "masks_select_policy" ON masks;
DROP POLICY IF EXISTS "masks_insert_policy" ON masks;
DROP POLICY IF EXISTS "masks_update_policy" ON masks;
DROP POLICY IF EXISTS "masks_delete_policy" ON masks;
DROP POLICY IF EXISTS "quotes_select_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_insert_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_update_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_delete_policy" ON quotes;
DROP POLICY IF EXISTS "quote_items_select_policy" ON quote_items;
DROP POLICY IF EXISTS "quote_items_insert_policy" ON quote_items;
DROP POLICY IF EXISTS "quote_items_update_policy" ON quote_items;
DROP POLICY IF EXISTS "quote_items_delete_policy" ON quote_items;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;

-- ============================================
-- PART 2: Create User-Based Helper Functions
-- ============================================

-- Helper function to get current user ID (for RLS)
-- This works with both session-based auth and Neon HTTP
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  -- Try to get from session variable (works with session auth)
  IF current_setting('app.user_id', TRUE) != '' THEN
    RETURN current_setting('app.user_id', TRUE)::UUID;
  END IF;
  
  -- Fallback: return NULL (will be handled by application layer)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- PART 3: Jobs Policies (User-Based)
-- ============================================

-- Users can view their own jobs
CREATE POLICY "users_view_own_jobs" ON jobs FOR SELECT
  USING (user_id = get_current_user_id());

-- Users can create jobs for themselves
CREATE POLICY "users_create_own_jobs" ON jobs FOR INSERT
  WITH CHECK (user_id = get_current_user_id());

-- Users can update their own jobs
CREATE POLICY "users_update_own_jobs" ON jobs FOR UPDATE
  USING (user_id = get_current_user_id())
  WITH CHECK (user_id = get_current_user_id());

-- Users can delete their own jobs
CREATE POLICY "users_delete_own_jobs" ON jobs FOR DELETE
  USING (user_id = get_current_user_id());

-- ============================================
-- PART 4: Photos Policies (Via Job Ownership)
-- ============================================

-- Users can view photos from their own jobs
CREATE POLICY "users_view_own_photos" ON photos FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  );

-- Users can create photos for their own jobs
CREATE POLICY "users_create_own_photos" ON photos FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  );

-- Users can update photos from their own jobs
CREATE POLICY "users_update_own_photos" ON photos FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  );

-- Users can delete photos from their own jobs
CREATE POLICY "users_delete_own_photos" ON photos FOR DELETE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  );

-- ============================================
-- PART 5: Masks Policies (User-Based)
-- ============================================

-- Users can view their own masks
CREATE POLICY "users_view_own_masks" ON masks FOR SELECT
  USING (user_id = get_current_user_id());

-- Users can create masks for themselves
CREATE POLICY "users_create_own_masks" ON masks FOR INSERT
  WITH CHECK (user_id = get_current_user_id());

-- Users can update their own masks
CREATE POLICY "users_update_own_masks" ON masks FOR UPDATE
  USING (user_id = get_current_user_id())
  WITH CHECK (user_id = get_current_user_id());

-- Users can delete their own masks
CREATE POLICY "users_delete_own_masks" ON masks FOR DELETE
  USING (user_id = get_current_user_id());

-- ============================================
-- PART 6: Quotes Policies (Via Job Ownership)
-- ============================================

-- Users can view quotes from their own jobs
CREATE POLICY "users_view_own_quotes" ON quotes FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  );

-- Users can create quotes for their own jobs
CREATE POLICY "users_create_own_quotes" ON quotes FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  );

-- Users can update quotes from their own jobs
CREATE POLICY "users_update_own_quotes" ON quotes FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  )
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  );

-- Users can delete quotes from their own jobs
CREATE POLICY "users_delete_own_quotes" ON quotes FOR DELETE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = get_current_user_id()
    )
  );

-- ============================================
-- PART 7: Quote Items Policies (Via Quote Ownership)
-- ============================================

-- Users can view quote items from their own quotes
CREATE POLICY "users_view_own_quote_items" ON quote_items FOR SELECT
  USING (
    quote_id IN (
      SELECT q.id FROM quotes q
      JOIN jobs j ON j.id = q.job_id
      WHERE j.user_id = get_current_user_id()
    )
  );

-- Users can create quote items for their own quotes
CREATE POLICY "users_create_own_quote_items" ON quote_items FOR INSERT
  WITH CHECK (
    quote_id IN (
      SELECT q.id FROM quotes q
      JOIN jobs j ON j.id = q.job_id
      WHERE j.user_id = get_current_user_id()
    )
  );

-- Users can update quote items from their own quotes
CREATE POLICY "users_update_own_quote_items" ON quote_items FOR UPDATE
  USING (
    quote_id IN (
      SELECT q.id FROM quotes q
      JOIN jobs j ON j.id = q.job_id
      WHERE j.user_id = get_current_user_id()
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT q.id FROM quotes q
      JOIN jobs j ON j.id = q.job_id
      WHERE j.user_id = get_current_user_id()
    )
  );

-- Users can delete quote items from their own quotes
CREATE POLICY "users_delete_own_quote_items" ON quote_items FOR DELETE
  USING (
    quote_id IN (
      SELECT q.id FROM quotes q
      JOIN jobs j ON j.id = q.job_id
      WHERE j.user_id = get_current_user_id()
    )
  );

-- ============================================
-- PART 8: Materials Policies (User-Based + Global)
-- ============================================

-- Users can view their own materials OR global materials (user_id IS NULL)
CREATE POLICY "users_view_own_or_global_materials" ON materials FOR SELECT
  USING (
    user_id = get_current_user_id() 
    OR user_id IS NULL
  );

-- Users can create materials for themselves
CREATE POLICY "users_create_own_materials" ON materials FOR INSERT
  WITH CHECK (user_id = get_current_user_id() OR user_id IS NULL);

-- Users can update their own materials (not global)
CREATE POLICY "users_update_own_materials" ON materials FOR UPDATE
  USING (user_id = get_current_user_id())
  WITH CHECK (user_id = get_current_user_id());

-- Users can delete their own materials (not global)
CREATE POLICY "users_delete_own_materials" ON materials FOR DELETE
  USING (user_id = get_current_user_id());

-- ============================================
-- PART 9: Labor Rules Policies (User-Based)
-- ============================================

-- Users can view their own labor rules
CREATE POLICY "users_view_own_labor_rules" ON labor_rules FOR SELECT
  USING (user_id = get_current_user_id());

-- Users can create labor rules for themselves
CREATE POLICY "users_create_own_labor_rules" ON labor_rules FOR INSERT
  WITH CHECK (user_id = get_current_user_id());

-- Users can update their own labor rules
CREATE POLICY "users_update_own_labor_rules" ON labor_rules FOR UPDATE
  USING (user_id = get_current_user_id())
  WITH CHECK (user_id = get_current_user_id());

-- Users can delete their own labor rules
CREATE POLICY "users_delete_own_labor_rules" ON labor_rules FOR DELETE
  USING (user_id = get_current_user_id());

-- ============================================
-- PART 10: Settings Policies (Deprecated - Now on Users Table)
-- ============================================

-- Settings table is deprecated (settings moved to users table)
-- Keep policies for backward compatibility but they won't be used
CREATE POLICY "users_view_own_settings" ON settings FOR SELECT
  USING (false); -- Always false, use users table instead

-- ============================================
-- PART 11: Audit Logs Policies (User-Based)
-- ============================================

-- Users can view their own audit logs
CREATE POLICY "users_view_own_audit_logs" ON audit_logs FOR SELECT
  USING (user_id = get_current_user_id());

-- System can insert audit logs (handled by application)
CREATE POLICY "users_insert_own_audit_logs" ON audit_logs FOR INSERT
  WITH CHECK (user_id = get_current_user_id());

-- Audit logs are read-only for users
CREATE POLICY "audit_logs_no_update" ON audit_logs FOR UPDATE
  USING (false);

CREATE POLICY "audit_logs_no_delete" ON audit_logs FOR DELETE
  USING (false);

-- ============================================
-- PART 12: Users Table Policies (Self-Access)
-- ============================================

-- Users can view their own user record
CREATE POLICY "users_view_self" ON users FOR SELECT
  USING (id = get_current_user_id());

-- Users can update their own user record (limited fields)
CREATE POLICY "users_update_self" ON users FOR UPDATE
  USING (id = get_current_user_id())
  WITH CHECK (id = get_current_user_id());

-- Users cannot delete themselves (handled by application)
CREATE POLICY "users_no_delete" ON users FOR DELETE
  USING (false);

-- ============================================
-- PART 13: Notifications Policies (Already User-Based)
-- ============================================

-- Notifications are already user-based, but ensure policies exist
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;

CREATE POLICY "users_view_own_notifications" ON notifications FOR SELECT
  USING (user_id = get_current_user_id());

CREATE POLICY "users_create_own_notifications" ON notifications FOR INSERT
  WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "users_update_own_notifications" ON notifications FOR UPDATE
  USING (user_id = get_current_user_id())
  WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "users_delete_own_notifications" ON notifications FOR DELETE
  USING (user_id = get_current_user_id());

-- ============================================
-- PART 14: Public Links (No Auth Required)
-- ============================================

-- Public links are accessible to anyone (for quote sharing)
DROP POLICY IF EXISTS "public_links_select_policy" ON public_links;
DROP POLICY IF EXISTS "public_links_insert_policy" ON public_links;

CREATE POLICY "public_links_view" ON public_links FOR SELECT
  USING (true);

-- Only authenticated users can create public links
CREATE POLICY "public_links_create" ON public_links FOR INSERT
  WITH CHECK (get_current_user_id() IS NOT NULL);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- RLS policies are now user-based
-- All data is isolated per user
-- Next: Update application code to use user_id
