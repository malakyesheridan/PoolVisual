import { useEffect, useMemo, useState } from 'react';
import { useMaterialsStore } from '../../state/materialsStore';
import { listMaterialsClient } from '../../lib/materialsClient';
import type { Material } from '../../state/materialsStore';
import { X, Search, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (m: Material) => void;
  initialCategory?: Material['category'] | 'all';
};

export function MaterialPickerModal({ open, onClose, onPick, initialCategory = 'all' }: Props) {
  const { hydrateMerge, all } = useMaterialsStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Material['category'] | 'all'>(initialCategory);
  const [loading, setLoading] = useState(false);

  // Load materials when modal opens if store is empty
  useEffect(() => {
    if (!open) return;
    if (all().length === 0) {
      setLoading(true);
      listMaterialsClient()
        .then(items => hydrateMerge(items))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, hydrateMerge, all]);

  const filteredMaterials = useMemo(() => {
    const allMaterials = all();
    const searchLower = search.trim().toLowerCase();
    return allMaterials.filter(m => {
      const matchesCategory = category === 'all' || m.category === category;
      const matchesSearch = !searchLower || 
        m.name?.toLowerCase().includes(searchLower) ||
        m.sku?.toLowerCase().includes(searchLower) ||
        m.supplier?.toLowerCase().includes(searchLower);
      return matchesCategory && matchesSearch;
    });
  }, [all, search, category]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-6xl max-h-[90vh] w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Choose Material</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search materials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={category} onValueChange={(value: any) => setCategory(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="waterline_tile">Waterline Tile</SelectItem>
              <SelectItem value="interior">Interior</SelectItem>
              <SelectItem value="coping">Coping</SelectItem>
              <SelectItem value="paving">Paving</SelectItem>
              <SelectItem value="fencing">Fencing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              <span className="ml-3 text-gray-600">Loading materials...</span>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-2">No materials found</div>
              <div className="text-sm text-gray-400">
                {search ? 'Try adjusting your search or category filter' : 'Add materials to your library first'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredMaterials.map(material => (
                <button
                  key={material.id}
                  onClick={() => onPick(material)}
                  className="group border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 text-left bg-white dark:bg-gray-800"
                  data-testid={`material-card-${material.id}`}
                >
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                    {material.thumbnail_url || material.texture_url ? (
                      <img 
                        src={material.thumbnail_url || material.texture_url || ''} 
                        alt={material.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    
                    {material.price && (
                      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        ${typeof material.price === 'number' ? material.price.toFixed(2) : material.price}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3">
                    <div className="font-medium text-sm line-clamp-2 mb-1">
                      {material.name}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      {material.category?.replace('_', ' ')} • {material.unit}
                    </div>
                    {material.supplier && (
                      <div className="text-xs text-blue-600">
                        {material.supplier}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}