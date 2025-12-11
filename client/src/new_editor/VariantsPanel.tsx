// Variants Panel for Canvas Editor
// Displays all AI enhancement variants for the current photo and allows deletion

import React, { useState, useEffect, useMemo } from 'react';
import { useEditorStore } from './store';
import { useRoute } from 'wouter';
import { useIsTrades } from '../hooks/useIsTrades';
import { 
  Trash2, 
  Image as ImageIcon, 
  Loader2,
  Sparkles,
  Calendar,
  AlertCircle,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { toast } from '../lib/toast';
import { apiClient } from '../lib/api-client';

interface Variant {
  id: string;
  url: string;
  rank: number;
  created_at: string;
  job_id: string;
  job_created_at: string;
  mode?: 'add_pool' | 'add_decoration' | 'blend_materials';
}

export function VariantsPanel() {
  const { dispatch, variants: storeVariants, activeVariantId, jobContext } = useEditorStore();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const isTrades = useIsTrades();
  
  // Get jobId and photoId from context or URL params
  const [, jobParams] = useRoute('/jobs/:jobId/photo/:photoId/edit');
  const [, jobParamsCanvas] = useRoute('/jobs/:jobId/photo/:photoId/edit-canvas');
  const effectiveJobId = jobParams?.jobId || jobParamsCanvas?.jobId || jobContext?.jobId;
  const effectivePhotoId = jobParams?.photoId || jobParamsCanvas?.photoId || jobContext?.photoId;
  
  const [customNames, setCustomNames] = useState<Record<string, string>>(() => {
    // Load custom names from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('poolVisual-variantNames');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  
  // Track if we've already loaded variants for this photo to prevent resetting active variant
  // Use localStorage to persist across component remounts (e.g., when sidebar opens/closes)
  const getLoadedPhotoId = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('poolVisual-loadedPhotoId');
  };
  
  const setLoadedPhotoId = (photoId: string | null) => {
    if (typeof window === 'undefined') return;
    if (photoId) {
      localStorage.setItem('poolVisual-loadedPhotoId', photoId);
    } else {
      localStorage.removeItem('poolVisual-loadedPhotoId');
    }
  };
  
  // Load variants for the current photo
  useEffect(() => {
    if (!effectivePhotoId) {
      setLoading(false);
      return;
    }
    
    // CRITICAL FIX: Only auto-set most recent variant on FIRST load for this photo
    // Use localStorage to persist across component remounts (sidebar open/close)
    const previouslyLoadedPhotoId = getLoadedPhotoId();
    const isFirstLoad = previouslyLoadedPhotoId !== effectivePhotoId;
    
    const loadVariants = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/ai/enhancement/photo/${effectivePhotoId}/variants`, {
          credentials: 'include'
        });
        
        if (!res.ok) {
          throw new Error(await res.text());
        }
        
        const data = await res.json();
        // Sort variants by creation date (oldest first) to ensure consistent numbering
        const sortedVariants = (data.variants || []).sort((a: Variant, b: Variant) => {
          const dateA = new Date(a.created_at || a.job_created_at || 0).getTime();
          const dateB = new Date(b.created_at || b.job_created_at || 0).getTime();
          if (dateA !== dateB) return dateA - dateB;
          // If same date, sort by rank
          return (a.rank || 0) - (b.rank || 0);
        });
        setVariants(sortedVariants);
        
        // Auto-apply all variants to canvas when loaded
        // Apply them in order (oldest first) so the newest is active
        const currentStoreVariants = useEditorStore.getState().variants;
        
        for (const variant of sortedVariants) {
          const existingVariant = currentStoreVariants.find(v => v.id === variant.id);
          if (!existingVariant) {
            // Use the same naming function for consistency
            const displayName = getVariantDisplayName(variant, sortedVariants);
            
            // Add to store
            dispatch({
              type: 'ADD_VARIANT',
              payload: {
                id: variant.id,
                label: displayName,
                imageUrl: variant.url
              }
            });
          }
        }
        
        // CRITICAL FIX: Only set the most recent variant as active on FIRST load
        // This prevents resetting the active variant when sidebar opens/closes
        // Also check that we're not overwriting an existing non-original variant
        if (isFirstLoad && sortedVariants.length > 0) {
          const currentState = useEditorStore.getState();
          const currentActiveId = currentState.activeVariantId;
          
          // Only change active variant if:
          // 1. No variant is currently active, OR
          // 2. The original is active, OR
          // 3. The currently active variant doesn't exist in the loaded variants (was deleted)
          const activeVariantExists = currentActiveId && 
            (currentActiveId === 'original' || sortedVariants.some(v => v.id === currentActiveId));
          
          if (!currentActiveId || currentActiveId === 'original' || !activeVariantExists) {
            const mostRecentVariant = sortedVariants[sortedVariants.length - 1];
            console.log('[VariantsPanel] Setting most recent variant as active on first load:', mostRecentVariant.id);
            dispatch({ type: 'SET_ACTIVE_VARIANT', payload: mostRecentVariant.id });
          } else {
            console.log('[VariantsPanel] Preserving existing active variant:', currentActiveId);
          }
        } else {
          console.log('[VariantsPanel] Skipping variant activation (not first load)');
        }
        
        // Mark this photo as loaded (persist to localStorage)
        setLoadedPhotoId(effectivePhotoId);
      } catch (error: any) {
        console.error('[VariantsPanel] Failed to load variants:', error);
        toast.error('Failed to load variants', { description: error.message });
      } finally {
        setLoading(false);
      }
    };
    
    loadVariants();
  }, [effectivePhotoId, dispatch, customNames]);
  
  // Handle variant deletion
  const handleDelete = async (variantId: string) => {
    console.log('[VariantsPanel] Delete requested for variant:', variantId);
    
    // Check if variant exists in the panel (already loaded from API)
    const variant = variants.find(v => v.id === variantId);
    if (!variant) {
      console.warn('[VariantsPanel] Variant not found in panel:', variantId);
      toast.error('Variant not found', {
        description: 'This variant may have already been deleted.'
      });
      return;
    }
    
    // Get current store state
    const currentState = useEditorStore.getState();
    const storeVariant = storeVariants.find(v => v.id === variantId);
    
    console.log('[VariantsPanel] Deletion check:', {
      variantId,
      loadingVariantId: currentState.loadingVariantId,
      isCurrentlyLoading: currentState.loadingVariantId === variantId,
      storeVariantLoadingState: storeVariant?.loadingState,
      storeVariantLoadedAt: storeVariant?.loadedAt,
      isActive: activeVariantId === variantId
    });
    
    // ONLY block deletion if the variant is actively being loaded RIGHT NOW
    // This is the only reliable check - if loadingVariantId matches, it's currently loading
    if (currentState.loadingVariantId === variantId) {
      console.warn('[VariantsPanel] Blocking deletion - variant is currently loading');
      toast.warning('Cannot delete loading variant', {
        description: 'Please wait for the variant to finish loading on the canvas before deleting it.'
      });
      return;
    }
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this variant? This action cannot be undone.')) {
      console.log('[VariantsPanel] Deletion cancelled by user');
      return;
    }
    
    try {
      console.log('[VariantsPanel] Starting deletion for variant:', variantId);
      setDeleting(variantId);
      
      // Call delete endpoint
      const res = await fetch(`/api/ai/enhancement/variants/${variantId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('[VariantsPanel] Delete response:', {
        status: res.status,
        ok: res.ok,
        statusText: res.statusText
      });
      
      if (!res.ok) {
        // Try to parse error as JSON first
        let errorMessage = 'Failed to delete variant';
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
          console.error('[VariantsPanel] Delete error (JSON):', errorData);
        } catch {
          // If JSON parsing fails, try text
          const errorText = await res.text();
          errorMessage = errorText || errorMessage;
          console.error('[VariantsPanel] Delete error (text):', errorText);
        }
        throw new Error(errorMessage);
      }
      
      // Parse response
      const data = await res.json().catch(() => ({ ok: true }));
      console.log('[VariantsPanel] Delete successful, response:', data);
      
      // Update UI state BEFORE removing from store to avoid race conditions
      // Remove from local panel state first
      setVariants(prev => {
        const filtered = prev.filter(v => v.id !== variantId);
        console.log('[VariantsPanel] Removed from local state. Remaining variants:', filtered.length);
        return filtered;
      });
      
      // If this variant is active, switch to original BEFORE removing from store
      if (activeVariantId === variantId) {
        console.log('[VariantsPanel] Switching to original variant (deleted variant was active)');
        dispatch({ type: 'SET_ACTIVE_VARIANT', payload: 'original' });
      }
      
      // Remove from store variants (this will also update persistence)
      console.log('[VariantsPanel] Removing from store');
      dispatch({ type: 'REMOVE_VARIANT', payload: variantId });
      
      console.log('[VariantsPanel] Variant deletion complete');
      toast.success('Variant deleted', { description: 'The variant has been removed.' });
    } catch (error: any) {
      console.error('[VariantsPanel] Failed to delete variant:', error);
      console.error('[VariantsPanel] Error details:', {
        message: error.message,
        stack: error.stack,
        variantId
      });
      toast.error('Failed to delete variant', { 
        description: error.message || 'An unexpected error occurred while deleting the variant.' 
      });
    } finally {
      setDeleting(null);
    }
  };
  
  // Get sequential number for variant (1-based index in sorted list)
  const getVariantNumber = (variant: Variant) => {
    return variants.findIndex(v => v.id === variant.id) + 1;
  };

  // Get display name for variant (custom name or default)
  const getVariantDisplayName = (variant: Variant, variantsList: Variant[] = variants) => {
    if (customNames[variant.id]) {
      return customNames[variant.id];
    }
    // Count variants of the same type for sequential numbering
    // Sort by creation date to ensure consistent numbering
    const sameTypeVariants = variantsList
      .filter(v => v.mode === variant.mode && v.mode)
      .sort((a, b) => {
        const dateA = new Date(a.created_at || a.job_created_at || 0).getTime();
        const dateB = new Date(b.created_at || b.job_created_at || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return (a.rank || 0) - (b.rank || 0);
      });
    const number = sameTypeVariants.findIndex(v => v.id === variant.id) + 1;
    if (variant.mode) {
      return `AI – ${getModeLabel(variant.mode)} ${number}`;
    }
    // For variants without mode, count all variants without mode
    const noModeVariants = variantsList
      .filter(v => !v.mode)
      .sort((a, b) => {
        const dateA = new Date(a.created_at || a.job_created_at || 0).getTime();
        const dateB = new Date(b.created_at || b.job_created_at || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return (a.rank || 0) - (b.rank || 0);
      });
    const noModeNumber = noModeVariants.findIndex(v => v.id === variant.id) + 1;
    return `AI – Enhanced ${noModeNumber}`;
  };

  // Handle variant selection (apply to canvas)
  const handleSelectVariant = (variant: Variant) => {
    // Check if variant already exists in store
    const existingVariant = storeVariants.find(v => v.id === variant.id);
    
    if (existingVariant) {
      // Just switch to it
      dispatch({ type: 'SET_ACTIVE_VARIANT', payload: variant.id });
    } else {
      // Add to store and activate
      dispatch({
        type: 'ADD_VARIANT',
        payload: {
          id: variant.id,
          label: getVariantDisplayName(variant),
          imageUrl: variant.url
        }
      });
      dispatch({ type: 'SET_ACTIVE_VARIANT', payload: variant.id });
    }
    
    toast.success('Variant applied', { description: 'The variant is now active on the canvas.' });
  };

  // Handle rename start
  const handleStartRename = (variant: Variant) => {
    setEditingVariantId(variant.id);
    setEditingName(getVariantDisplayName(variant));
  };

  // Handle rename save
  const handleSaveRename = (variantId: string) => {
    if (editingName.trim()) {
      const newCustomNames = { ...customNames, [variantId]: editingName.trim() };
      setCustomNames(newCustomNames);
      localStorage.setItem('poolVisual-variantNames', JSON.stringify(newCustomNames));
      
      // Update store variant label if it exists
      const storeVariant = storeVariants.find(v => v.id === variantId);
      if (storeVariant) {
        dispatch({
          type: 'UPDATE_VARIANT',
          payload: {
            id: variantId,
            label: editingName.trim()
          }
        });
      }
      
      toast.success('Variant renamed', { description: 'The variant name has been updated.' });
    }
    setEditingVariantId(null);
    setEditingName('');
  };

  // Handle rename cancel
  const handleCancelRename = () => {
    setEditingVariantId(null);
    setEditingName('');
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };
  
  // Get mode label for display
  const getModeLabel = (mode?: string) => {
    if (!mode) return 'Enhanced';
    const labels: Record<string, string> = {
      'image_enhancement': 'Image Enhancement',
      'add_decoration': 'Add Decoration',
      'blend_materials': 'Blend Material',
      'clutter_removal': 'Clutter & Debris Removal',
      'before_after': 'Before & After',
      'stage_room': 'Virtual Staging',
      'item_removal': 'Item Removal',
      'renovation': 'Renovation',
      'day_to_dusk': 'Day to Dusk',
    };
    return labels[mode] || mode.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  if (!effectivePhotoId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertCircle size={48} className="mb-4 opacity-50" />
        <p className="text-sm">No photo selected</p>
        <p className="text-xs mt-2">Open a photo to view its variants</p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-gray-500">Loading variants...</p>
      </div>
    );
  }
  
  if (variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Sparkles size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-medium">No variants yet</p>
        <p className="text-xs mt-2 text-center px-4">
          Create an enhancement job to generate variants for this photo
        </p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header - Fixed */}
      <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Variants</h3>
            <p className="text-xs text-gray-500 mt-1">
              {variants.length} {variants.length === 1 ? 'variant' : 'variants'} for this photo
            </p>
          </div>
        </div>
      </div>
      
      {/* Variants List - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0 overscroll-contain">
        {variants.map((variant) => {
          const isActive = activeVariantId === variant.id;
          const isDeleting = deleting === variant.id;
          const isEditing = editingVariantId === variant.id;
          const displayName = getVariantDisplayName(variant);
          
          return (
            <div
              key={variant.id}
              data-variant-id={variant.id}
              className={`group relative rounded-lg border-2 transition-all ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Variant Image */}
              <div className="relative aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                <img
                  src={variant.url}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="sans-serif" font-size="14"%3EFailed to load%3C/text%3E%3C/svg%3E';
                  }}
                />
                {isActive && (
                  <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded-full font-medium">
                    Active
                  </div>
                )}
              </div>
              
              {/* Variant Info */}
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles size={14} className="text-primary flex-shrink-0" />
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveRename(variant.id);
                              } else if (e.key === 'Escape') {
                                handleCancelRename();
                              }
                            }}
                            className="flex-1 text-sm font-medium text-gray-900 border border-primary rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(variant.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="p-1 text-gray-400 hover:bg-gray-50 rounded"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {displayName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={12} />
                      <span>{formatDate(variant.created_at)}</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 ml-2">
                      {isActive && (
                        <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-white">
                          Active
                        </span>
                      )}
                      <button
                        onClick={() => handleStartRename(variant)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        disabled={isDeleting}
                        title="Rename variant"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(variant.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        disabled={isDeleting}
                        title="Delete variant"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Helper text for trades mode */}
      {isTrades && variants.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-600">
            Use your selected variant when exporting images for quotes and reports.
          </p>
        </div>
      )}
    </div>
  );
}

