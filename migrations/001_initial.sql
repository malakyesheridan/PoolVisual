-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE org_role AS ENUM ('owner', 'estimator', 'field-tech', 'viewer');
CREATE TYPE material_category AS ENUM ('coping', 'waterline_tile', 'interior', 'paving', 'fencing');
CREATE TYPE material_unit AS ENUM ('m2', 'lm', 'each');
CREATE TYPE job_status AS ENUM ('new', 'estimating', 'sent', 'accepted', 'declined', 'scheduled', 'completed');
CREATE TYPE mask_type AS ENUM ('area', 'linear', 'waterline_band');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'declined');
CREATE TYPE quote_item_kind AS ENUM ('material', 'labor', 'adjustment');
CREATE TYPE labor_rule_type AS ENUM ('flat', 'per_m2', 'per_lm', 'tiered');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Organizations
CREATE TABLE orgs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    abn TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    brand_colors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Organization members
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES orgs(id) NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    role org_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(org_id, user_id)
);

-- Organization settings
CREATE TABLE settings (
    org_id UUID REFERENCES orgs(id) UNIQUE NOT NULL,
    currency_code TEXT DEFAULT 'AUD' NOT NULL,
    tax_rate NUMERIC(5,4) DEFAULT 0.10 NOT NULL,
    deposit_default_pct NUMERIC(5,4) DEFAULT 0.30 NOT NULL,
    validity_days INTEGER DEFAULT 30 NOT NULL,
    pdf_terms TEXT
);

-- Materials
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES orgs(id),
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    category material_category NOT NULL,
    unit material_unit NOT NULL,
    cost NUMERIC(10,2),
    price NUMERIC(10,2),
    default_wastage_pct NUMERIC(5,2),
    default_margin_pct NUMERIC(5,2),
    texture_url TEXT,
    thumbnail_url TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Labor rules
CREATE TABLE labor_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES orgs(id) NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    rule_type labor_rule_type NOT NULL,
    base_amount NUMERIC(10,2),
    rate NUMERIC(10,2),
    tiers_json JSONB,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES orgs(id) NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_email TEXT,
    address TEXT,
    status job_status DEFAULT 'new' NOT NULL,
    created_by UUID REFERENCES org_members(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Photos
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) NOT NULL,
    original_url TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    exif_json JSONB,
    calibration_pixels_per_meter NUMERIC(10,4),
    calibration_meta_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Masks
CREATE TABLE masks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID REFERENCES photos(id) NOT NULL,
    type mask_type NOT NULL,
    path_json JSONB NOT NULL,
    band_height_m NUMERIC(10,2),
    area_m2 NUMERIC(10,2),
    perimeter_m NUMERIC(10,2),
    material_id UUID REFERENCES materials(id),
    created_by UUID REFERENCES org_members(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Quotes
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) NOT NULL,
    status quote_status DEFAULT 'draft' NOT NULL,
    subtotal NUMERIC(10,2),
    gst NUMERIC(10,2),
    total NUMERIC(10,2),
    deposit_pct NUMERIC(5,4),
    pdf_url TEXT,
    public_token TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    validity_days INTEGER DEFAULT 30 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Quote items
CREATE TABLE quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES quotes(id) NOT NULL,
    kind quote_item_kind NOT NULL,
    material_id UUID REFERENCES materials(id),
    labor_rule_id UUID REFERENCES labor_rules(id),
    description TEXT NOT NULL,
    unit TEXT,
    qty NUMERIC(10,2),
    unit_price NUMERIC(10,2),
    line_total NUMERIC(10,2),
    calc_meta_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Public links
CREATE TABLE public_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES quotes(id) NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    type TEXT NOT NULL,
    payload_json JSONB,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES orgs(id) NOT NULL,
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    payload_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Webhook dedupe
CREATE TABLE webhook_dedupe (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_materials_org_id ON materials(org_id);
CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_is_active ON materials(is_active);
CREATE INDEX idx_jobs_org_id ON jobs(org_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_photos_job_id ON photos(job_id);
CREATE INDEX idx_masks_photo_id ON masks(photo_id);
CREATE INDEX idx_quotes_job_id ON quotes(job_id);
CREATE INDEX idx_quotes_public_token ON quotes(public_token);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- GIN indexes for JSONB columns
CREATE INDEX idx_materials_brand_colors ON orgs USING GIN(brand_colors);
CREATE INDEX idx_photos_exif ON photos USING GIN(exif_json);
CREATE INDEX idx_photos_calibration_meta ON photos USING GIN(calibration_meta_json);
CREATE INDEX idx_masks_path ON masks USING GIN(path_json);
CREATE INDEX idx_labor_rules_tiers ON labor_rules USING GIN(tiers_json);
CREATE INDEX idx_quote_items_calc_meta ON quote_items USING GIN(calc_meta_json);
CREATE INDEX idx_notifications_payload ON notifications USING GIN(payload_json);
CREATE INDEX idx_audit_logs_payload ON audit_logs USING GIN(payload_json);

-- Row Level Security (RLS) policies
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

-- Functions to get user's orgs (for RLS policies)
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

-- Example RLS policies (these would need to be expanded based on specific access patterns)
-- Organizations: users can only see orgs they're members of
CREATE POLICY "Users can view their orgs" ON orgs FOR SELECT
    USING (id = ANY(get_user_org_ids(auth.uid())));

-- Jobs: users can only see jobs from their orgs
CREATE POLICY "Users can view org jobs" ON jobs FOR SELECT
    USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- Insert default materials for global use
INSERT INTO materials (org_id, name, sku, category, unit, price, default_wastage_pct, default_margin_pct, is_active) VALUES
-- Coping materials
(NULL, 'Travertine Silver', 'TRV-SIL-001', 'coping', 'lm', 85.00, 8.0, 25.0, true),
(NULL, 'Granite Charcoal', 'GRN-CHR-002', 'coping', 'lm', 120.00, 5.0, 30.0, true),
(NULL, 'Porcelain Concrete', 'PRC-CON-003', 'coping', 'lm', 95.00, 10.0, 28.0, true),

-- Waterline tiles
(NULL, 'Glass Mosaic Blue 25x25', 'GLM-BLU-001', 'waterline_tile', 'm2', 160.00, 10.0, 35.0, true),
(NULL, 'Ceramic Subway White', 'CER-WHT-002', 'waterline_tile', 'm2', 85.00, 12.0, 30.0, true),
(NULL, 'Natural Stone Strip', 'NST-STR-003', 'waterline_tile', 'm2', 140.00, 8.0, 32.0, true),

-- Interior finishes
(NULL, 'Pebblecrete Quartz Blue', 'PEB-QBL-001', 'interior', 'm2', 95.00, 7.0, 40.0, true),
(NULL, 'Vinyl Liner Ocean', 'VIN-OCE-002', 'interior', 'm2', 65.00, 5.0, 35.0, true),
(NULL, 'Fiberglass Gelcoat Aqua', 'FBG-AQU-003', 'interior', 'm2', 110.00, 6.0, 38.0, true),

-- Paving
(NULL, 'Exposed Aggregate Concrete', 'EAC-STD-001', 'paving', 'm2', 110.00, 10.0, 30.0, true),
(NULL, 'Travertine Pavers', 'TRV-PAV-002', 'paving', 'm2', 180.00, 8.0, 25.0, true),
(NULL, 'Composite Decking', 'COM-DEC-003', 'paving', 'm2', 145.00, 5.0, 28.0, true),

-- Fencing
(NULL, 'Frameless Glass 12mm', 'FGL-12M-001', 'fencing', 'lm', 380.00, 5.0, 35.0, true),
(NULL, 'Aluminium Slat Charcoal', 'ALU-CHA-002', 'fencing', 'lm', 280.00, 8.0, 30.0, true),
(NULL, 'Timber Screening Treated', 'TIM-TRT-003', 'fencing', 'lm', 120.00, 12.0, 40.0, true);

-- Insert default labor rules
INSERT INTO labor_rules (org_id, category, name, rule_type, base_amount, rate, is_default) VALUES
(NULL, 'general', 'Drain & Refill Pool', 'flat', 450.00, 0, true),
(NULL, 'interior', 'Interior Surface Preparation', 'per_m2', 0, 25.00, true),
(NULL, 'coping', 'Coping Installation', 'per_lm', 0, 40.00, true),
(NULL, 'waterline_tile', 'Waterline Tile Installation', 'per_m2', 0, 65.00, true),
(NULL, 'fencing', 'Fencing Installation', 'per_lm', 0, 55.00, true);

-- Insert tiered paving labor rule
INSERT INTO labor_rules (org_id, category, name, rule_type, base_amount, tiers_json, is_default) VALUES
(NULL, 'paving', 'Paving Installation (Tiered)', 'tiered', 0, 
'[
    {"threshold": 30, "rate": 55.00},
    {"threshold": 60, "rate": 50.00},
    {"threshold": 9999, "rate": 45.00}
]'::jsonb, true);
