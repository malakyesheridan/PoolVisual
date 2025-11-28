-- Migration 020: Admin RLS Bypass
-- Updates all RLS policies to allow admin users to bypass restrictions
-- This migration requires migration 019_admin_system.sql to be run first
-- Admins will have full access to all resources while regular users maintain existing restrictions

-- Note: This assumes is_admin_user() function exists from migration 019
-- If the function doesn't exist yet, it will be created in migration 019

-- ORGANIZATIONS POLICIES - Add admin bypass
DROP POLICY IF EXISTS "orgs_select_policy" ON orgs;
CREATE POLICY "orgs_select_policy" ON orgs FOR SELECT
    USING (is_admin_user(auth.uid()) OR id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "orgs_update_policy" ON orgs;
CREATE POLICY "orgs_update_policy" ON orgs FOR UPDATE
    USING (is_admin_user(auth.uid()) OR (id = ANY(get_user_org_ids(auth.uid())) AND get_user_org_role(auth.uid(), id) = 'owner')));

DROP POLICY IF EXISTS "orgs_insert_policy" ON orgs;
CREATE POLICY "orgs_insert_policy" ON orgs FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR true); -- Admins can insert, regular users handled by app logic

-- ORGANIZATION MEMBERS POLICIES - Add admin bypass
DROP POLICY IF EXISTS "org_members_select_policy" ON org_members;
CREATE POLICY "org_members_select_policy" ON org_members FOR SELECT
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "org_members_insert_policy" ON org_members;
CREATE POLICY "org_members_insert_policy" ON org_members FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR get_user_org_role(auth.uid(), org_id) = 'owner');

DROP POLICY IF EXISTS "org_members_update_policy" ON org_members;
CREATE POLICY "org_members_update_policy" ON org_members FOR UPDATE
    USING (is_admin_user(auth.uid()) OR get_user_org_role(auth.uid(), org_id) = 'owner');

DROP POLICY IF EXISTS "org_members_delete_policy" ON org_members;
CREATE POLICY "org_members_delete_policy" ON org_members FOR DELETE
    USING (is_admin_user(auth.uid()) OR get_user_org_role(auth.uid(), org_id) = 'owner');

-- SETTINGS POLICIES - Add admin bypass
DROP POLICY IF EXISTS "settings_select_policy" ON settings;
CREATE POLICY "settings_select_policy" ON settings FOR SELECT
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "settings_update_policy" ON settings;
CREATE POLICY "settings_update_policy" ON settings FOR UPDATE
    USING (is_admin_user(auth.uid()) OR get_user_org_role(auth.uid(), org_id) = 'owner');

-- MATERIALS POLICIES - Add admin bypass
DROP POLICY IF EXISTS "materials_select_policy" ON materials;
CREATE POLICY "materials_select_policy" ON materials FOR SELECT
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())) OR org_id IS NULL);

DROP POLICY IF EXISTS "materials_insert_policy" ON materials;
CREATE POLICY "materials_insert_policy" ON materials FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())) OR org_id IS NULL);

DROP POLICY IF EXISTS "materials_update_policy" ON materials;
CREATE POLICY "materials_update_policy" ON materials FOR UPDATE
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "materials_delete_policy" ON materials;
CREATE POLICY "materials_delete_policy" ON materials FOR DELETE
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

-- LABOR RULES POLICIES - Add admin bypass
DROP POLICY IF EXISTS "labor_rules_select_policy" ON labor_rules;
CREATE POLICY "labor_rules_select_policy" ON labor_rules FOR SELECT
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())) OR org_id IS NULL);

DROP POLICY IF EXISTS "labor_rules_insert_policy" ON labor_rules;
CREATE POLICY "labor_rules_insert_policy" ON labor_rules FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "labor_rules_update_policy" ON labor_rules;
CREATE POLICY "labor_rules_update_policy" ON labor_rules FOR UPDATE
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "labor_rules_delete_policy" ON labor_rules;
CREATE POLICY "labor_rules_delete_policy" ON labor_rules FOR DELETE
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

-- JOBS POLICIES - Add admin bypass
DROP POLICY IF EXISTS "jobs_select_policy" ON jobs;
CREATE POLICY "jobs_select_policy" ON jobs FOR SELECT
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "jobs_insert_policy" ON jobs;
CREATE POLICY "jobs_insert_policy" ON jobs FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "jobs_update_policy" ON jobs;
CREATE POLICY "jobs_update_policy" ON jobs FOR UPDATE
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "jobs_delete_policy" ON jobs;
CREATE POLICY "jobs_delete_policy" ON jobs FOR DELETE
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

-- PHOTOS POLICIES - Add admin bypass
DROP POLICY IF EXISTS "photos_select_policy" ON photos;
CREATE POLICY "photos_select_policy" ON photos FOR SELECT
    USING (is_admin_user(auth.uid()) OR job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "photos_insert_policy" ON photos;
CREATE POLICY "photos_insert_policy" ON photos FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "photos_update_policy" ON photos;
CREATE POLICY "photos_update_policy" ON photos FOR UPDATE
    USING (is_admin_user(auth.uid()) OR job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "photos_delete_policy" ON photos;
CREATE POLICY "photos_delete_policy" ON photos FOR DELETE
    USING (is_admin_user(auth.uid()) OR job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- MASKS POLICIES - Add admin bypass
DROP POLICY IF EXISTS "masks_select_policy" ON masks;
CREATE POLICY "masks_select_policy" ON masks FOR SELECT
    USING (is_admin_user(auth.uid()) OR photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "masks_insert_policy" ON masks;
CREATE POLICY "masks_insert_policy" ON masks FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "masks_update_policy" ON masks;
CREATE POLICY "masks_update_policy" ON masks FOR UPDATE
    USING (is_admin_user(auth.uid()) OR photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "masks_delete_policy" ON masks;
CREATE POLICY "masks_delete_policy" ON masks FOR DELETE
    USING (is_admin_user(auth.uid()) OR photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- QUOTES POLICIES - Add admin bypass
DROP POLICY IF EXISTS "quotes_select_policy" ON quotes;
CREATE POLICY "quotes_select_policy" ON quotes FOR SELECT
    USING (is_admin_user(auth.uid()) OR job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "quotes_insert_policy" ON quotes;
CREATE POLICY "quotes_insert_policy" ON quotes FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "quotes_update_policy" ON quotes;
CREATE POLICY "quotes_update_policy" ON quotes FOR UPDATE
    USING (is_admin_user(auth.uid()) OR job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "quotes_delete_policy" ON quotes;
CREATE POLICY "quotes_delete_policy" ON quotes FOR DELETE
    USING (is_admin_user(auth.uid()) OR job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- QUOTE ITEMS POLICIES - Add admin bypass
DROP POLICY IF EXISTS "quote_items_select_policy" ON quote_items;
CREATE POLICY "quote_items_select_policy" ON quote_items FOR SELECT
    USING (is_admin_user(auth.uid()) OR quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "quote_items_insert_policy" ON quote_items;
CREATE POLICY "quote_items_insert_policy" ON quote_items FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "quote_items_update_policy" ON quote_items;
CREATE POLICY "quote_items_update_policy" ON quote_items FOR UPDATE
    USING (is_admin_user(auth.uid()) OR quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

DROP POLICY IF EXISTS "quote_items_delete_policy" ON quote_items;
CREATE POLICY "quote_items_delete_policy" ON quote_items FOR DELETE
    USING (is_admin_user(auth.uid()) OR quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- NOTIFICATIONS POLICIES - Add admin bypass (admins can see all notifications)
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT
    USING (is_admin_user(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
CREATE POLICY "notifications_update_policy" ON notifications FOR UPDATE
    USING (is_admin_user(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;
CREATE POLICY "notifications_delete_policy" ON notifications FOR DELETE
    USING (is_admin_user(auth.uid()) OR user_id = auth.uid());

-- AUDIT LOGS POLICIES - Add admin bypass (admins can see all audit logs)
DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
CREATE POLICY "audit_logs_select_policy" ON audit_logs FOR SELECT
    USING (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON audit_logs FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR org_id = ANY(get_user_org_ids(auth.uid())));

-- Audit logs remain read-only for updates/deletes (even for admins, for security)
-- But admins can view all audit logs

-- PUBLIC LINKS POLICIES - Admins can manage all public links
DROP POLICY IF EXISTS "public_links_select_policy" ON public_links;
CREATE POLICY "public_links_select_policy" ON public_links FOR SELECT
    USING (is_admin_user(auth.uid()) OR true); -- Anyone can view, but admins explicitly included

DROP POLICY IF EXISTS "public_links_insert_policy" ON public_links;
CREATE POLICY "public_links_insert_policy" ON public_links FOR INSERT
    WITH CHECK (is_admin_user(auth.uid()) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "public_links_update_policy" ON public_links;
CREATE POLICY "public_links_update_policy" ON public_links FOR UPDATE
    USING (is_admin_user(auth.uid()) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "public_links_delete_policy" ON public_links;
CREATE POLICY "public_links_delete_policy" ON public_links FOR DELETE
    USING (is_admin_user(auth.uid()) OR auth.uid() IS NOT NULL);

-- Add comment
COMMENT ON POLICY "orgs_select_policy" ON orgs IS 'Admins can view all orgs, regular users see only their orgs';
COMMENT ON POLICY "jobs_select_policy" ON jobs IS 'Admins can view all jobs, regular users see only their org jobs';

