import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMaterialsStore } from '@/state/materialsStore';
import { Search, Grid3X3, List } from 'lucide-react';

interface MaterialPickerModalProps {
  open: boolean;
  onClose: () => void;
  onPick: (materialId: string) => void;
  selectedMaterialId?: string | null;
}

export function MaterialPickerModal({ 
  open, 
  onClose, 
  onPick, 
  selectedMaterialId 
}: MaterialPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mounted, setMounted] = useState(false);
  
  const materials = useMaterialsStore(s => s.items ?? {});
  const hydrateMerge = useMaterialsStore(s => s.hydrateMerge);

  // Ensure component is mounted before rendering Dialog
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Ensure materials are loaded
  useEffect(() => {
    if (Object.keys(materials).length === 0) {
      // Load materials if not already loaded
      // This would typically call an API endpoint
      console.log('[MaterialPickerModal] Loading materials...');
    }
  }, [materials]);

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
    onPick(materialId);
    onClose();
  };

  // Don't render Dialog until mounted to prevent useRef issues
  if (!mounted) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Material</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 flex-1">
          {/* Search and Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
            </Button>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(category => (
              <Badge
                key={category}
                variant={selectedCategory === category ? 'default' : 'secondary'}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All Categories' : category}
              </Badge>
            ))}
          </div>

          {/* Materials Grid/List */}
          <ScrollArea className="flex-1">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredMaterials.map(material => (
                  <div
                    key={material.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedMaterialId === material.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleMaterialSelect(material.id)}
                  >
                    <div className="aspect-square bg-gray-100 rounded-md mb-3 flex items-center justify-center">
                      {material.texture_url ? (
                        <img 
                          src={material.texture_url} 
                          alt={material.name}
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <div className="text-gray-400 text-sm">No Preview</div>
                      )}
                    </div>
                    <div className="text-sm font-medium">{material.name}</div>
                    <div className="text-xs text-gray-500">{material.sku}</div>
                    {material.category && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {material.category}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMaterials.map(material => (
                  <div
                    key={material.id}
                    className={`flex items-center gap-4 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedMaterialId === material.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleMaterialSelect(material.id)}
                  >
                    <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center">
                      {material.texture_url ? (
                        <img 
                          src={material.texture_url} 
                          alt={material.name}
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <div className="text-gray-400 text-xs">No Preview</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{material.name}</div>
                      <div className="text-sm text-gray-500">{material.sku}</div>
                    </div>
                    {material.category && (
                      <Badge variant="secondary" className="text-xs">
                        {material.category}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Results Count */}
          <div className="text-sm text-gray-500 text-center">
            {filteredMaterials.length} material{filteredMaterials.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}