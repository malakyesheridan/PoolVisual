// Visual Material Picker Component
// Replaces dropdowns with visual material grid for better UX

import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Check, X } from 'lucide-react';
import { ensureLoaded, getAll, Material } from '../../materials/registry';

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
  
  // Filter materials by category
  const categoryMaterials = Object.values(materials).filter(material => material.category === category);
  
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
        <label className="block text-sm font-medium text-gray-700">
          {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} Material
        </label>
        {showClearButton && selectedMaterialId && onClear && (
          <Button
            onClick={onClear}
            variant="outline"
            size="sm"
            className="h-6 px-2"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {categoryMaterials.map(material => (
          <button
            key={material.id}
            onClick={() => onSelect(material.id)}
            className={`p-2 border rounded-lg text-left transition-all hover:shadow-sm ${
              selectedMaterialId === material.id 
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Material Thumbnail */}
            <div className="aspect-square bg-gray-100 rounded mb-2 overflow-hidden relative">
              {material.thumbnailURL ? (
                <img 
                  src={material.thumbnailURL} 
                  alt={material.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  {material.name}
                </div>
              )}
              
              {/* Selection indicator */}
              {selectedMaterialId === material.id && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            
            {/* Material Info */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-900 line-clamp-2">
                {material.name}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {material.category.replace('_', ' ')}
                </div>
                
                {material.price && (
                  <div className="text-xs font-medium text-green-600">
                    ${material.price.toFixed(2)}
                  </div>
                )}
              </div>
              
              {/* Additional info */}
              <div className="flex items-center gap-1">
                {material.finish && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {material.finish}
                  </Badge>
                )}
                {material.color && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {material.color}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      
      {/* Selected material summary */}
      {selectedMaterialId && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          <div className="font-medium text-blue-900">
            Selected: {categoryMaterials.find(m => m.id === selectedMaterialId)?.name}
          </div>
        </div>
      )}
    </div>
  );
}
