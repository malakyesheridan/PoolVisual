/**
 * Variant Persistence
 * 
 * Persists and restores variant state (variants list and activeVariantId) per photo
 * Similar to photoSpacePersistence but for variant management
 */

import { CanvasVariant } from './types';

interface VariantState {
  variants: CanvasVariant[];
  activeVariantId: string | null;
  timestamp: number;
}

const STORAGE_PREFIX = 'poolVisual-variants-';

/**
 * Save variant state to localStorage
 */
export function saveVariantState(photoId: string | null | undefined, state: { variants: CanvasVariant[]; activeVariantId: string | null }): void {
  if (!photoId || typeof window === 'undefined') return;
  
  try {
    const key = `${STORAGE_PREFIX}${photoId}`;
    const data: VariantState = {
      variants: state.variants,
      activeVariantId: state.activeVariantId,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
    console.log('[VariantPersistence] Saved variant state for photoId:', photoId, {
      variantsCount: state.variants.length,
      activeVariantId: state.activeVariantId
    });
  } catch (error) {
    console.warn('[VariantPersistence] Failed to save variant state:', error);
  }
}

/**
 * Load variant state from localStorage
 */
export function loadVariantState(photoId: string | null | undefined): { variants: CanvasVariant[]; activeVariantId: string | null } | null {
  if (!photoId || typeof window === 'undefined') return null;
  
  try {
    const key = `${STORAGE_PREFIX}${photoId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const data: VariantState = JSON.parse(stored);
    
    // Validate data structure
    if (!data.variants || !Array.isArray(data.variants)) {
      console.warn('[VariantPersistence] Invalid variant state structure');
      return null;
    }
    
    // Validate variants have required fields
    const validVariants = data.variants.filter(v => v.id && v.imageUrl);
    if (validVariants.length === 0) {
      console.warn('[VariantPersistence] No valid variants found in stored state');
      return null;
    }
    
    // Validate activeVariantId exists in variants
    const activeVariantId = data.activeVariantId && validVariants.some(v => v.id === data.activeVariantId)
      ? data.activeVariantId
      : validVariants[0]?.id || null;
    
    console.log('[VariantPersistence] Loaded variant state for photoId:', photoId, {
      variantsCount: validVariants.length,
      activeVariantId
    });
    
    return {
      variants: validVariants,
      activeVariantId
    };
  } catch (error) {
    console.warn('[VariantPersistence] Failed to load variant state:', error);
    return null;
  }
}

/**
 * Load and validate variant state with URL accessibility check
 * HIGH PRIORITY FIX: Validates URLs are accessible before restoring
 */
export async function loadAndValidateVariantState(
  photoId: string | null | undefined
): Promise<{ variants: CanvasVariant[]; activeVariantId: string | null } | null> {
  const persisted = loadVariantState(photoId);
  if (!persisted) return null;
  
  // Validate URLs are accessible
  const { checkImageAccessible } = await import('../lib/imagePreloader');
  const validatedVariants = [];
  
  for (const variant of persisted.variants) {
    if (variant.id === 'original') {
      validatedVariants.push(variant); // Original always valid
      continue;
    }
    
    const isAccessible = await checkImageAccessible(variant.imageUrl, 5000);
    if (isAccessible) {
      validatedVariants.push(variant);
    } else {
      console.warn('[VariantPersistence] Variant URL not accessible:', variant.id, variant.imageUrl);
    }
  }
  
  if (validatedVariants.length === 0) return null;
  
  // Ensure activeVariantId is valid
  const activeVariantId = validatedVariants.some(v => v.id === persisted.activeVariantId)
    ? persisted.activeVariantId
    : validatedVariants[0]?.id || null;
  
  // Update persisted state if any variants were removed
  if (validatedVariants.length !== persisted.variants.length) {
    saveVariantState(photoId, {
      variants: validatedVariants,
      activeVariantId
    });
  }
  
  return { variants: validatedVariants, activeVariantId };
}

/**
 * Validate persisted variants against server
 * HIGH PRIORITY FIX: Removes stale variants that don't exist on server
 */
export async function validatePersistedVariants(
  photoId: string | null | undefined
): Promise<{ variants: CanvasVariant[]; activeVariantId: string | null } | null> {
  const persisted = loadVariantState(photoId);
  if (!persisted) return null;
  
  try {
    // Fetch variants from server
    const res = await fetch(`/api/ai/enhancement/photo/${photoId}/variants`, {
      credentials: 'include'
    });
    
    if (!res.ok) {
      console.warn('[VariantPersistence] Failed to fetch server variants, using persisted only');
      return persisted;
    }
    
    const serverData = await res.json();
    const serverVariants = serverData.variants || [];
    const serverVariantIds = new Set(serverVariants.map((v: any) => v.id));
    
    // Filter out variants that don't exist on server
    const validVariants = persisted.variants.filter(v => 
      v.id === 'original' || serverVariantIds.has(v.id)
    );
    
  // Update persisted state if any variants were removed
    if (validVariants.length !== persisted.variants.length) {
      const activeVariantId = validVariants.some(v => v.id === persisted.activeVariantId)
        ? persisted.activeVariantId
        : validVariants[0]?.id || null;
      
      saveVariantState(photoId, {
        variants: validVariants,
        activeVariantId
      });
      
      return { variants: validVariants, activeVariantId };
    }
    
    return persisted;
  } catch (error) {
    console.warn('[VariantPersistence] Error validating against server, using persisted only:', error);
    return persisted;
  }
}

/**
 * Clear variant state from localStorage
 */
export function clearVariantState(photoId: string | null | undefined): void {
  if (!photoId || typeof window === 'undefined') return;
  
  try {
    const key = `${STORAGE_PREFIX}${photoId}`;
    localStorage.removeItem(key);
    console.log('[VariantPersistence] Cleared variant state for photoId:', photoId);
  } catch (error) {
    console.warn('[VariantPersistence] Failed to clear variant state:', error);
  }
}

