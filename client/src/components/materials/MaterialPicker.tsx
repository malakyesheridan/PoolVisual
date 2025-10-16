/**
 * Material Picker - Simplified for Final Behavior Spec
 * Auto-triggers Smart Blend when material is selected
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMaterialsStore } from '@/state/materialsStore';
import { useMaskStore } from '@/features/canvas/stores/maskStore';
import { cn } from '@/lib/utils';

interface MaterialPickerProps {
  className?: string;
}

export function MaterialPicker({ className }: MaterialPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const materials = useMaterialsStore(s => s.items ?? {});
  const selectedMaskId = useMaskStore(s => s.selectedMaskId ?? null);
  const selectedMask = selectedMaskId ? useMaskStore(s => s.masksById ?? {})[selectedMaskId] : null;
  const updateMask = useMaskStore(s => s.updateMask);

  // Filter materials by search and category
  const filteredMaterials = Object.values(materials).filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(Object.values(materials).map(m => m.category)))].filter(Boolean);

  const handleMaterialSelect = (materialId: string) => {
    if (!selectedMaskId) {
      console.warn('[MaterialPicker] No mask selected');
      return;
    }

    // Update mask with selected material
    updateMask(selectedMaskId, { materialId });
    
    console.log('[MaterialPicker] Material selected:', materialId);
  };

  const isMaterialSelected = (materialId: string) => {
    return selectedMask?.materialId === materialId;
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold mb-4">Materials</h3>
        
        {/* Search */}
        <div className="mb-4">
          <Label htmlFor="search" className="text-sm font-medium">Search</Label>
          <Input
            id="search"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Category Filter */}
        <div className="mb-4">
          <Label className="text-sm font-medium">Category</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="text-xs"
              >
                {category === 'all' ? 'All' : category}
              </Button>
            ))}
          </div>
        </div>

        {/* Selection Status */}
        {selectedMaskId ? (
          <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
            ✓ Mask selected - choose a material to apply
          </div>
        ) : (
          <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
            Select a mask first to apply materials
          </div>
        )}
      </div>

      {/* Materials List */}
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredMaterials.map(material => (
            <Button
              key={material.id}
              variant={isMaterialSelected(material.id) ? "default" : "outline"}
              className={cn(
                "h-auto p-3 flex flex-col items-center text-center",
                isMaterialSelected(material.id) && "ring-2 ring-blue-500"
              )}
              onClick={() => handleMaterialSelect(material.id)}
              disabled={!selectedMaskId}
            >
              {/* Material Preview */}
              {material.texture_url && (
                <div className="w-full h-16 mb-2 rounded border overflow-hidden">
                  <img
                    src={material.texture_url}
                    alt={material.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* Material Info */}
              <div className="text-xs">
                <div className="font-medium truncate">{material.name}</div>
                {material.sku && (
                  <div className="text-gray-500 truncate">{material.sku}</div>
                )}
                {material.physical_repeat_m && (
                  <div className="text-gray-400">
                    {material.physical_repeat_m}m repeat
                  </div>
                )}
              </div>
            </Button>
          ))}
        </div>

        {filteredMaterials.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No materials found
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
