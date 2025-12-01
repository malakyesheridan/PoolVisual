import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Search, Undo, Redo } from "lucide-react";
import { MaterialCard } from "./material-card";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useCanvasStore } from "@/stores/canvas-store";
import { useAuthStore } from "@/stores/auth-store";

interface MaterialLibraryProps {
  onMaterialSelect?: (materialId: string) => void;
}

export function MaterialLibrary({ onMaterialSelect }: MaterialLibraryProps) {
  const [activeCategory, setActiveCategory] = useState('coping');
  const [searchTerm, setSearchTerm] = useState('');
  const [scale, setScale] = useState([1]);
  const [rotation, setRotation] = useState([0]);
  const [brightness, setBrightness] = useState([0]);
  
  const { selectedMaterial, setSelectedMaterial } = useCanvasStore();
  
  // Get user industry for dynamic categories (user-centric)
  const { user } = useAuthStore();
  const industry = user?.industryType || 'pool';
  
  // Fetch dynamic categories from API with fallback
  const { data: tradeCategories = [] } = useQuery({
    queryKey: ['/api/trade-categories', industry],
    queryFn: () => apiClient.getTradeCategories(industry),
    enabled: !!industry,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: getDefaultCategoriesForIndustry(industry),
  });
  
  // Build categories array
  const materialCategories = tradeCategories.map(cat => ({
    id: cat.categoryKey,
    label: cat.categoryLabel,
    shortLabel: cat.categoryLabel,
  }));
  
  // Set default category if available
  useEffect(() => {
    if (materialCategories.length > 0 && !materialCategories.find(c => c.id === activeCategory)) {
      setActiveCategory(materialCategories[0].id);
    }
  }, [materialCategories, activeCategory]);

  // Fetch materials for current user (user-centric architecture)
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['/api/materials', activeCategory, industry],
    queryFn: () => apiClient.getMaterials(activeCategory, undefined, industry),
  });

  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMaterialSelect = (materialId: string) => {
    setSelectedMaterial(materialId);
    onMaterialSelect?.(materialId);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3" data-testid="text-materials-title">
          Materials
        </h3>
        
        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
          <TabsList className="grid grid-cols-3 bg-slate-100 p-1 rounded-lg">
            {materialCategories.slice(0, 3).map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="text-xs font-medium py-2 px-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                data-testid={`tab-category-${category.id}`}
              >
                {category.shortLabel}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {/* Additional categories in a second row if needed */}
          {materialCategories.length > 3 && (
            <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-lg mt-2">
              {materialCategories.slice(3).map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="text-xs font-medium py-2 px-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                  data-testid={`tab-category-${category.id}`}
                >
                  {category.shortLabel}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
        </Tabs>
        
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-materials"
          />
        </div>
        
        {/* Material Grid */}
        <div className="grid gap-3 mb-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-3">
                <div className="w-full h-20 bg-slate-100 rounded-md mb-2 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded mb-1 animate-pulse" />
                <div className="h-3 bg-slate-100 rounded mb-2 animate-pulse w-2/3" />
                <div className="flex justify-between items-center">
                  <div className="h-3 bg-slate-100 rounded w-1/3 animate-pulse" />
                  <div className="h-5 bg-slate-100 rounded w-16 animate-pulse" />
                </div>
              </Card>
            ))
          ) : filteredMaterials.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-slate-500" data-testid="text-no-materials">
                No materials found for "{searchTerm || activeCategory}"
              </p>
            </Card>
          ) : (
            filteredMaterials.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                isSelected={selectedMaterial === material.id}
                onClick={() => handleMaterialSelect(material.id)}
              />
            ))
          )}
        </div>
        
        {/* Material Controls */}
        {selectedMaterial && (
          <Card className="p-3 bg-slate-50">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm font-medium text-slate-900">
                Material Adjustments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-3">
              <div>
                <Label className="text-xs text-slate-600 mb-1" htmlFor="scale-slider">
                  Scale
                </Label>
                <Slider
                  id="scale-slider"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={scale}
                  onValueChange={setScale}
                  className="w-full"
                  data-testid="slider-material-scale"
                />
                <div className="text-xs text-slate-500 text-right">
                  {scale[0].toFixed(1)}x
                </div>
              </div>
              
              <div>
                <Label className="text-xs text-slate-600 mb-1" htmlFor="rotation-slider">
                  Rotation
                </Label>
                <Slider
                  id="rotation-slider"
                  min={0}
                  max={360}
                  step={1}
                  value={rotation}
                  onValueChange={setRotation}
                  className="w-full"
                  data-testid="slider-material-rotation"
                />
                <div className="text-xs text-slate-500 text-right">
                  {rotation[0]}°
                </div>
              </div>
              
              <div>
                <Label className="text-xs text-slate-600 mb-1" htmlFor="brightness-slider">
                  Brightness
                </Label>
                <Slider
                  id="brightness-slider"
                  min={-50}
                  max={50}
                  step={1}
                  value={brightness}
                  onValueChange={setBrightness}
                  className="w-full"
                  data-testid="slider-material-brightness"
                />
                <div className="text-xs text-slate-500 text-right">
                  {brightness[0] > 0 ? '+' : ''}{brightness[0]}
                </div>
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs font-medium"
                  data-testid="button-undo"
                >
                  <Undo className="w-3 h-3 mr-1" />
                  Undo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs font-medium"
                  data-testid="button-redo"
                >
                  <Redo className="w-3 h-3 mr-1" />
                  Redo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
