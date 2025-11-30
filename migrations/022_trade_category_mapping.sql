-- Migration 022: Trade Category Mapping
-- Creates trade_category_mapping table to map material categories to industry-specific labels
-- This allows the same enum values to have different display labels per industry
-- while maintaining backward compatibility with existing material_category enum

-- Create trade_category_mapping table
CREATE TABLE IF NOT EXISTS trade_category_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL,
  category_key TEXT NOT NULL, -- Maps to material_category enum value
  category_label TEXT NOT NULL, -- Display label for this industry
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(industry, category_key)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_trade_category_industry ON trade_category_mapping(industry);
CREATE INDEX IF NOT EXISTS idx_trade_category_active ON trade_category_mapping(is_active);

-- Insert pool categories (existing enum values with original labels)
INSERT INTO trade_category_mapping (industry, category_key, category_label, display_order) VALUES
('pool', 'coping', 'Coping', 1),
('pool', 'waterline_tile', 'Waterline Tile', 2),
('pool', 'interior', 'Interior Finish', 3),
('pool', 'paving', 'Paving', 4),
('pool', 'fencing', 'Fencing', 5)
ON CONFLICT (industry, category_key) DO NOTHING;

-- Insert landscaping categories (reuse existing enum values with different labels)
INSERT INTO trade_category_mapping (industry, category_key, category_label, display_order) VALUES
('landscaping', 'paving', 'Paving', 1),
('landscaping', 'fencing', 'Fencing', 2),
('landscaping', 'interior', 'Turf & Plants', 3),
('landscaping', 'coping', 'Edging', 4),
('landscaping', 'waterline_tile', 'Lighting', 5)
ON CONFLICT (industry, category_key) DO NOTHING;

-- Insert building categories (reuse existing enum values with different labels)
INSERT INTO trade_category_mapping (industry, category_key, category_label, display_order) VALUES
('building', 'paving', 'Flooring', 1),
('building', 'interior', 'Tiles', 2),
('building', 'coping', 'Countertops', 3),
('building', 'waterline_tile', 'Paint', 4),
('building', 'fencing', 'Cabinetry', 5)
ON CONFLICT (industry, category_key) DO NOTHING;

-- Insert electrical categories (reuse existing enum values with different labels)
INSERT INTO trade_category_mapping (industry, category_key, category_label, display_order) VALUES
('electrical', 'paving', 'Wiring', 1),
('electrical', 'interior', 'Fixtures', 2),
('electrical', 'coping', 'Outlets', 3),
('electrical', 'waterline_tile', 'Lighting', 4),
('electrical', 'fencing', 'Panels', 5)
ON CONFLICT (industry, category_key) DO NOTHING;

-- Insert plumbing categories (reuse existing enum values with different labels)
INSERT INTO trade_category_mapping (industry, category_key, category_label, display_order) VALUES
('plumbing', 'paving', 'Piping', 1),
('plumbing', 'interior', 'Fixtures', 2),
('plumbing', 'coping', 'Fittings', 3),
('plumbing', 'waterline_tile', 'Valves', 4),
('plumbing', 'fencing', 'Accessories', 5)
ON CONFLICT (industry, category_key) DO NOTHING;

-- Insert real estate categories (enhancements, not materials - reuse enum values)
INSERT INTO trade_category_mapping (industry, category_key, category_label, display_order) VALUES
('real_estate', 'interior', 'Staging', 1),
('real_estate', 'paving', 'Declutter', 2),
('real_estate', 'coping', 'Lighting', 3),
('real_estate', 'waterline_tile', 'Sky Replacement', 4),
('real_estate', 'fencing', 'Enhancements', 5)
ON CONFLICT (industry, category_key) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE trade_category_mapping IS 'Maps material_category enum values to industry-specific display labels';
COMMENT ON COLUMN trade_category_mapping.industry IS 'Industry type: pool, landscaping, building, electrical, plumbing, real_estate';
COMMENT ON COLUMN trade_category_mapping.category_key IS 'Material category enum value (coping, waterline_tile, interior, paving, fencing)';
COMMENT ON COLUMN trade_category_mapping.category_label IS 'Display label for this category in this industry';

