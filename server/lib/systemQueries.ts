/**
 * System Queries - Functions that bypass RLS for system operations
 * These are used by background processes (like outbox processor) that
 * don't have user session context but need to access data.
 */

import { executeQuery } from './dbHelpers.js';

/**
 * Get masks by photo ID, bypassing RLS policies
 * Uses a SECURITY DEFINER function to run with elevated privileges
 * 
 * @param photoId - The photo ID to query masks for
 * @returns Array of masks matching the photo ID
 */
export async function getMasksByPhotoSystem(photoId: string): Promise<any[]> {
  try {
    const result = await executeQuery(
      `SELECT * FROM system_get_masks_by_photo($1)`,
      [photoId]
    );
    
    // Convert database column names to camelCase to match expected format
    return result.map((row: any) => ({
      id: row.id,
      photoId: row.photo_id,
      materialId: row.material_id,
      calcMetaJson: row.calc_meta_json,
      pathJson: row.path_json,
      type: row.type || 'area',
      depthLevel: row.depth_level || 0,
      elevationM: row.elevation_m?.toString() || '0',
      zIndex: row.z_index || 0,
      isStepped: row.is_stepped || false,
      createdBy: row.created_by || '',
      createdAt: row.created_at || new Date()
    }));
  } catch (error: any) {
    // Check if the error is because the function doesn't exist
    if (error.message?.includes('does not exist') || 
        error.message?.includes('function get_masks_by_photo_system') ||
        error.code === '42883') {
      console.error(`[SystemQueries] ❌ CRITICAL: Function system_get_masks_by_photo() does not exist in database!`);
      console.error(`[SystemQueries] ❌ This means the migration has not been run in production.`);
      console.error(`[SystemQueries] ❌ Run: npm run db:migrate (or psql $DATABASE_URL -f migrations/025_fix_rls_for_session_auth.sql)`);
      console.error(`[SystemQueries] Error details:`, {
        message: error.message,
        code: error.code,
        photoId: photoId
      });
    } else {
      console.error(`[SystemQueries] Error querying masks for photo ${photoId}:`, error);
    }
    throw error;
  }
}

