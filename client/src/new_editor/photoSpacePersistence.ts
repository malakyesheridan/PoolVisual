/**
 * Photo Space Persistence
 * 
 * Persists and restores photo space state (zoom/pan) per photo
 * to maintain consistent view when returning to the canvas
 */

import { PhotoSpace } from './types';

const STORAGE_PREFIX = 'poolVisual-photoSpace-';

/**
 * Save photo space state to localStorage
 */
export function savePhotoSpace(photoId: string | null | undefined, photoSpace: PhotoSpace): void {
  if (!photoId || typeof window === 'undefined') return;
  
  try {
    const key = `${STORAGE_PREFIX}${photoId}`;
    const data = {
      scale: photoSpace.scale,
      panX: photoSpace.panX,
      panY: photoSpace.panY,
      imgW: photoSpace.imgW,
      imgH: photoSpace.imgH,
      fitScale: photoSpace.fitScale, // Save fitScale for 100% zoom baseline
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
    console.log('[PhotoSpacePersistence] Saved photo space for photoId:', photoId, data);
  } catch (error) {
    console.warn('[PhotoSpacePersistence] Failed to save photo space:', error);
  }
}

/**
 * Load photo space state from localStorage
 */
export function loadPhotoSpace(photoId: string | null | undefined): Partial<PhotoSpace> | null {
  if (!photoId || typeof window === 'undefined') return null;
  
  try {
    const key = `${STORAGE_PREFIX}${photoId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    
    // Validate stored data
    if (
      typeof data.scale === 'number' && isFinite(data.scale) &&
      typeof data.panX === 'number' && isFinite(data.panX) &&
      typeof data.panY === 'number' && isFinite(data.panY) &&
      typeof data.imgW === 'number' && isFinite(data.imgW) &&
      typeof data.imgH === 'number' && isFinite(data.imgH)
    ) {
      console.log('[PhotoSpacePersistence] Loaded photo space for photoId:', photoId, data);
      return {
        scale: data.scale,
        panX: data.panX,
        panY: data.panY,
        imgW: data.imgW,
        imgH: data.imgH,
        fitScale: data.fitScale // Load fitScale if available (for backward compatibility, may be undefined)
      };
    }
  } catch (error) {
    console.warn('[PhotoSpacePersistence] Failed to load photo space:', error);
  }
  
  return null;
}

/**
 * Clear photo space state from localStorage
 */
export function clearPhotoSpace(photoId: string | null | undefined): void {
  if (!photoId || typeof window === 'undefined') return;
  
  try {
    const key = `${STORAGE_PREFIX}${photoId}`;
    localStorage.removeItem(key);
    console.log('[PhotoSpacePersistence] Cleared photo space for photoId:', photoId);
  } catch (error) {
    console.warn('[PhotoSpacePersistence] Failed to clear photo space:', error);
  }
}

/**
 * Check if stored photo space matches current image dimensions
 */
export function isPhotoSpaceValid(
  stored: Partial<PhotoSpace> | null,
  currentImgW: number,
  currentImgH: number
): boolean {
  if (!stored) return false;
  
  // If dimensions don't match, the stored state is invalid
  if (stored.imgW !== currentImgW || stored.imgH !== currentImgH) {
    console.log('[PhotoSpacePersistence] Stored dimensions mismatch:', {
      stored: `${stored.imgW}x${stored.imgH}`,
      current: `${currentImgW}x${currentImgH}`
    });
    return false;
  }
  
  return true;
}

