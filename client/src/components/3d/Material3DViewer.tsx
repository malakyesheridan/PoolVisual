/**
 * 3D Material Viewer Component
 * Integrates with existing material system to provide 3D previews
 */

import React, { useState, useEffect } from 'react';
import type { Material, EditorMask } from '@shared/schema';
import { useEditorStore } from '@/stores/editorSlice';
import { Material3DRenderer } from './Material3DRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Box, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  Palette,
  Info,
  Layers,
  Grid,
  Settings
} from 'lucide-react';

interface Material3DViewerProps {
  className?: string;
}

export function Material3DViewer({ className = '' }: Material3DViewerProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [activeView, setActiveView] = useState<'single' | 'comparison' | 'gallery'>('single');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

  const store = useEditorStore();
  const { 
    masks, 
    selectedMaskId, 
    maskMaterials,
    photo 
  } = store || {};

  const selectedMask = masks?.find(m => m.id === selectedMaskId);
  const selectedMaskMaterial = selectedMaskId ? maskMaterials?.[selectedMaskId] : null;

  // Load materials when component mounts
  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      // TODO: Replace with actual API call once materials endpoint is working
      const mockMaterials: Material[] = [
        {
          id: 'mat-001',
          name: 'Natural Stone Coping',
          sku: 'NSC-001',
          category: 'coping',
          pricePerUnit: 45.50,
          unit: 'lm',
          thumbnailUrl: '/api/materials/mat-001/thumbnail',
          isActive: true,
          description: 'Premium natural stone coping with smooth finish',
          orgId: 'org-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          wastagePercentage: 10
        },
        {
          id: 'mat-002',
          name: 'Blue Glass Tiles',
          sku: 'BGT-002',
          category: 'waterline_tile',
          pricePerUnit: 25.00,
          unit: 'm2',
          thumbnailUrl: '/api/materials/mat-002/thumbnail',
          isActive: true,
          description: 'Stunning blue glass mosaic tiles',
          orgId: 'org-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          wastagePercentage: 15
        },
        {
          id: 'mat-003',
          name: 'Pebble Interior',
          sku: 'PEB-003',
          category: 'interior',
          pricePerUnit: 35.75,
          unit: 'm2',
          thumbnailUrl: '/api/materials/mat-003/thumbnail',
          isActive: true,
          description: 'Natural pebble aggregate finish',
          orgId: 'org-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          wastagePercentage: 8
        }
      ];
      
      setMaterials(mockMaterials);
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  };

  // Get material by ID
  const getMaterialById = (materialId: string): Material | null => {
    return materials.find(m => m.id === materialId) || null;
  };

  // Get current material for selected mask
  const getCurrentMaterial = (): Material | null => {
    if (!selectedMaskMaterial?.materialId) return null;
    return getMaterialById(selectedMaskMaterial.materialId);
  };

  // Get masks with materials applied
  const getMasksWithMaterials = (): Array<{ mask: EditorMask; material: Material }> => {
    if (!masks || !maskMaterials) return [];
    
    return masks
      .filter(mask => maskMaterials[mask.id]?.materialId)
      .map(mask => ({
        mask,
        material: getMaterialById(maskMaterials[mask.id].materialId)!
      }))
      .filter(item => item.material);
  };

  // Toggle 3D viewer visibility
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  // Reset all 3D views
  const resetViews = () => {
    // Reset viewer state - this would trigger re-render of 3D components
    setActiveView('single');
    setSelectedMaterials([]);
  };

  const masksWithMaterials = getMasksWithMaterials();
  const currentMaterial = getCurrentMaterial();

  if (!photo) {
    return (
      <Card className={`${className} bg-gray-50`}>
        <CardContent className="p-4 text-center text-gray-500">
          <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Load an image to enable 3D material preview</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} bg-white`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center">
            <Box className="h-4 w-4 mr-2 text-purple-600" />
            3D Material Visualization
          </div>
          <div className="flex items-center space-x-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleVisibility}
              className="h-6 w-6 p-0"
              title={isVisible ? "Hide 3D Preview" : "Show 3D Preview"}
            >
              {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={resetViews}
              className="h-6 w-6 p-0"
              title="Reset Views"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isVisible ? (
          <div className="text-center py-8 text-gray-500">
            <EyeOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">3D Preview Hidden</p>
            <Button
              size="sm"
              variant="outline"
              onClick={toggleVisibility}
              className="mt-2"
            >
              Show 3D Preview
            </Button>
          </div>
        ) : (
          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single" className="text-xs">
                <Palette className="h-3 w-3 mr-1" />
                Current
              </TabsTrigger>
              <TabsTrigger value="comparison" className="text-xs">
                <Grid className="h-3 w-3 mr-1" />
                Compare
              </TabsTrigger>
              <TabsTrigger value="gallery" className="text-xs">
                <Layers className="h-3 w-3 mr-1" />
                Gallery
              </TabsTrigger>
            </TabsList>

            {/* Single Material View */}
            <TabsContent value="single" className="space-y-4">
              {selectedMask && currentMaterial ? (
                <Material3DRenderer
                  mask={selectedMask}
                  material={currentMaterial}
                  isVisible={isVisible}
                  className="w-full"
                />
              ) : (
                <Card className="bg-gray-50 border-dashed">
                  <CardContent className="p-6 text-center text-gray-500">
                    <Info className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm mb-2">No material applied to selected mask</p>
                    <p className="text-xs">
                      Select a mask and apply a material to see 3D preview
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Material Comparison View */}
            <TabsContent value="comparison" className="space-y-4">
              {masksWithMaterials.length >= 2 ? (
                <div className="grid grid-cols-1 gap-4">
                  {masksWithMaterials.slice(0, 2).map(({ mask, material }) => (
                    <div key={mask.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {mask.type} mask
                        </Badge>
                        <span className="text-xs text-gray-600">
                          {material.name}
                        </span>
                      </div>
                      <Material3DRenderer
                        mask={mask}
                        material={material}
                        isVisible={isVisible}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="bg-gray-50 border-dashed">
                  <CardContent className="p-6 text-center text-gray-500">
                    <Grid className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm mb-2">Need 2+ materials to compare</p>
                    <p className="text-xs">
                      Apply materials to multiple masks to enable comparison
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Material Gallery View */}
            <TabsContent value="gallery" className="space-y-4">
              {masksWithMaterials.length > 0 ? (
                <div className="space-y-3">
                  {masksWithMaterials.map(({ mask, material }) => (
                    <div key={mask.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={mask.id === selectedMaskId ? "default" : "outline"} 
                            className="text-xs"
                          >
                            {mask.type}
                          </Badge>
                          <span className="text-xs font-medium">
                            {material.name}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {material.category}
                        </Badge>
                      </div>
                      <Material3DRenderer
                        mask={mask}
                        material={material}
                        isVisible={isVisible}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="bg-gray-50 border-dashed">
                  <CardContent className="p-6 text-center text-gray-500">
                    <Layers className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm mb-2">No materials applied yet</p>
                    <p className="text-xs">
                      Apply materials to masks to see them in the gallery
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Material Info */}
        {currentMaterial && isVisible && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-blue-900">
                  {currentMaterial.name}
                </h4>
                <Badge variant="secondary" className="text-xs">
                  {currentMaterial.category}
                </Badge>
              </div>
              <p className="text-xs text-blue-700 mb-2">
                {currentMaterial.description}
              </p>
              <div className="flex justify-between items-center text-xs text-blue-600">
                <span>Price: ${currentMaterial.pricePerUnit}/{currentMaterial.unit}</span>
                <span>SKU: {currentMaterial.sku}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3D Features Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center">
            <Settings className="h-3 w-3 mr-1" />
            <span>Interactive rotation, zoom, lighting controls</span>
          </div>
          <div className="flex items-center">
            <Palette className="h-3 w-3 mr-1" />
            <span>Realistic materials with texture mapping</span>
          </div>
          <div className="flex items-center">
            <Eye className="h-3 w-3 mr-1" />
            <span>Real-time preview updates</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}