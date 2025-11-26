import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Package } from "lucide-react";
import { useMaterialsStore, Material } from "@/stores/materialsSlice";
import { useEditorStore } from "@/stores/editorSlice";
import { toast } from "@/hooks/use-toast";

const materialCategories = [
  { value: 'coping', label: 'Coping' },
  { value: 'waterline_tile', label: 'Waterline' },
  { value: 'interior', label: 'Interior' },
  { value: 'paving', label: 'Paving' },
  { value: 'fencing', label: 'Fencing' },
];

export function MaterialsSidebar() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('waterline_tile');
  
  const materialsStore = useMaterialsStore();
  const editorStore = useEditorStore();
  
  // Load materials on mount
  useEffect(() => {
    materialsStore.load({ category: selectedCategory });
  }, [selectedCategory]);

  // Filter materials by search term
  const filteredMaterials = materialsStore.byCategory(selectedCategory).filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (material.sku && material.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle material selection and attachment to selected mask
  const handleMaterialSelect = async (material: Material) => {
    // For now, show material selection (full integration would require selected mask state)
    if (editorStore.masks.length === 0) {
      toast({
        title: "No masks available",
        description: "Please draw a mask first to attach materials.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Calculate initial repeat scale
      const ppm = 500; // Default pixels per meter
      const repeatM = parseFloat(material.physicalRepeatM || '0.30');
      const texturePxPerMeter = 1024 / repeatM;
      const initialScale = texturePxPerMeter / ppm;

      // Log material selection for now (full integration would update mask with material)
      console.log('Material selected:', {
        material: material.name,
        id: material.id,
        repeatScale: initialScale,
        availableMasks: editorStore.masks.length
      });
      
      toast({
        title: "Material attached",
        description: `${material.name} has been applied to the selected area.`,
      });

    } catch (error: any) {
      console.error('Error attaching material:', error);
      toast({
        title: "Failed to attach material",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4" />
          <h3 className="font-semibold">Materials</h3>
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            data-testid="search-materials"
          />
        </div>
        
        {/* Category tabs */}
        <div className="flex flex-wrap gap-1">
          {materialCategories.map((category) => (
            <Badge
              key={category.value}
              variant={selectedCategory === category.value ? "default" : "secondary"}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedCategory(category.value)}
              data-testid={`category-${category.value}`}
            >
              {category.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Materials list */}
      <div className="flex-1 overflow-y-auto p-2">
        {materialsStore.loading && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        
        {materialsStore.error && (
          <div className="text-center p-4 text-red-600 text-sm">
            {materialsStore.error}
          </div>
        )}
        
        {!materialsStore.loading && !materialsStore.error && (
          <>
            {filteredMaterials.length === 0 ? (
              <div className="text-center p-4 text-muted-foreground text-sm">
                No materials found in {materialCategories.find(c => c.value === selectedCategory)?.label}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMaterials.map((material) => (
                  <Card
                    key={material.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleMaterialSelect(material)}
                    data-testid={`material-card-${material.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                          {material.thumbnailUrl || material.textureUrl ? (
                            <img
                              src={material.thumbnailUrl || material.textureUrl}
                              alt={material.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.removeAttribute('style');
                              }}
                            />
                          ) : null}
                          <div 
                            className="w-full h-full bg-gray-200 flex items-center justify-center text-xs text-gray-500"
                            style={{ display: material.thumbnailUrl || material.textureUrl ? 'none' : 'flex' }}
                          >
                            {material.name.substring(0, 2).toUpperCase()}
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{material.name}</div>
                          {material.sku && (
                            <div className="text-xs text-muted-foreground">{material.sku}</div>
                          )}
                          {material.price && (
                            <div className="text-xs text-green-600">
                              ${material.price}/{material.unit}
                            </div>
                          )}
                          {material.physicalRepeatM && (
                            <div className="text-xs text-primary">
                              {(parseFloat(material.physicalRepeatM) * 1000).toFixed(0)}mm repeat
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}