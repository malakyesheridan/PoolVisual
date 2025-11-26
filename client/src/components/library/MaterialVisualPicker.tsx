// Visual Material Picker Component
// Replaces dropdowns with visual material grid for better UX

import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Check, X, Search } from 'lucide-react';
import { ensureLoaded, getAll, Material } from '../../materials/registry';
import { getProxiedTextureUrl } from '../../lib/textureProxy';

interface MaterialVisualPickerProps {
  category: 'coping' | 'waterline_tile' | 'interior' | 'paving';
  selectedMaterialId?: string;
  onSelect: (materialId: string) => void;
  onClear?: () => void;
  showClearButton?: boolean;
}

export function MaterialVisualPicker({ 
  category, 
  selectedMaterialId, 
  onSelect, 
  onClear,
  showClearButton = true 
}: MaterialVisualPickerProps) {
  const [materials, setMaterials] = useState<Record<string, Material>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Load materials from registry
  useEffect(() => {
    ensureLoaded().then(() => {
      const allMaterials = getAll();
      setMaterials(allMaterials);
      setLoading(false);
    }).catch(err => {
      console.warn('[MaterialVisualPicker] failed to load materials', err);
      setLoading(false);
    });
  }, []);
  
  // Filter materials by category and search
  const categoryMaterials = Object.values(materials).filter(material => {
    const matchesCategory = material.category === category;
    const matchesSearch = !searchTerm || material.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  if (loading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} Material
        </label>
        <div className="text-sm text-gray-500 p-4 border border-dashed border-gray-300 rounded-lg text-center">
          Loading materials...
        </div>
      </div>
    );
  }
  
  if (categoryMaterials.length === 0) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} Material
        </label>
        <div className="text-sm text-gray-500 p-4 border border-dashed border-gray-300 rounded-lg text-center">
          No {category.replace('_', ' ')} materials available
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 text-xs">
          {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
        </label>
        {showClearButton && selectedMaterialId && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-red-600"
          >
            Clear
          </button>
        )}
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search..."
          className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      
      {/* Materials grid with constrained height and scrolling */}
      <div className="h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
        {categoryMaterials.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500">
            No materials found
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {categoryMaterials.map(material => {
              const imageUrl = material.thumbnailURL || material.albedoURL;
              const proxiedUrl = imageUrl ? getProxiedTextureUrl(imageUrl) : null;
              
              return (
                <button
                  key={material.id}
                  onClick={() => onSelect(material.id)}
                  className={`p-1.5 border rounded text-left transition-all hover:shadow-sm ${
                    selectedMaterialId === material.id 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Material Thumbnail */}
                  <div className="aspect-square bg-gray-100 rounded mb-1 overflow-hidden relative">
                    {proxiedUrl ? (
                      <img 
                        src={proxiedUrl} 
                        alt={material.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 px-1 text-center">
                        {material.name}
                      </div>
                    )}
                    
                    {/* Selection indicator */}
                    {selectedMaterialId === material.id && (
                      <div className="absolute top-1 right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-1.5 h-1.5 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Material Info */}
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-medium text-gray-900 line-clamp-2 leading-tight" title={material.name}>
                      {material.name}
                    </div>
                    
                    {material.price && typeof material.price === 'number' && (
                      <div className="text-[10px] font-medium text-green-600">
                        ${material.price.toFixed(2)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Selected material summary */}
      {selectedMaterialId && (
        <div className="p-1.5 bg-primary/5 border border-primary/20 rounded text-xs">
          <div className="font-medium text-primary text-[10px]">
            ✓ {categoryMaterials.find(m => m.id === selectedMaterialId)?.name}
          </div>
        </div>
      )}
    </div>
  );
}
