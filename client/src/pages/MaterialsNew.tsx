import { useState, useEffect } from 'react';
import { Search, Plus, Filter, Wrench, AlertCircle, MoreVertical, Trash2, Edit } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { AddEditMaterialSheet } from '../components/materials/AddEditMaterialSheet';
import { listMaterialsClient, createMaterialClient, deleteMaterialClient } from '../lib/materialsClient';
import { toast } from 'sonner';
import { ensureLoaded, getAll, Material as UnifiedMaterial, getSourceInfo } from '../materials/registry';
import { useMaterialsStore } from '../state/materialsStore';
import { materialsEventBus } from '../lib/materialsEventBus';
import { getProxiedTextureUrl } from '../lib/textureProxy';

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'coping', label: 'Coping' },
  { value: 'waterline_tile', label: 'Waterline Tile' },
  { value: 'interior', label: 'Interior' },
  { value: 'paving', label: 'Paving' },
  { value: 'fencing', label: 'Fencing' },
];

export default function MaterialsNew() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'coping' | 'waterline_tile' | 'interior' | 'paving' | 'fencing'>('all');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<UnifiedMaterial | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [materials, setMaterials] = useState<Record<string, UnifiedMaterial>>({});
  const [sourceInfo, setSourceInfo] = useState<{ type: string; url?: string; error?: string }>({ type: 'loading' });
  
  // Use materials store for CRUD operations
  const { items: storeMaterials, hydrateMerge, upsert, delete: deleteFromStore } = useMaterialsStore();
  
  // Load materials from unified registry
  useEffect(() => {
    async function loadMaterials() {
      try {
        setLoading(true);
        await ensureLoaded();
        const allMaterials = getAll();
        setMaterials(allMaterials);
        setSourceInfo(getSourceInfo());
        
        // Also sync with the legacy store for compatibility
        const materialsArray = Object.values(allMaterials);
        hydrateMerge(materialsArray);
        
        console.log('[MAT/GRID:LOADED]', { count: materialsArray.length });
        console.log('[MaterialsPage] loaded', { 
          count: materialsArray.length, 
          categories: materialsArray.reduce((acc, m) => {
            acc[m.category] = (acc[m.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          source: getSourceInfo().type
        });
      } catch (error: any) {
        console.error('[materials-new] Load failed:', error);
        setSourceInfo({ type: 'ERROR', error: error.message });
      } finally {
        setLoading(false);
      }
    }
    loadMaterials();
  }, [hydrateMerge]);

  // Listen for materials changes from other pages
  useEffect(() => {
    const unsubscribe = materialsEventBus.subscribe((event) => {
      console.log('[MaterialsSync] editor refresh', event);
      // Reload materials when changes occur
      ensureLoaded().then(() => {
        const allMaterials = getAll();
        setMaterials(allMaterials);
        hydrateMerge(Object.values(allMaterials));
      });
    });
    
    return unsubscribe;
  }, [hydrateMerge]);

  // Get filtered materials from unified registry
  const allMaterials = Object.values(materials);
  const filteredMaterials = allMaterials.filter(material => {
    const matchesCategory = categoryFilter === 'all' || material.category === categoryFilter;
    const matchesSearch = search === '' || 
      material.name.toLowerCase().includes(search.toLowerCase()) ||
      material.sku?.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
        // Update store and broadcast change
        upsert(result);
        materialsEventBus.broadcastCreate([result.id]);
        
        // Refresh materials from unified registry
        await ensureLoaded();
        const updatedMaterials = getAll();
        setMaterials(updatedMaterials);
        toast.success(`Test material created: ${result.name}`);
        console.log('[MaterialsPage] create', result);
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

  const handleDelete = async (id: string, name: string) => {
    console.log('[MAT/DELETE:CLICK]', { id });
    console.log('[Materials:Delete:Click]', { id, name });
    
    try {
      await deleteMaterialClient(id);
      console.log('[Materials:Delete:Persist:ok]', { id });
      
      // Update store and broadcast change
      deleteFromStore(id);
      const countAfter = Object.keys(storeMaterials).length - 1;
      console.log('[Materials:Delete:Store]', { id, countAfter });
      
      materialsEventBus.broadcastDelete([id]);
      console.log('[Materials:Delete:Broadcast]', { id });
      
      // Refresh the materials list
      await ensureLoaded();
      const allMaterials = getAll();
      setMaterials(allMaterials);
      
      toast.success(`Deleted "${name}"`);
      console.log('[MaterialsPage] delete', { id });
    } catch (error: any) {
      console.error('[Materials:Delete:Persist:err]', { id, error: error.message });
      toast.error(`Delete failed: ${error.message}`);
    }
  };

  const handleEdit = (material: UnifiedMaterial) => {
    console.log('[MAT/EDIT:CLICK]', { id: material.id });
    setEditingMaterial(material);
    setShowAddSheet(true);
  };

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
              onClick={() => {
                console.log('[MAT/CREATE:CLICK]');
                setShowAddSheet(true);
              }}
              className="bg-primary hover:bg-primary/90 text-white"
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
        ) : filteredMaterials.length === 0 && allMaterials.length === 0 ? (
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
              className="bg-primary hover:bg-primary/90 text-white"
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
                  {material.albedoURL ? (
                    <img
                      src={getProxiedTextureUrl(`${material.albedoURL}?v=${Date.now()}`)}
                      alt={material.name}
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        console.warn('[MaterialMissingThumbnail]', { id: material.id, name: material.name, albedoURL: material.albedoURL });
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Wrench className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {categories.find(c => c.value === material.category)?.label || material.category}
                    </Badge>
                    
                    {/* Actions menu */}
                    <div className="relative group">
                      <button className="p-1 bg-white/80 hover:bg-white rounded shadow-sm">
                        <MoreVertical className="w-3 h-3" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 bg-white rounded shadow-lg border opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={() => handleEdit(material)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ id: material.id, name: material.name })}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
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
                  Source: <code className="bg-gray-200 px-1 rounded">{sourceInfo.type}</code>
                </span>
                <span className="text-gray-600">
                  Materials: <strong>{allMaterials.length}</strong>
                </span>
                {sourceInfo.url && (
                  <span className="text-gray-600">
                    URL: <code className="bg-gray-200 px-1 rounded">{sourceInfo.url}</code>
                  </span>
                )}
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
        onClose={() => {
          setShowAddSheet(false);
          setEditingMaterial(null);
        }}
        initial={editingMaterial}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Material
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Delete <strong>"{deleteConfirm.name}"</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  handleDelete(deleteConfirm.id, deleteConfirm.name);
                  setDeleteConfirm(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}