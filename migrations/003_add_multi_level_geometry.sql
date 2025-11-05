-- Add multi-level geometry fields to masks table
-- This migration adds support for stepped levels and depth visualization

-- Add new columns to masks table
ALTER TABLE masks 
ADD COLUMN depth_level INTEGER DEFAULT 0,
ADD COLUMN elevation_m NUMERIC(10,2) DEFAULT 0,
ADD COLUMN z_index INTEGER DEFAULT 0,
ADD COLUMN is_stepped BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN masks.depth_level IS 'Depth level: 0=surface, 1=mid-level, 2=deep';
COMMENT ON COLUMN masks.elevation_m IS 'Elevation in meters from reference point';
COMMENT ON COLUMN masks.z_index IS 'Rendering order for z-buffer (shallow to deep)';
COMMENT ON COLUMN masks.is_stepped IS 'Whether this mask represents stepped geometry';

-- Create index on z_index for efficient rendering order queries
CREATE INDEX idx_masks_z_index ON masks(z_index);

-- Create index on depth_level for depth-based queries
CREATE INDEX idx_masks_depth_level ON masks(depth_level);
