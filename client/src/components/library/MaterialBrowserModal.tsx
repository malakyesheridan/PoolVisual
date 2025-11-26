// Material Browser Modal Component
// Full-featured material browsing with search and grid

import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '../ui/dialog';
import { Search, Check } from 'lucide-react';
import { ensureLoaded, getAll, Material, getById } from '../../materials/registry';
import { getProxiedTextureUrl } from '../../lib/textureProxy';

interface MaterialBrowserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: 'coping' | 'waterline_tile' | 'interior' | 'paving';
  selectedMaterialId?: string;
  onSelect: (materialId: string) => void;
}

export function MaterialBrowserModal({
  open,
  onOpenChange,
  category,
  selectedMaterialId,
  onSelect
}: MaterialBrowserModalProps) {
  const [materials, setMaterials] = useState<Record<string, Material>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Load materials from registry
  useEffect(() => {
    ensureLoaded().then(() => {
      const allMaterials = getAll();
      setMaterials(allMaterials);
      setLoading(false);
    }).catch(err => {
      console.warn('[MaterialBrowserModal] failed to load materials', err);
      setLoading(false);
    });
  }, []);

  // Filter materials by category and search
  const filteredMaterials = useMemo(() => {
    return Object.values(materials).filter(material => {
      const matchesCategory = material.category === category;
      const matchesSearch = !searchTerm || material.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [materials, category, searchTerm]);

  const categoryDisplayName = category
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const handleSelect = (materialId: string) => {
    onSelect(materialId);
    onOpenChange(false);
    setSearchTerm('');
  };

  if (loading) {
    return (
      <Dialog.Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle>Loading Materials...</Dialog.DialogTitle>
        </Dialog.DialogHeader>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading materials...</div>
        </div>
      </Dialog.DialogContent>
      </Dialog.Dialog>
    );
  }

  return (
    <Dialog.Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <Dialog.DialogHeader>
          <Dialog.DialogTitle>Browse {categoryDisplayName}</Dialog.DialogTitle>
        </Dialog.DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search materials..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Materials Grid */}
        <div className="flex-1 overflow-y-auto mt-4">
          {filteredMaterials.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-sm">No materials found</div>
              {searchTerm && (
                <div className="text-gray-400 text-xs mt-2">
                  Try a different search term
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filteredMaterials.map(material => {
                const imageUrl = material.thumbnailURL || material.albedoURL;
                const proxiedUrl = imageUrl ? getProxiedTextureUrl(imageUrl) : null;
                const isSelected = selectedMaterialId === material.id;

                return (
                  <button
                    key={material.id}
                    onClick={() => handleSelect(material.id)}
                    className={`relative p-3 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center z-10">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* Material Thumbnail */}
                    <div className="aspect-square bg-gray-100 rounded overflow-hidden relative mb-2">
                      {proxiedUrl ? (
                        <img
                          src={proxiedUrl}
                          alt={material.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                          }}
                        />
                      ) : (
                        <div className="hidden" />
                      )}
                      {!proxiedUrl && (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 px-2 text-center">
                          {material.name}
                        </div>
                      )}
                    </div>

                    {/* Material Info */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight" title={material.name}>
                        {material.name}
                      </div>

                      {material.price && typeof material.price === 'number' && (
                        <div className="text-xs font-semibold text-green-600">
                          ${material.price.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
          {filteredMaterials.length} material{filteredMaterials.length !== 1 ? 's' : ''} found
        </div>
      </Dialog.DialogContent>
    </Dialog.Dialog>
  );
}

