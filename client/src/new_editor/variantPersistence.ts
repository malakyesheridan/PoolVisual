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

