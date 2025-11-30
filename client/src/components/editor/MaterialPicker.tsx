/**
 * Material Picker Component
 * Allows users to assign materials to selected masks
 */

import React, { useState, useEffect } from 'react';
import { Search, Check, Package } from 'lucide-react';
import { Material } from '@shared/schema';
import { useEditorStore } from '@/stores/editorSlice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/orgStore';
import { getDefaultCategoriesForIndustry } from '@/lib/materialCategories';

interface MaterialPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMaskId: string | null;
}

export function MaterialPicker({ isOpen, onClose, selectedMaskId }: MaterialPickerProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  
  const store = useEditorStore();
  const { attachMaterial } = store || {};
  
  // Get org industry for dynamic categories
  const { currentOrg, selectedOrgId } = useOrgStore();
  const industry = currentOrg?.industry || 'pool';
  
  // Fetch dynamic categories from API with fallback
  const { data: tradeCategories = [] } = useQuery({
    queryKey: ['/api/trade-categories', industry],
    queryFn: () => apiClient.getTradeCategories(industry),
    enabled: !!industry && isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: getDefaultCategoriesForIndustry(industry),
  });
  
  // Build categories array with 'all' option
  const categories = [
    { id: 'all', label: 'All Materials' },
    ...tradeCategories.map(cat => ({
      id: cat.categoryKey,
      label: cat.categoryLabel,
    })),
  ];

  // Load materials on component mount
  useEffect(() => {
    if (isOpen && selectedOrgId) {
      loadMaterials();
    }
  }, [isOpen, selectedOrgId, selectedCategory, industry]);

  const loadMaterials = async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const materialsData = await apiClient.getMaterials(selectedOrgId, selectedCategory === 'all' ? undefined : selectedCategory, searchTerm || undefined, industry);
      setMaterials(materialsData || []);
    } catch (error) {
      console.error('Failed to load materials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaterialSelect = (materialId: string) => {
    if (selectedMaskId && attachMaterial) {
      attachMaterial(selectedMaskId, materialId);
      onClose();
    }
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory;
    return matchesSearch && matchesCategory && material.isActive;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Select Material</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              data-testid="material-picker-close"
            >
              ×
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search materials by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="material-search"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* Category Tabs */}
          <div className="w-48 border-r p-4">
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} orientation="vertical">
              <TabsList className="flex flex-col h-auto w-full">
                {categories.map(category => (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className="w-full justify-start"
                    data-testid={`category-${category.id}`}
                  >
                    {category.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Materials Grid */}
          <div className="flex-1 p-4">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMaterials.map(material => (
                    <MaterialCard
                      key={material.id}
                      material={material}
                      onSelect={() => handleMaterialSelect(material.id)}
                    />
                  ))}
                  
                  {filteredMaterials.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center h-32 text-gray-500">
                      <Package className="h-8 w-8 mb-2" />
                      <p>No materials found</p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {filteredMaterials.length} materials available
            </p>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MaterialCardProps {
  material: Material;
  onSelect: () => void;
}

function MaterialCard({ material, onSelect }: MaterialCardProps) {
  return (
    <div 
      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onSelect}
      data-testid={`material-card-${material.id}`}
    >
      {/* Thumbnail */}
      {material.thumbnailUrl ? (
        <div className="w-full h-24 bg-gray-100 rounded mb-3 overflow-hidden">
          <img 
            src={material.thumbnailUrl} 
            alt={material.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-24 bg-gray-100 rounded mb-3 flex items-center justify-center">
          <Package className="h-8 w-8 text-gray-400" />
        </div>
      )}
      
      {/* Material Info */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-medium text-sm leading-tight">{material.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {material.category.replace('_', ' ')}
          </Badge>
        </div>
        
        <p className="text-xs text-gray-500 uppercase">{material.sku}</p>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            ${Number(material.price || 0).toFixed(2)} / {material.unit}
          </span>
          {material.defaultWastagePct && (
            <span className="text-xs text-gray-500">
              +{Number(material.defaultWastagePct)}% waste
            </span>
          )}
        </div>
      </div>
    </div>
  );
}