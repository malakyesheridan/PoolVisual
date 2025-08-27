/**
 * Editor Sidebar - Material Selection and Mask Properties
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package,
  Ruler,
  Calculator,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Palette,
  Settings
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorSlice';
import { Material, EditorMask } from '@shared/schema';
import { cn } from '@/lib/utils';
import { MaskProperties } from './MaskProperties';
import { CalibrationControls } from './CalibrationControls';
import { QuoteGenerator } from './QuoteGenerator';
import { Material3DViewer } from '../3d/Material3DViewer';

interface SidebarProps {
  materials: Material[];
  onMaterialSelect?: (materialId: string) => void;
  className?: string;
}

export function Sidebar({ materials, onMaterialSelect, className }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const {
    masks,
    selectedMaskId,
    selectedMaterialId,
    editorState,
    selectMask,
    deleteMask,
    updateMask,
    setSelectedMaterialId,
    computeMetrics
  } = useEditorStore();

  const selectedMask = selectedMaskId ? masks.find(m => m.id === selectedMaskId) : null;
  const selectedMaterial = selectedMaterialId ? materials.find(m => m.id === selectedMaterialId) : null;

  // Filter materials by search and category
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(materials.map(m => m.category)))];

  const formatMetric = (value: number | undefined, unit: string) => {
    if (value === undefined) return '—';
    return `${value.toFixed(2)} ${unit}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const calculateMaskCost = (mask: EditorMask) => {
    if (!mask.materialId) return null;
    
    const material = materials.find(m => m.id === mask.materialId);
    if (!material) return null;
    
    const metrics = computeMetrics(mask.id);
    let quantity = 0;
    
    if (material.unit === 'm2' && metrics.area_m2) {
      quantity = metrics.area_m2;
    } else if (material.unit === 'lm' && metrics.perimeter_m) {
      quantity = metrics.perimeter_m;
    } else if (material.unit === 'each') {
      quantity = 1;
    }
    
    const wastage = 1 + (parseFloat(material.defaultWastagePct?.toString() || '0') || 0) / 100;
    const adjustedQuantity = quantity * wastage;
    const cost = adjustedQuantity * parseFloat(material.price?.toString() || '0');
    
    return {
      quantity: adjustedQuantity,
      unitCost: parseFloat(material.price?.toString() || '0'),
      totalCost: cost,
      unit: material.unit
    };
  };

  return (
    <div className={cn("w-80 bg-white border-l border-slate-200 flex flex-col h-full", className)}>
      <Tabs defaultValue="properties" className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-200">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="properties" className="text-xs">
              <Settings className="w-4 h-4 mr-1" />
              Properties
            </TabsTrigger>
            <TabsTrigger value="masks" className="text-xs">
              <Ruler className="w-4 h-4 mr-1" />
              Masks ({masks.length})
            </TabsTrigger>
            <TabsTrigger value="materials" className="text-xs">
              <Package className="w-4 h-4 mr-1" />
              Materials
            </TabsTrigger>
            <TabsTrigger value="3d" className="text-xs">
              <Palette className="w-4 h-4 mr-1" />
              3D Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="materials" className="flex-1 p-0 m-0">
          <div className="p-4 space-y-4">
            {/* Material Search */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search materials..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-material-search"
                />
              </div>
              
              {/* Category Filter */}
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex space-x-2 pb-2">
                  {categories.map(category => (
                    <Badge
                      key={category}
                      variant={selectedCategory === category ? "default" : "secondary"}
                      className="cursor-pointer text-xs capitalize"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Selected Material Info */}
            {selectedMaterial && (
              <Card className="border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center">
                    <Palette className="w-4 h-4 mr-2" />
                    Selected Material
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: '#' + (Math.floor(Math.random() * 16777215)).toString(16).padStart(6, '0') }}
                    />
                    <span className="font-medium text-sm">{selectedMaterial.name}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {formatCurrency(parseFloat(selectedMaterial.price?.toString() || '0'))} per {selectedMaterial.unit}
                  </div>
                  {selectedMaterial.notes && (
                    <p className="text-xs text-slate-600">{selectedMaterial.notes}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Materials List */}
          <ScrollArea className="flex-1">
            <div className="p-4 pt-0 space-y-2">
              {filteredMaterials.map(material => (
                <Card
                  key={material.id}
                  className={cn(
                    "cursor-pointer border transition-colors",
                    selectedMaterialId === material.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                  onClick={() => {
                    setSelectedMaterialId(material.id);
                    onMaterialSelect?.(material.id);
                  }}
                  data-testid={`material-card-${material.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start space-x-3">
                      <div 
                        className="w-8 h-8 rounded border flex-shrink-0"
                        style={{ backgroundColor: '#' + (Math.floor(Math.random() * 16777215)).toString(16).padStart(6, '0') }}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{material.name}</h4>
                        <p className="text-xs text-slate-600 mt-1">
                          {formatCurrency(parseFloat(material.price?.toString() || '0'))} per {material.unit}
                        </p>
                        {material.notes && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {material.notes}
                          </p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {material.category}
                          </Badge>
                          {material.defaultWastagePct && (
                            <Badge variant="secondary" className="text-xs">
                              +{material.defaultWastagePct}% waste
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="masks" className="flex-1 p-0 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {masks.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Ruler className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No masks created yet</p>
                  <p className="text-xs mt-1">Use the drawing tools to create area and linear masks</p>
                </div>
              ) : (
                masks.map((mask, index) => {
                  const metrics = computeMetrics(mask.id);
                  const cost = calculateMaskCost(mask);
                  const isSelected = selectedMaskId === mask.id;
                  
                  return (
                    <Card
                      key={mask.id}
                      className={cn(
                        "cursor-pointer border transition-colors",
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                      onClick={() => selectMask(mask.id)}
                      data-testid={`mask-card-${mask.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <Badge 
                                variant={mask.type === 'area' ? 'default' : mask.type === 'linear' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {mask.type}
                              </Badge>
                              <span className="text-sm font-medium">
                                Mask {index + 1}
                              </span>
                            </div>
                            
                            {/* Metrics */}
                            <div className="mt-2 space-y-1">
                              {mask.type === 'area' && (
                                <div className="text-xs text-slate-600">
                                  Area: {formatMetric(metrics.area_m2, 'm²')}
                                </div>
                              )}
                              {(mask.type === 'linear' || mask.type === 'waterline_band') && (
                                <div className="text-xs text-slate-600">
                                  Length: {formatMetric(metrics.perimeter_m, 'm')}
                                </div>
                              )}
                              {mask.type === 'waterline_band' && (
                                <div className="text-xs text-slate-600">
                                  Band Height: {formatMetric((mask as any).band_height_m, 'm')}
                                </div>
                              )}
                            </div>

                            {/* Material and Cost */}
                            {mask.materialId && (
                              <div className="mt-2">
                                <div className="flex items-center space-x-2">
                                  <div 
                                    className="w-3 h-3 rounded border"
                                    style={{ backgroundColor: '#' + (Math.floor(Math.random() * 16777215)).toString(16).padStart(6, '0') }}
                                  />
                                  <span className="text-xs font-medium">
                                    {materials.find(m => m.id === mask.materialId)?.name}
                                  </span>
                                </div>
                                {cost && (
                                  <div className="text-xs text-slate-600 mt-1">
                                    {cost.quantity.toFixed(2)} {cost.unit} × {formatCurrency(cost.unitCost)} = {formatCurrency(cost.totalCost)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col space-y-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Toggle mask visibility (would need to implement this)
                              }}
                              className="w-8 h-8 p-0"
                              title="Toggle Visibility"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMask(mask.id);
                              }}
                              className="w-8 h-8 p-0 text-red-600 hover:text-red-700"
                              title="Delete Mask"
                              data-testid={`button-delete-mask-${mask.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="properties" className="flex-1 p-0 m-0">
          <div className="p-4 space-y-4">
            <CalibrationControls />
            <QuoteGenerator />
          </div>
          <div className="border-t">
            <MaskProperties />
          </div>
        </TabsContent>

        <TabsContent value="3d" className="flex-1 p-0 m-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <Material3DViewer />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}