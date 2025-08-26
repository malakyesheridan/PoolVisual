/**
 * Materials Tab Component
 * Provides material selection and attachment functionality
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Info } from 'lucide-react';
import { Material } from '@shared/schema';
import { useEditorStore } from '@/stores/editorSlice';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

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
  const formatPrice = (price: number, unit: string) => {
    return `$${price.toFixed(2)} per ${unit}`;
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
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
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
              {material.brand || 'No brand'}
            </p>
          </div>
          
          {/* Pricing */}
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-900">
              {formatPrice(material.pricePerUnit, getUnitLabel(material.unit))}
            </div>
            {material.wastagePercentage && material.wastagePercentage > 0 && (
              <div className="text-xs text-amber-600">
                +{material.wastagePercentage}% wastage
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
    selectedMaskId,
    masks,
    editorState,
    attachMaterial,
    computeMetrics
  } = useEditorStore();
  
  const currentMask = selectedMaskId ? masks.find(m => m.id === selectedMaskId) : undefined;
  const calibration = editorState.calibration;

  // Fetch materials for the selected category
  const { data: materials, isLoading, error } = useQuery({
    queryKey: ['/api/materials', selectedCategory],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/materials?category=${selectedCategory}`);
      return response.json();
    }
  });

  // Handle material selection and attachment
  const handleMaterialSelect = async (material: Material) => {
    if (!currentMask) {
      toast({
        title: 'No Selection',
        description: 'Select a mask first to attach a material',
        variant: 'default'
      });
      return;
    }

    if (selectedMaterialId === material.id) {
      // Already selected, attach it
      try {
        setIsAttaching(true);
        await attachMaterial(currentMask.id, material.id);
        
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

  // Calculate estimated cost if material is attached
  const getEstimatedCost = (material: Material) => {
    if (!currentMask || !calibration) return null;
    
    const metrics = computeMetrics(currentMask.id);
    let quantity = 0;
    
    switch (material.unit) {
      case 'm2':
        quantity = metrics.areaM2 || 0;
        break;
      case 'lm':
        quantity = metrics.lengthM || 0;
        break;
      case 'each':
        quantity = 1;
        break;
    }
    
    if (quantity === 0) return null;
    
    const basePrice = quantity * material.pricePerUnit;
    const wastage = material.wastagePercentage ? (basePrice * material.wastagePercentage / 100) : 0;
    const total = basePrice + wastage;
    
    return {
      quantity,
      basePrice,
      wastage,
      total,
      unit: material.unit
    };
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
            {currentMask.materialId && (
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
            Select a mask to attach materials
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
              className="text-xs py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
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
              className="text-xs py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
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
                      const estimatedCost = currentMask && calibration ? getEstimatedCost(material) : null;
                      
                      return (
                        <div key={material.id} className="space-y-2">
                          <MaterialCard
                            material={material}
                            isSelected={isSelected}
                            onSelect={() => handleMaterialSelect(material)}
                            isAttaching={isAttaching && isSelected}
                          />
                          
                          {/* Cost Estimate */}
                          {isSelected && estimatedCost && (
                            <Card className="bg-blue-50 border-blue-200">
                              <CardContent className="p-3">
                                <div className="text-xs space-y-1">
                                  <div className="font-medium text-blue-900">
                                    Estimated Cost
                                  </div>
                                  <div className="text-blue-700">
                                    Qty: {estimatedCost.quantity.toFixed(2)} {estimatedCost.unit === 'm2' ? 'm²' : estimatedCost.unit}
                                  </div>
                                  <div className="text-blue-700">
                                    Base: ${estimatedCost.basePrice.toFixed(2)}
                                  </div>
                                  {estimatedCost.wastage > 0 && (
                                    <div className="text-blue-700">
                                      Wastage: ${estimatedCost.wastage.toFixed(2)}
                                    </div>
                                  )}
                                  <div className="font-medium text-blue-900 border-t border-blue-200 pt-1">
                                    Total: ${estimatedCost.total.toFixed(2)}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No materials available in this category
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