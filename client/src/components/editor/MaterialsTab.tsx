/**
 * Materials Tab Component
 * Provides material selection and attachment functionality
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Info } from 'lucide-react';
import { Material } from '@shared/schema';
import { useEditorStore } from '@/stores/editorSlice';
import { useEditorStore as useNewEditorStore } from '@/state/editorStore';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const MATERIAL_CATEGORIES = [
  { id: 'coping', label: 'Coping', description: 'Pool edge materials' },
  { id: 'waterline_tile', label: 'Waterline Tiles', description: 'Waterline finishing' },
  { id: 'interior', label: 'Interior Finish', description: 'Pool interior surfaces' },
  { id: 'paving', label: 'Paving', description: 'Surrounding surfaces' },
  { id: 'fencing', label: 'Fencing', description: 'Safety barriers' }
] as const;

interface MaterialCardProps {
  material: Material;
  isSelected: boolean;
  onSelect: () => void;
  isAttaching: boolean;
}

function MaterialCard({ material, isSelected, onSelect, isAttaching }: MaterialCardProps) {
  const formatPrice = (price: string | null, unit: string) => {
    if (!price) return 'Price not set';
    return `$${parseFloat(price).toFixed(2)} per ${getUnitLabel(unit)}`;
  };

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case 'm2': return 'm²';
      case 'lm': return 'lm';
      case 'each': return 'each';
      default: return unit;
    }
  };

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
      onClick={onSelect}
      data-testid={`material-card-${material.id}`}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Material Image */}
          {material.thumbnailUrl ? (
            <div className="aspect-square w-full bg-slate-100 rounded overflow-hidden">
              <img
                src={material.thumbnailUrl}
                alt={material.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="aspect-square w-full bg-slate-100 rounded flex items-center justify-center">
              <Package className="w-8 h-8 text-slate-400" />
            </div>
          )}
          
          {/* Material Info */}
          <div>
            <h3 className="font-medium text-sm text-slate-900 line-clamp-2">
              {material.name}
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              {material.sku || material.supplier || 'No SKU'}
            </p>
          </div>
          
          {/* Pricing */}
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-900">
              {formatPrice(material.price, material.unit)}
            </div>
            {material.wastagePct && parseFloat(material.wastagePct) > 0 && (
              <div className="text-xs text-amber-600">
                +{parseFloat(material.wastagePct).toFixed(1)}% wastage
              </div>
            )}
          </div>
          
          {/* Selection State */}
          {isSelected && (
            <Badge variant="default" className="w-full justify-center">
              {isAttaching ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Attaching...
                </>
              ) : (
                'Selected'
              )}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MaterialsTab() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('coping');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  
  const { 
    masks,
    calibration
  } = useEditorStore();
  
  const { selectedMaskId } = useNewEditorStore();
  const applyMaterialToSelected = useNewEditorStore(s => s.applyMaterialToSelected);
  
  // For now, just use the first mask if any are available, or the selected one
  const currentMask = selectedMaskId ? masks.find(m => m.id === selectedMaskId) : masks[0];

  // Fetch materials for the selected category
  const { data: materials, isLoading, error } = useQuery({
    queryKey: ['/api/materials', selectedCategory],
    queryFn: async () => {
      // Since we don't have orgId easily accessible, we'll need to get it
      // For now, return empty array - this will be implemented when backend is fixed
      return [];
    }
  });

  // Handle material selection and attachment
  const handleMaterialSelect = async (material: Material) => {
    if (!currentMask) {
      toast({
        title: 'No Selection',
        description: 'Draw a mask first to attach a material',
        variant: 'default'
      });
      return;
    }

    if (selectedMaterialId === material.id) {
      // Already selected, attach it
      try {
        setIsAttaching(true);
        // Apply material using new robust system
        if (applyMaterialToSelected && typeof applyMaterialToSelected === 'function') {
          applyMaterialToSelected(material);
        } else {
          // Fallback to direct material application
          const store = useEditorStore.getState();
          if (selectedMaskId) {
            await store.applyMaterialToMask(selectedMaskId, material);
          }
        }
        console.info('[CanvasEditor] Material picked:', material);
        
        toast({
          title: 'Material Attached',
          description: `${material.name} attached to ${currentMask.type} mask`,
          variant: 'default'
        });
        
        setSelectedMaterialId(null);
      } catch (error) {
        console.error('Failed to attach material:', error);
        toast({
          title: 'Attachment Failed',
          description: 'Could not attach material to mask',
          variant: 'destructive'
        });
      } finally {
        setIsAttaching(false);
      }
    } else {
      // Select for attachment
      setSelectedMaterialId(material.id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Materials</h2>
        
        {/* Selection Info */}
        {currentMask ? (
          <div className="space-y-2">
            <div className="text-sm text-slate-600">
              Selected: <span className="font-medium capitalize">{currentMask.type} mask</span>
            </div>
            {(currentMask as any)?.materialId && (
              <Badge variant="outline" className="text-xs">
                Material attached
              </Badge>
            )}
            {!calibration && (
              <div className="flex items-center space-x-1 text-xs text-amber-600">
                <Info className="w-3 h-3" />
                <span>Set calibration for cost estimates</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            Draw a mask first to attach materials
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-3 gap-1 m-4 h-auto">
          {MATERIAL_CATEGORIES.slice(0, 3).map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="text-xs py-2 data-[state=active]:bg-primary data-[state=active]:text-white"
              data-testid={`material-category-${category.id}`}
            >
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsList className="grid grid-cols-2 gap-1 mx-4 mb-4 h-auto">
          {MATERIAL_CATEGORIES.slice(3).map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="text-xs py-2 data-[state=active]:bg-primary data-[state=active]:text-white"
              data-testid={`material-category-${category.id}`}
            >
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Materials Grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {MATERIAL_CATEGORIES.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-0">
              <div className="space-y-4">
                <div className="text-sm text-slate-600">
                  {category.description}
                </div>
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : error ? (
                  <div className="text-center py-8 text-red-600">
                    Failed to load materials
                  </div>
                ) : materials && materials.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {materials.map((material: Material) => {
                      const isSelected = selectedMaterialId === material.id;
                      
                      return (
                        <MaterialCard
                          key={material.id}
                          material={material}
                          isSelected={isSelected}
                          onSelect={() => handleMaterialSelect(material)}
                          isAttaching={isAttaching && isSelected}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm mb-2">No materials available</p>
                    <p className="text-xs text-slate-400">
                      Add materials in the Materials Library page
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}