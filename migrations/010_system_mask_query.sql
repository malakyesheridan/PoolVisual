-- Migration: System function to query masks bypassing RLS
-- This allows system operations (like outbox processor) to query masks
-- without being blocked by Row Level Security policies

-- Function to get masks by photo_id (bypasses RLS for system operations)
CREATE OR REPLACE FUNCTION get_masks_by_photo_system(photo_uuid UUID)
RETURNS TABLE (
  id UUID,
  photo_id UUID,
  material_id UUID,
  calc_meta_json JSONB,
  path_json JSONB,
  type TEXT,
  depth_level INTEGER,
  elevation_m NUMERIC,
  z_index INTEGER,
  is_stepped BOOLEAN,
  created_by UUID,
  created_at TIMESTAMP
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with creator's privileges, bypasses RLS
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.photo_id,
    m.material_id,
    m.calc_meta_json,
    m.path_json,
    m.type::TEXT,
    m.depth_level,
    m.elevation_m,
    m.z_index,
    m.is_stepped,
    m.created_by,
    m.created_at
  FROM masks m
  WHERE m.photo_id = photo_uuid
  ORDER BY m.z_index ASC, m.created_at ASC;
END;
$$;

-- Grant execute permission to the database role (typically postgres or the app user)
-- This allows the application to call the function
GRANT EXECUTE ON FUNCTION get_masks_by_photo_system(UUID) TO PUBLIC;

-- Add comment explaining the function
COMMENT ON FUNCTION get_masks_by_photo_system(UUID) IS 
'System function to query masks by photo_id, bypassing RLS policies. Used by background processes like outbox processor that do not have user session context.';

