import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, Plus, Filter, Wrench, MoreVertical, Trash2, Edit } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { AddEditMaterialSheet } from '../../components/materials/AddEditMaterialSheet';
import { listMaterialsClient, createMaterialClient, deleteMaterialClient } from '../../lib/materialsClient';
import { toast } from 'sonner';
import { ensureLoaded, getAll, Material as UnifiedMaterial, getSourceInfo } from '../../materials/registry';
import { useMaterialsStore } from '../../state/materialsStore';
import { materialsEventBus } from '../../lib/materialsEventBus';
import { getProxiedTextureUrl } from '../../lib/textureProxy';

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'coping', label: 'Coping' },
  { value: 'waterline_tile', label: 'Waterline Tile' },
  { value: 'interior', label: 'Interior' },
  { value: 'paving', label: 'Paving' },
  { value: 'fencing', label: 'Fencing' },
];

export const MaterialsTab = forwardRef<{ triggerAdd: () => void }, {}>((props, ref) => {
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
  
  // Expose triggerAdd function to parent component
  useImperativeHandle(ref, () => ({
    triggerAdd: () => {
      setShowAddSheet(true);
      setEditingMaterial(null);
    }
  }));
  
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
        console.log('[MaterialsTab] loaded', { 
          count: materialsArray.length, 
          categories: materialsArray.reduce((acc, m) => {
            acc[m.category] = (acc[m.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          source: getSourceInfo().type
        });
      } catch (error: any) {
        console.error('[materials-tab] Load failed:', error);
        setSourceInfo({ type: 'ERROR', error: error.message });
      } finally {
        setLoading(false);
      }
    }
    loadMaterials();
  }, [hydrateMerge]);

  // Listen for materials changes from other pages
  useEffect(() => {
    const unsubscribe = materialsEventBus.subscribe(async (event) => {
      console.log('[MaterialsTab] Materials changed, refreshing...', event);
      await ensureLoaded();
      const allMaterials = getAll();
      setMaterials(allMaterials);
    });

    return unsubscribe;
  }, []);

  // Filter materials based on search and category
  const allMaterials = materials && typeof materials === 'object' ? Object.values(materials) : [];
  const filteredMaterials = (allMaterials || []).filter(material => {
    const matchesSearch = !search || 
      material.name.toLowerCase().includes(search.toLowerCase()) ||
      material.sku?.toLowerCase().includes(search.toLowerCase()) ||
      material.supplier?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || material.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const handleTestCreate = async () => {
    if (testMode) return;
    
    setTestMode(true);
    try {
      const testMaterial = {
        name: `Test Material ${Date.now()}`,
        sku: `TEST-${Date.now()}`,
        category: 'waterline_tile' as const,
        unit: 'm2' as const,
        price: 99.99,
        supplier: 'Test Suite'
      };
      
      console.log('[materials-tab] Creating test material:', testMaterial);
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
        console.log('[MaterialsTab] create', result);
      } else {
        throw new Error('No ID returned from test create');
      }
    } catch (error: any) {
      console.error('[materials-tab] Test create failed:', error);
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
      console.log('[MaterialsTab] delete', { id });
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
    <div className="space-y-6">
      {/* Search + Filters Bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="relative flex-1 min-w-[200px]">
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

      {/* Content */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
            <span className="ml-3 text-gray-600">Loading materials...</span>
          </div>
        ) : filteredMaterials.length === 0 && allMaterials.length === 0 ? (
          // Empty state
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Wrench className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No materials yet
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start building your materials library by adding pool renovation products with specifications and textures.
            </p>
            <Button 
              onClick={() => setShowAddSheet(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Material
            </Button>
          </div>
        ) : filteredMaterials.length === 0 ? (
          // No search results
          <div className="text-center py-12">
            <p className="text-gray-600">
              No materials found matching your search.
            </p>
          </div>
        ) : (
          // Materials grid
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
            {Array.isArray(filteredMaterials) && filteredMaterials.length > 0 ? filteredMaterials.map((material) => (
              <div
                key={material.id}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)] hover:border-slate-300 transition-colors transition-shadow"
              >
                {/* Texture/Thumbnail */}
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  {material.albedoURL ? (
                    <img
                      src={getProxiedTextureUrl(`${material.albedoURL}?v=${Date.now()}`)}
                      alt={material.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
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
                  
                  {/* Category pill + kebab alignment */}
                  <div className="pointer-events-none absolute inset-x-0 top-3 flex items-start justify-between px-3">
                    <Badge 
                      variant="secondary" 
                      className="inline-flex items-center rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white shadow-sm pointer-events-auto"
                    >
                      {categories.find(c => c.value === material.category)?.label || material.category}
                    </Badge>
                    
                    {/* Actions menu */}
                    <div className="relative group pointer-events-auto">
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
                <div className="flex flex-col gap-1 px-4 py-3">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
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
            )) : null}
          </div>
        )}
      </div>

      {/* Diagnostics (Dev Only) */}
      {import.meta.env.MODE === 'development' && (
        <div className="bg-gray-100 border-t mt-8">
          <div className="py-3">
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
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Material
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone.
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
});

MaterialsTab.displayName = 'MaterialsTab';
