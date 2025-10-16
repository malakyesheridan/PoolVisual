-- Comprehensive Row Level Security Policies for Multi-Tenant PoolVisual
-- This file should be applied after the initial schema migration

-- Enable RLS on all tables (already done in initial migration, but ensuring it's enabled)
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE masks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their orgs" ON orgs;
DROP POLICY IF EXISTS "Users can view org jobs" ON jobs;

-- Helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_org_ids(user_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT org_id 
        FROM org_members 
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is member of specific org
CREATE OR REPLACE FUNCTION is_user_member_of_org(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 
        FROM org_members 
        WHERE user_id = user_uuid AND org_id = org_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role in organization
CREATE OR REPLACE FUNCTION get_user_org_role(user_uuid UUID, org_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM org_members 
    WHERE user_id = user_uuid AND org_id = org_uuid;
    
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ORGANIZATIONS POLICIES
-- Users can view organizations they're members of
CREATE POLICY "orgs_select_policy" ON orgs FOR SELECT
    USING (id = ANY(get_user_org_ids(auth.uid())));

-- Users can update organizations they're owners of
CREATE POLICY "orgs_update_policy" ON orgs FOR UPDATE
    USING (id = ANY(get_user_org_ids(auth.uid())) AND 
           get_user_org_role(auth.uid(), id) = 'owner');

-- Users can insert organizations (they become owners)
CREATE POLICY "orgs_insert_policy" ON orgs FOR INSERT
    WITH CHECK (true); -- Will be handled by application logic

-- ORGANIZATION MEMBERS POLICIES
-- Users can view members of their organizations
CREATE POLICY "org_members_select_policy" ON org_members FOR SELECT
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- Only owners can manage members
CREATE POLICY "org_members_insert_policy" ON org_members FOR INSERT
    WITH CHECK (get_user_org_role(auth.uid(), org_id) = 'owner');

CREATE POLICY "org_members_update_policy" ON org_members FOR UPDATE
    USING (get_user_org_role(auth.uid(), org_id) = 'owner');

CREATE POLICY "org_members_delete_policy" ON org_members FOR DELETE
    USING (get_user_org_role(auth.uid(), org_id) = 'owner');

-- SETTINGS POLICIES
-- Users can view settings of their organizations
CREATE POLICY "settings_select_policy" ON settings FOR SELECT
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- Only owners can update settings
CREATE POLICY "settings_update_policy" ON settings FOR UPDATE
    USING (get_user_org_role(auth.uid(), org_id) = 'owner');

-- MATERIALS POLICIES
-- Users can view materials from their organizations OR global materials
CREATE POLICY "materials_select_policy" ON materials FOR SELECT
    USING (org_id = ANY(get_user_org_ids(auth.uid())) OR org_id IS NULL);

-- Users can create materials for their organizations
CREATE POLICY "materials_insert_policy" ON materials FOR INSERT
    WITH CHECK (org_id = ANY(get_user_org_ids(auth.uid())) OR org_id IS NULL);

-- Users can update materials from their organizations
CREATE POLICY "materials_update_policy" ON materials FOR UPDATE
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- Users can delete materials from their organizations
CREATE POLICY "materials_delete_policy" ON materials FOR DELETE
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- LABOR RULES POLICIES
-- Users can view labor rules from their organizations OR global rules
CREATE POLICY "labor_rules_select_policy" ON labor_rules FOR SELECT
    USING (org_id = ANY(get_user_org_ids(auth.uid())) OR org_id IS NULL);

-- Users can create labor rules for their organizations
CREATE POLICY "labor_rules_insert_policy" ON labor_rules FOR INSERT
    WITH CHECK (org_id = ANY(get_user_org_ids(auth.uid())));

-- Users can update labor rules from their organizations
CREATE POLICY "labor_rules_update_policy" ON labor_rules FOR UPDATE
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- Users can delete labor rules from their organizations
CREATE POLICY "labor_rules_delete_policy" ON labor_rules FOR DELETE
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- JOBS POLICIES
-- Users can view jobs from their organizations
CREATE POLICY "jobs_select_policy" ON jobs FOR SELECT
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- Users can create jobs for their organizations
CREATE POLICY "jobs_insert_policy" ON jobs FOR INSERT
    WITH CHECK (org_id = ANY(get_user_org_ids(auth.uid())));

-- Users can update jobs from their organizations
CREATE POLICY "jobs_update_policy" ON jobs FOR UPDATE
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- Users can delete jobs from their organizations
CREATE POLICY "jobs_delete_policy" ON jobs FOR DELETE
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- PHOTOS POLICIES
-- Users can view photos from jobs in their organizations
CREATE POLICY "photos_select_policy" ON photos FOR SELECT
    USING (job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can create photos for jobs in their organizations
CREATE POLICY "photos_insert_policy" ON photos FOR INSERT
    WITH CHECK (job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can update photos from jobs in their organizations
CREATE POLICY "photos_update_policy" ON photos FOR UPDATE
    USING (job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can delete photos from jobs in their organizations
CREATE POLICY "photos_delete_policy" ON photos FOR DELETE
    USING (job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- MASKS POLICIES
-- Users can view masks from photos in their organizations
CREATE POLICY "masks_select_policy" ON masks FOR SELECT
    USING (photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can create masks for photos in their organizations
CREATE POLICY "masks_insert_policy" ON masks FOR INSERT
    WITH CHECK (photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can update masks from photos in their organizations
CREATE POLICY "masks_update_policy" ON masks FOR UPDATE
    USING (photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can delete masks from photos in their organizations
CREATE POLICY "masks_delete_policy" ON masks FOR DELETE
    USING (photo_id IN (
        SELECT p.id FROM photos p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- QUOTES POLICIES
-- Users can view quotes from jobs in their organizations
CREATE POLICY "quotes_select_policy" ON quotes FOR SELECT
    USING (job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can create quotes for jobs in their organizations
CREATE POLICY "quotes_insert_policy" ON quotes FOR INSERT
    WITH CHECK (job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can update quotes from jobs in their organizations
CREATE POLICY "quotes_update_policy" ON quotes FOR UPDATE
    USING (job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can delete quotes from jobs in their organizations
CREATE POLICY "quotes_delete_policy" ON quotes FOR DELETE
    USING (job_id IN (
        SELECT id FROM jobs WHERE org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- QUOTE ITEMS POLICIES
-- Users can view quote items from quotes in their organizations
CREATE POLICY "quote_items_select_policy" ON quote_items FOR SELECT
    USING (quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can create quote items for quotes in their organizations
CREATE POLICY "quote_items_insert_policy" ON quote_items FOR INSERT
    WITH CHECK (quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can update quote items from quotes in their organizations
CREATE POLICY "quote_items_update_policy" ON quote_items FOR UPDATE
    USING (quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- Users can delete quote items from quotes in their organizations
CREATE POLICY "quote_items_delete_policy" ON quote_items FOR DELETE
    USING (quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON q.job_id = j.id
        WHERE j.org_id = ANY(get_user_org_ids(auth.uid()))
    ));

-- NOTIFICATIONS POLICIES
-- Users can view their own notifications
CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT
    USING (user_id = auth.uid());

-- Users can create notifications for themselves
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their own notifications
CREATE POLICY "notifications_update_policy" ON notifications FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "notifications_delete_policy" ON notifications FOR DELETE
    USING (user_id = auth.uid());

-- AUDIT LOGS POLICIES
-- Users can view audit logs from their organizations
CREATE POLICY "audit_logs_select_policy" ON audit_logs FOR SELECT
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- System can insert audit logs (handled by application)
CREATE POLICY "audit_logs_insert_policy" ON audit_logs FOR INSERT
    WITH CHECK (org_id = ANY(get_user_org_ids(auth.uid())));

-- Audit logs are read-only for users
CREATE POLICY "audit_logs_update_policy" ON audit_logs FOR UPDATE
    USING (false);

CREATE POLICY "audit_logs_delete_policy" ON audit_logs FOR DELETE
    USING (false);

-- PUBLIC LINKS POLICIES (for quote sharing)
-- Anyone can view public links (for quote sharing)
CREATE POLICY "public_links_select_policy" ON public_links FOR SELECT
    USING (true);

-- Only authenticated users can create public links
CREATE POLICY "public_links_insert_policy" ON public_links FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated users can update public links
CREATE POLICY "public_links_update_policy" ON public_links FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Only authenticated users can delete public links
CREATE POLICY "public_links_delete_policy" ON public_links FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- WEBHOOK DEDUPE POLICIES (system table)
-- Only system can access webhook dedupe
CREATE POLICY "webhook_dedupe_select_policy" ON webhook_dedupe FOR SELECT
    USING (false);

CREATE POLICY "webhook_dedupe_insert_policy" ON webhook_dedupe FOR INSERT
    WITH CHECK (false);

CREATE POLICY "webhook_dedupe_update_policy" ON webhook_dedupe FOR UPDATE
    USING (false);

CREATE POLICY "webhook_dedupe_delete_policy" ON webhook_dedupe FOR DELETE
    USING (false);
