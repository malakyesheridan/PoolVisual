// Compact Material Card Component
// Shows selected material in a compact card, click to browse

import React from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { Material } from '../../materials/registry';
import { getProxiedTextureUrl } from '../../lib/textureProxy';

interface CompactMaterialCardProps {
  category: string;
  material: Material | null;
  onBrowse: () => void;
  onClear?: () => void;
}

export function CompactMaterialCard({ 
  category, 
  material, 
  onBrowse,
  onClear 
}: CompactMaterialCardProps) {
  const categoryDisplayName = category
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const imageUrl = material?.thumbnailURL || material?.albedoURL;
  const proxiedUrl = imageUrl ? getProxiedTextureUrl(imageUrl) : null;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden hover:border-gray-400 transition-colors">
      {/* Header */}
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs font-medium text-gray-700">{categoryDisplayName}</span>
        </div>
        {material && onClear && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear?.();
            }}
            className="text-gray-400 hover:text-red-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <button
        onClick={onBrowse}
        className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        {proxiedUrl && material ? (
          <>
            <div className="w-16 h-16 rounded overflow-hidden border border-gray-200 flex-shrink-0">
              <img 
                src={proxiedUrl} 
                alt={material.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                }}
              />
              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 text-center px-1 hidden">
                {material.name}
              </div>
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {material.name}
              </div>
              {material.price && typeof material.price === 'number' && (
                <div className="text-xs text-green-600 font-medium">
                  ${material.price.toFixed(2)}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-0.5">
                Click to change
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl text-gray-300">+</span>
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm text-gray-500">No material selected</div>
              <div className="text-xs text-primary font-medium mt-0.5">
                Click to browse
              </div>
            </div>
          </>
        )}
        
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
    </div>
  );
}

