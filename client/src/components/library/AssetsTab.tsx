import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Plus, Search, Filter, Image, MoreVertical, Trash2, Edit, Eye } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { useUnifiedAssetStore, useAssetSelectors } from '../../stores/unifiedAssetStore';
import { toast } from 'sonner';

export const AssetsTab = forwardRef<{ triggerAdd: () => void }, {}>((props, ref) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: '',
    category: 'Custom' as const,
    type: 'image' as const,
    description: '',
    thumbnailUrl: '',
    textureUrl: '',
    price: 0,
    cost: 0,
    sku: '',
    supplier: '',
    color: '',
    finish: '',
    physicalRepeatM: 0.2,
    tags: [] as string[]
  });
  
  const {
    loadAssets,
    addAsset,
    updateAsset,
    deleteAsset,
    duplicateAsset,
    selectAsset,
    setSearchQuery,
    setCategoryFilter,
    recordUsage,
    loading,
    error
  } = useUnifiedAssetStore();
  
  const { filteredAssets, categories, selectedAsset } = useAssetSelectors();

  // Expose triggerAdd function to parent component
  useImperativeHandle(ref, () => ({
    triggerAdd: () => {
      setShowAddForm(true);
      setNewAsset({
        name: '',
        category: 'Custom',
        type: 'image',
        description: '',
        thumbnailUrl: '',
        textureUrl: '',
        price: 0,
        cost: 0,
        sku: '',
        supplier: '',
        color: '',
        finish: '',
        physicalRepeatM: 0.2,
        tags: []
      });
    }
  }));

  // Load assets on mount
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleAddAsset = () => {
    if (!newAsset.name.trim()) {
      toast.error('Please enter an asset name');
      return;
    }

    if (!newAsset.textureUrl.trim()) {
      toast.error('Please enter a texture URL');
      return;
    }

    const newAssetId = addAsset({
      name: newAsset.name,
      category: newAsset.category,
      type: newAsset.type,
      description: newAsset.description,
      thumbnailUrl: newAsset.thumbnailUrl || newAsset.textureUrl, // Use texture URL as fallback
      textureUrl: newAsset.textureUrl,
      dimensions: { width: 200, height: 200 }, // Default dimensions
      price: newAsset.price,
      cost: newAsset.cost,
      sku: newAsset.sku,
      supplier: newAsset.supplier,
      color: newAsset.color,
      finish: newAsset.finish,
      physicalRepeatM: newAsset.physicalRepeatM,
      tags: newAsset.tags
    });
    
    toast.success('Asset added successfully');
    setShowAddForm(false);
  };

  const handleDeleteAsset = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteAsset(id);
      toast.success('Asset deleted successfully');
    }
  };

  const handleDuplicateAsset = (id: string) => {
    duplicateAsset(id);
    toast.success('Asset duplicated successfully');
  };

  const handleUseAsset = (id: string) => {
    recordUsage(id);
    toast.success('Asset usage recorded');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading assets: {error}</p>
          <Button onClick={loadAssets} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search assets..."
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select 
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Asset
        </Button>
      </div>

      {/* Add Asset Form */}
      {showAddForm && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
          <h3 className="font-medium text-primary mb-4">Add New Asset</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
                <Input
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  placeholder="Enter asset name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newAsset.category}
                  onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="Trees">Trees</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Lighting">Lighting</option>
                  <option value="Water Features">Water Features</option>
                  <option value="Plants">Plants</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newAsset.description}
                  onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                  placeholder="Enter asset description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-20 resize-none"
                />
              </div>
            </div>
            
            {/* Pricing & Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newAsset.price}
                    onChange={(e) => setNewAsset({ ...newAsset, price: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newAsset.cost}
                    onChange={(e) => setNewAsset({ ...newAsset, cost: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <Input
                  value={newAsset.sku}
                  onChange={(e) => setNewAsset({ ...newAsset, sku: e.target.value })}
                  placeholder="Enter SKU"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <Input
                  value={newAsset.supplier}
                  onChange={(e) => setNewAsset({ ...newAsset, supplier: e.target.value })}
                  placeholder="Enter supplier name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <Input
                    value={newAsset.color}
                    onChange={(e) => setNewAsset({ ...newAsset, color: e.target.value })}
                    placeholder="Enter color"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Finish</label>
                  <Input
                    value={newAsset.finish}
                    onChange={(e) => setNewAsset({ ...newAsset, finish: e.target.value })}
                    placeholder="Enter finish"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Image URLs */}
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texture URL *</label>
              <Input
                value={newAsset.textureUrl}
                onChange={(e) => setNewAsset({ ...newAsset, textureUrl: e.target.value })}
                placeholder="https://example.com/texture.jpg"
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">URL to the main texture image</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
              <Input
                value={newAsset.thumbnailUrl}
                onChange={(e) => setNewAsset({ ...newAsset, thumbnailUrl: e.target.value })}
                placeholder="https://example.com/thumbnail.jpg"
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Optional: URL to a smaller preview image</p>
            </div>
            
            {/* Image Preview */}
            {newAsset.textureUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <img
                    src={newAsset.textureUrl}
                    alt="Texture preview"
                    className="max-w-full max-h-32 object-contain mx-auto rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden text-center text-gray-500 text-sm">
                    <Image className="w-8 h-8 mx-auto mb-2" />
                    <p>Unable to load image preview</p>
                    <p className="text-xs">Please check the URL is correct</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 mt-6">
            <Button onClick={handleAddAsset} disabled={!newAsset.name.trim() || !newAsset.textureUrl.trim()}>
              Add Asset
            </Button>
            <Button onClick={() => setShowAddForm(false)} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
              selectedAsset?.id === asset.id ? 'border-primary bg-primary/5' : 'border-gray-200'
            }`}
            onClick={() => selectAsset(asset.id)}
          >
            {/* Asset Preview */}
            <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
              <img
                src={asset.thumbnailUrl}
                alt={asset.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden w-full h-full flex items-center justify-center text-gray-500">
                <Image className="w-8 h-8" />
              </div>
            </div>

            {/* Asset Info */}
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <h3 className="font-medium text-gray-900">{asset.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {asset.category}
                </Badge>
              </div>
              
              {asset.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{asset.description}</p>
              )}
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{asset.dimensions.width}×{asset.dimensions.height}px</span>
                {asset.price && (
                  <span className="font-medium text-green-600">${asset.price}</span>
                )}
              </div>

              {/* Tags */}
              {asset.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {asset.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {asset.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{asset.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseAsset(asset.id);
                  }}
                  className="flex-1"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Use
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicateAsset(asset.id);
                  }}
                >
                  <Edit className="w-3 h-3" />
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAsset(asset.id, asset.name);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredAssets.length === 0 && (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
          <p className="text-gray-600 mb-4">
            {useUnifiedAssetStore.getState().searchQuery || useUnifiedAssetStore.getState().categoryFilter !== 'All'
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first asset'
            }
          </p>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
          </Button>
        </div>
      )}
    </div>
  );
});

AssetsTab.displayName = 'AssetsTab';