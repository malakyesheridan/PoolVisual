// Variants Panel for Canvas Editor
// Displays all AI enhancement variants for the current photo and allows deletion

import React, { useState, useEffect } from 'react';
import { useEditorStore } from './store';
import { useRoute } from 'wouter';
import { 
  Trash2, 
  Image as ImageIcon, 
  Loader2,
  Sparkles,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { toast } from '../lib/toast';

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
  
  // Get photoId from URL params or context
  const [, jobParams] = useRoute('/jobs/:jobId/photo/:photoId/edit');
  const [, jobParamsCanvas] = useRoute('/jobs/:jobId/photo/:photoId/edit-canvas');
  const effectivePhotoId = jobParams?.photoId || jobParamsCanvas?.photoId || jobContext?.photoId;
  
  // Load variants for the current photo
  useEffect(() => {
    if (!effectivePhotoId) {
      setLoading(false);
      return;
    }
    
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
        setVariants(data.variants || []);
      } catch (error: any) {
        console.error('[VariantsPanel] Failed to load variants:', error);
        toast.error('Failed to load variants', { description: error.message });
      } finally {
        setLoading(false);
      }
    };
    
    loadVariants();
  }, [effectivePhotoId]);
  
  // Handle variant deletion
  const handleDelete = async (variantId: string) => {
    if (!confirm('Are you sure you want to delete this variant? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeleting(variantId);
      const res = await fetch(`/api/ai/enhancement/variants/${variantId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      // Remove from local state
      setVariants(prev => prev.filter(v => v.id !== variantId));
      
      // If this variant is active, switch to original
      if (activeVariantId === variantId) {
        dispatch({ type: 'SET_ACTIVE_VARIANT', payload: 'original' });
      }
      
      // Remove from store variants
      dispatch({ type: 'REMOVE_VARIANT', payload: variantId });
      
      toast.success('Variant deleted', { description: 'The variant has been removed.' });
    } catch (error: any) {
      console.error('[VariantsPanel] Failed to delete variant:', error);
      toast.error('Failed to delete variant', { description: error.message });
    } finally {
      setDeleting(null);
    }
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
          label: variant.mode 
            ? `${variant.mode.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} ${variant.rank + 1}`
            : `AI Enhanced ${variant.rank + 1}`,
          imageUrl: variant.url
        }
      });
      dispatch({ type: 'SET_ACTIVE_VARIANT', payload: variant.id });
    }
    
    toast.success('Variant applied', { description: 'The variant is now active on the canvas.' });
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
  
  // Get mode label
  const getModeLabel = (mode?: string) => {
    if (!mode) return 'Enhanced';
    return mode
      .replace('_', ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
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
                  alt={`Variant ${variant.rank + 1}`}
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
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {getModeLabel(variant.mode)} {variant.rank + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={12} />
                      <span>{formatDate(variant.created_at)}</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleSelectVariant(variant)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      disabled={isDeleting}
                    >
                      {isActive ? 'Active' : 'Apply'}
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
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

