-- Migration 005: Performance Indexes
-- Adds performance indexes identified in the production readiness audit

-- Add composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_jobs_org_id_status ON jobs(org_id, status);
CREATE INDEX CONCURRENTLY idx_quotes_job_id_status ON quotes(job_id, status);
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_masks_material_id ON masks(material_id);

-- Add indexes for audit and notification queries
CREATE INDEX CONCURRENTLY idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX CONCURRENTLY idx_audit_logs_action ON audit_logs(action);
CREATE INDEX CONCURRENTLY idx_notifications_type ON notifications(type);
CREATE INDEX CONCURRENTLY idx_notifications_created_at ON notifications(created_at DESC);

-- Add indexes for material and labor rule queries
CREATE INDEX CONCURRENTLY idx_materials_sku ON materials(sku);
CREATE INDEX CONCURRENTLY idx_materials_price ON materials(price);
CREATE INDEX CONCURRENTLY idx_labor_rules_category ON labor_rules(category);
CREATE INDEX CONCURRENTLY idx_labor_rules_is_default ON labor_rules(is_default);

-- Add indexes for quote item queries
CREATE INDEX CONCURRENTLY idx_quote_items_material_id ON quote_items(material_id);
CREATE INDEX CONCURRENTLY idx_quote_items_labor_rule_id ON quote_items(labor_rule_id);
CREATE INDEX CONCURRENTLY idx_quote_items_kind ON quote_items(kind);

-- Add indexes for photo and mask queries
CREATE INDEX CONCURRENTLY idx_photos_width_height ON photos(width, height);
CREATE INDEX CONCURRENTLY idx_photos_calibration_pixels_per_meter ON photos(calibration_pixels_per_meter);
CREATE INDEX CONCURRENTLY idx_masks_type ON masks(type);
CREATE INDEX CONCURRENTLY idx_masks_area_m2 ON masks(area_m2);

-- Add partial indexes for active records
CREATE INDEX CONCURRENTLY idx_materials_active ON materials(id) WHERE is_active = true;
CREATE INDEX CONCURRENTLY idx_labor_rules_default ON labor_rules(id) WHERE is_default = true;

-- Add indexes for date-based queries
CREATE INDEX CONCURRENTLY idx_jobs_created_at_desc ON jobs(created_at DESC);
CREATE INDEX CONCURRENTLY idx_quotes_created_at_desc ON quotes(created_at DESC);
CREATE INDEX CONCURRENTLY idx_quotes_updated_at_desc ON quotes(updated_at DESC);

-- Add indexes for public link queries
CREATE INDEX CONCURRENTLY idx_public_links_expires_at ON public_links(expires_at);
CREATE INDEX CONCURRENTLY idx_public_links_quote_id ON public_links(quote_id);

-- Add indexes for webhook deduplication
CREATE INDEX CONCURRENTLY idx_webhook_dedupe_created_at ON webhook_dedupe(created_at);

-- Add comments for documentation
COMMENT ON INDEX idx_jobs_org_id_status IS 'Composite index for filtering jobs by organization and status';
COMMENT ON INDEX idx_quotes_job_id_status IS 'Composite index for filtering quotes by job and status';
COMMENT ON INDEX idx_users_email IS 'Index for fast email lookups during authentication';
COMMENT ON INDEX idx_masks_material_id IS 'Index for filtering masks by material';
COMMENT ON INDEX idx_materials_active IS 'Partial index for active materials only';
COMMENT ON INDEX idx_labor_rules_default IS 'Partial index for default labor rules only';

-- Create function to analyze index usage
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname,
        s.tablename,
        s.indexname,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch
    FROM pg_stat_user_indexes s
    WHERE s.schemaname = 'public'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to identify unused indexes
CREATE OR REPLACE FUNCTION find_unused_indexes()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    indexdef TEXT,
    idx_scan BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname,
        s.tablename,
        s.indexname,
        i.indexdef,
        s.idx_scan
    FROM pg_stat_user_indexes s
    JOIN pg_indexes i ON s.indexname = i.indexname
    WHERE s.schemaname = 'public'
    AND s.idx_scan = 0
    AND s.indexname NOT LIKE '%_pkey'
    ORDER BY s.tablename, s.indexname;
END;
$$ LANGUAGE plpgsql;

-- Add audit log entry for this migration
INSERT INTO audit_logs (org_id, user_id, action, entity, payload_json, created_at)
VALUES (
    NULL, -- System migration
    NULL, -- System migration
    'SCHEMA_MIGRATION',
    'performance_indexes',
    '{"migration": "005_performance_indexes", "description": "Added performance indexes identified in audit"}'::jsonb,
    NOW()
);
