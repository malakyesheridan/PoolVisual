import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMaterialsStore } from '@/stores/materialsSlice';

const categories = [
  { id: 'waterline_tile', label: 'Waterline' },
  { id: 'coping', label: 'Coping' },
  { id: 'interior', label: 'Interior' },
  { id: 'paving', label: 'Paving' },
  { id: 'fencing', label: 'Fencing' }
];

export function MaterialGrid() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('waterline_tile');
  
  const materialsStore = useMaterialsStore();

  // Load materials when category changes
  useEffect(() => {
    materialsStore.load({ category: selectedCategory });
  }, [selectedCategory]);

  // Filter materials by search term
  const filteredMaterials = materialsStore.byCategory(selectedCategory).filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (material.sku && material.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleMaterialSelect = (material: any) => {
    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    console.log('Material selected:', material.name);
    // TODO: Integrate with canvas mask attachment
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
            data-testid="search-materials"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="px-4 pb-3">
        <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
          {categories.map((category) => (
            <Badge
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "secondary"}
              className={cn(
                "cursor-pointer whitespace-nowrap tap-target transition-smooth",
                selectedCategory === category.id && "ring-2 ring-primary ring-offset-2"
              )}
              onClick={() => setSelectedCategory(category.id)}
              data-testid={`category-${category.id}`}
            >
              {category.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Materials grid */}
      <div className="flex-1 overflow-y-auto px-4">
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
              <div className="text-center p-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="mobile-text-base">No materials found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your search or category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pb-4">
                {filteredMaterials.map((material) => (
                  <Card
                    key={material.id}
                    className="cursor-pointer hover:shadow-md transition-smooth active:scale-[0.98]"
                    onClick={() => handleMaterialSelect(material)}
                    data-testid={`material-card-${material.id}`}
                  >
                    <CardContent className="p-3">
                      {/* Thumbnail */}
                      <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
                        {material.thumbnailUrl || material.textureUrl ? (
                          <img
                            src={material.thumbnailUrl || material.textureUrl}
                            alt={material.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 hidden">
                          {material.name.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div>
                        <h4 className="font-medium text-sm truncate mobile-text-base">{material.name}</h4>
                        {material.sku && (
                          <p className="text-xs text-gray-500 truncate">{material.sku}</p>
                        )}
                        {material.price && (
                          <p className="text-xs text-green-600 font-medium">
                            ${material.price}/{material.unit}
                          </p>
                        )}
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