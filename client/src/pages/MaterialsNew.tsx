import { useState, useEffect } from 'react';
import { Search, Plus, Filter, Wrench, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useMaterialsStore } from '../state/materialsStore';
import { AddEditMaterialSheet } from '../components/materials/AddEditMaterialSheet';
import { listMaterialsClient, createMaterialClient } from '../lib/materialsClient';
import { toast } from 'sonner';

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'coping', label: 'Coping' },
  { value: 'waterline_tile', label: 'Waterline Tile' },
  { value: 'interior', label: 'Interior' },
  { value: 'paving', label: 'Paving' },
  { value: 'fencing', label: 'Fencing' },
];

export default function MaterialsNew() {
  const { all, byCategory, upsert, hydrateMerge } = useMaterialsStore();
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'coping' | 'waterline_tile' | 'interior' | 'paving' | 'fencing'>('all');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testMode, setTestMode] = useState(false);
  
  // Get current materials
  const allMaterials = all();

  // Load materials on mount
  useEffect(() => {
    async function loadMaterials() {
      try {
        setLoading(true);
        const materials = await listMaterialsClient();
        hydrateMerge(materials); // Safe merge - won't clobber on empty
        console.log('[materials-new] Loaded', materials.length, 'materials');
      } catch (error: any) {
        console.error('[materials-new] Load failed:', error);
      } finally {
        setLoading(false);
      }
    }
    loadMaterials();
  }, [hydrateMerge]);

  // Get filtered materials
  const filteredMaterials = byCategory(categoryFilter).filter(material =>
    search === '' || 
    material.name.toLowerCase().includes(search.toLowerCase()) ||
    material.sku?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleTestCreate() {
    setTestMode(true);
    try {
      const testMaterial = {
        name: `Test Material ${Date.now()}`,
        category: 'waterline_tile' as const,
        unit: 'm2' as const,
        price: 99.99,
        supplier: 'Test Suite'
      };
      
      console.log('[materials-new] Creating test material:', testMaterial);
      const result = await createMaterialClient(testMaterial);
      
      if (result?.id) {
        upsert(result);
        toast.success(`Test material created: ${result.name}`);
      } else {
        throw new Error('No ID returned from test create');
      }
    } catch (error: any) {
      console.error('[materials-new] Test create failed:', error);
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setTestMode(false);
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Materials Library</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage your pool renovation materials</p>
            </div>
            
            <Button 
              onClick={() => setShowAddSheet(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-add-material"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Material
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search materials..."
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={categoryFilter} onValueChange={(value: any) => setCategoryFilter(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
            <span className="ml-3 text-gray-600">Loading materials...</span>
          </div>
        ) : lastError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="font-medium text-red-800">Error loading materials</span>
            </div>
            <p className="text-red-700 mt-1">{lastError}</p>
          </div>
        ) : filteredMaterials.length === 0 && Object.keys(items).length === 0 ? (
          // Empty state
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Wrench className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No materials yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Start building your materials library by adding pool renovation products with specifications and textures.
            </p>
            <Button 
              onClick={() => setShowAddSheet(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Material
            </Button>
          </div>
        ) : filteredMaterials.length === 0 ? (
          // No search results
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">
              No materials found matching your search.
            </p>
          </div>
        ) : (
          // Materials grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMaterials.map((material) => (
              <div
                key={material.id}
                className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Texture/Thumbnail */}
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-t-lg relative overflow-hidden">
                  {material.textureUrl || material.thumbnailUrl ? (
                    <img
                      src={material.textureUrl || material.thumbnailUrl || ''}
                      alt={material.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Wrench className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="text-xs">
                      {categories.find(c => c.value === material.category)?.label || material.category}
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                    {material.name}
                  </h3>
                  
                  {material.sku && (
                    <p className="text-sm text-gray-500 mb-2">SKU: {material.sku}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div>
                      {material.price && (
                        <p className="font-semibold text-green-600">
                          ${typeof material.price === 'number' ? material.price.toFixed(2) : parseFloat(String(material.price)).toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">per {material.unit}</p>
                    </div>
                    
                    {material.supplier && (
                      <Badge variant="outline" className="text-xs">
                        {material.supplier}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diagnostics (Dev Only) */}
      {import.meta.env.MODE === 'development' && (
        <div className="bg-gray-100 dark:bg-gray-800 border-t mt-8">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-600">
                  API: <code className="bg-gray-200 px-1 rounded">force</code>
                </span>
                <span className="text-gray-600">
                  Materials: <strong>{allMaterials.length}</strong>
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestCreate}
                disabled={testMode}
                className="text-xs"
              >
                {testMode ? 'Testing...' : 'Test Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Sheet */}
      <AddEditMaterialSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
      />
    </div>
  );
}