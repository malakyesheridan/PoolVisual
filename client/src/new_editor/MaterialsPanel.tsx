import { useState, useEffect } from 'react';
import { useMaskStore } from '../maskcore/store';
import { ensureLoaded, getAll, Material, getSourceInfo } from '../materials/registry';
import { getProxiedTextureUrl } from '../lib/textureProxy';
import { createPoolSectionOffset } from './poolSectionOffset';
import { useEditorStore } from './store';
import { validateInteriorMask } from './pools/validation';
import { BatchSectionCreator } from './pools/BatchSectionCreator';
import { createJob } from '../services/aiEnhancement';
import { useEnhancementStore } from '../state/useEnhancementStore';
import { useJobStream } from '../hooks/useJobStream';

export function MaterialsPanel() {
  const masks = useMaskStore(state => state.masks);
  const selectedId = useMaskStore(state => state.selectedId);
  const activeMaterialId = useMaskStore(state => state.activeMaterialId);
  const setMaterialSettings = useMaskStore(state => state.SET_MATERIAL_SETTINGS);

  const [materials, setMaterials] = useState<Record<string, Material>>({});
  const [loading, setLoading] = useState(true);
  const [sourceInfo, setSourceInfo] = useState<{ type: string; url?: string; error?: string }>({ type: 'loading' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // AI Enhancement integration
  const upsertJob = useEnhancementStore(s => s.upsertJob);
  const [activeJobId, setActiveJobId] = useState<string | undefined>(undefined);
  useJobStream(activeJobId);

  // Load materials from unified registry
  useEffect(() => {
    ensureLoaded().then(() => {
      const allMaterials = getAll();
      setMaterials(allMaterials);
      setSourceInfo(getSourceInfo());
      setLoading(false);
      
      // Diagnostic logging
      console.log('[MaterialsLoaded]', { 
        count: Object.keys(allMaterials).length, 
        sampleIds: Object.keys(allMaterials).slice(0, 3),
        source: getSourceInfo().type
      });
    }).catch(err => {
      console.warn('[MaterialsPanel] failed to load materials', err);
      setLoading(false);
      setSourceInfo({ type: 'ERROR', error: err.message });
    });
  }, []);

  const selectedMask = selectedId ? masks[selectedId] : null;
  const materialSettings = selectedMask?.materialSettings || {};

  const handleMaterialSelect = (materialId: string) => {
    console.log('[ED/ASSIGN]', { maskId: selectedId, materialId });
    console.log('[Editor:AssignMaterial]', { maskId: selectedId, materialId });
    
    const material = materials[materialId];
    const allMats = Object.keys(materials);
    console.log('[ED/MAT:LOOKUP]', { materialId, found: !!material });
    console.log('[Editor:MaterialLookup]', { materialId, found: !!material, keys: allMats.length });
    
    if (!material) {
      console.warn('[MaterialSelectError] material not found:', materialId);
      return;
    }

    // Check for missing texture
    if (!material.albedoURL) {
      console.warn('[MaterialMissingTexture]', { id: materialId, name: material.name });
    }

    const s = useMaskStore.getState();
    s.SET_ACTIVE_MATERIAL(materialId);
    if (s.selectedId) {
      s.ASSIGN_MATERIAL(s.selectedId, materialId);
      console.log('[ASSIGN_MATERIAL]', { maskId: s.selectedId, materialId });
    } else {
      console.log('[MaterialSelectIgnored] no selected mask');
    }
  };

  const handleSliderChange = (setting: string, value: number) => {
    if (!selectedId) return;
    setMaterialSettings(selectedId, { [setting]: value });
    console.log('[SET_MATERIAL_SETTINGS]', { maskId: selectedId, setting, value });
  };

  const handleVersionToggle = () => {
    if (!selectedId) return;
    const currentVersion = materialSettings.underwaterVersion || 'v1';
    const newVersion = currentVersion === 'v1' ? 'v2' : 'v1';
    setMaterialSettings(selectedId, { underwaterVersion: newVersion });
    console.log('[UnderwaterVersion]', { maskId: selectedId, version: newVersion });
  };

  const handleResetSettings = () => {
    if (!selectedId) return;
    // Reset to defaults
    setMaterialSettings(selectedId, {
      opacity: 70,
      tint: 55,
      edgeFeather: 0,
      intensity: 50,
      textureScale: 100,
      blend: 65,
      refraction: 25,
      edgeSoftness: 6,
      depthBias: 35,
      highlights: 20,
      ripple: 0,
      materialOpacity: 85,
      contactOcclusion: 9,
      textureBoost: 20,
      underwaterVersion: 'v1',
      meniscus: 32,
      softness: 0
    });
    console.log('[ResetMaterialSettings]', { maskId: selectedId });
  };

  // Pool section handlers
  const CREATE_MASK = useMaskStore(state => state.CREATE_MASK);
  const { calibration } = useEditorStore();
  
  // Memoize pool status check - only allow sections on root pool interior (not child sections)
  const isPoolInterior = selectedMask?.isPoolSection === true && 
    selectedMask?.poolSectionType === 'interior' &&
    !selectedMask?.parentPoolId;
  
  // Check which sections have already been created for this pool
  const existingSections = Object.values(masks).filter(m => 
    m.parentPoolId === selectedId && m.isPoolSection
  );
  const createdSectionTypes = new Set(
    existingSections.map(m => m.poolSectionType).filter(Boolean)
  );
  
  // State for batch section creation
  const [showBatchCreator, setShowBatchCreator] = useState(false);
  const [isCreatingSections, setIsCreatingSections] = useState(false);
  const [batchConfig, setBatchConfig] = useState({
    waterline: { enabled: true, widthMm: 150 },
    coping: { enabled: true, widthMm: 200 },
    paving: { enabled: true, widthMm: 600 }
  });

  const handleAddSection = (sectionType: 'waterline' | 'coping' | 'paving') => {
    if (!selectedId || !selectedMask) return;
    
    // Prevent: Don't allow adding sections to already-child sections
    if (selectedMask.parentPoolId) {
      console.warn('[AddSection] Cannot add sections to child masks', { 
        maskId: selectedId, 
        parentPoolId: selectedMask.parentPoolId 
      });
      alert('Please select the original pool interior to add sections.');
      return;
    }
    
    try {
      const pixelsPerMeter = calibration.pixelsPerMeter || undefined;
      const offsetPoints = createPoolSectionOffset(
        selectedMask.pts,
        sectionType,
        pixelsPerMeter
      );
      
      if (offsetPoints.length < 3) {
        console.warn('[AddSection] Section too small', { sectionType, baseMask: selectedId });
        alert('Section too small - pool interior must be larger');
        return;
      }
      
      // Get the original pool name (clean name without cascading)
      const basePoolName = selectedMask.name || 'Pool';
      const sectionName = `${basePoolName} - ${sectionType}`;
      const newId = `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      CREATE_MASK(
        offsetPoints,
        'area',
        newId,
        sectionName,
        {
          isPoolSection: true,
          poolSectionType: sectionType,
          parentPoolId: selectedId
        }
      );
      
      console.log('[AddSection] Success', { section: sectionType, baseMask: selectedId, newMaskId: newId });
    } catch (error) {
      console.error('[AddSection] Failed to create section', { error, sectionType, baseMask: selectedId });
      alert(`Failed to create ${sectionType} section. Please try again.`);
    }
  };

  const handleBatchCreate = () => {
    if (!selectedId || !selectedMask) return;

    // Validate interior
    const validation = validateInteriorMask(selectedMask);
    if (!validation.isValid) {
      alert('Invalid pool interior: ' + validation.errors.join(', '));
      return;
    }

    // Start batch creation
    setIsCreatingSections(true);
    setShowBatchCreator(true);
  };

  const handleBatchComplete = () => {
    setShowBatchCreator(false);
    setIsCreatingSections(false);
    setBatchConfig({
      waterline: { enabled: true, widthMm: 150 },
      coping: { enabled: true, widthMm: 200 },
      paving: { enabled: true, widthMm: 600 }
    });
  };

  const handleBatchError = (error: string) => {
    alert(error);
    setShowBatchCreator(false);
    setIsCreatingSections(false);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-sm text-gray-600">Loading materials...</div>
      </div>
    );
  }

  // Filter materials based on search and category
  const filteredMaterials = Object.values(materials).filter(material => {
    const matchesSearch = !searchTerm || material.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(Object.values(materials).map(m => m.category)))].filter(Boolean);

  // Test AI Enhancement function
  async function startTestJob() {
    // Get current canvas image URL from store
    const currentState = useEditorStore.getState();
    const currentImageUrl = currentState.imageUrl;
    const photoSpace = currentState.photoSpace;
    
    if (!currentImageUrl) {
      alert('Please load an image in the canvas first');
      return;
    }
    
    // Get effective photo ID if available from job context
    const effectivePhotoId = currentState.jobContext?.photoId || '134468b9-648e-4eb1-8434-d7941289fccf';
    
    const payload = {
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      photoId: effectivePhotoId,
      imageUrl: currentImageUrl, // Use canvas image, not hardcoded
      inputHash: `ui-demo-hash-${Date.now()}`,
      masks: [],
      options: {},
      calibration: 1000,
      width: photoSpace.imgW || 2000,
      height: photoSpace.imgH || 1500,
      idempotencyKey: `ui-demo-ik-${Date.now()}`
    };

    try {
      const { jobId } = await createJob(payload);
      upsertJob({ id: jobId, status: 'queued', progress_percent: 0 });
      setActiveJobId(jobId);
    } catch (error: any) {
      console.error('Failed to create job:', error);
      alert(`Failed: ${error.message}`);
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 border-b border-gray-100 bg-white">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Materials</h3>
            {!loading && (
              <div className="text-xs text-gray-500">
                {filteredMaterials.length} of {Object.keys(materials).length}
              </div>
            )}
          </div>
          
          {/* Search */}
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4 transition-all duration-150"
            aria-label="Search materials"
          />
          
          {/* Category filter - Pill Style */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  selectedCategory === category
                    ? 'bg-blue-50 text-blue-700 border border-blue-300 shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                }`}
                aria-label={`Filter by ${category === 'all' ? 'all categories' : category}`}
                aria-pressed={selectedCategory === category}
              >
                {category === 'all' ? 'All' : category.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Contextual Message */}
      {!selectedId && (
        <div className="flex-shrink-0 p-6 border-b border-gray-100 bg-blue-50">
          <div className="text-sm text-blue-700">
            <strong>Select a mask</strong> to assign materials
          </div>
        </div>
      )}
      
      {/* Scrollable Material Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredMaterials.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-sm">No materials found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredMaterials.map((material) => {
              const imageUrl = material.thumbnailURL || material.albedoURL;
              const proxiedUrl = imageUrl ? getProxiedTextureUrl(imageUrl) : null;
              
              return (
                <button
                  key={material.id}
                  onClick={() => handleMaterialSelect(material.id)}
                  className={`p-2 border rounded-xl text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    activeMaterialId === material.id 
                      ? 'border-blue-500 bg-blue-50 shadow-md scale-100' 
                      : 'border-gray-200 hover:scale-[1.02] hover:shadow-md hover:border-gray-300'
                  }`}
                  aria-label={`Select material: ${material.name}`}
                  aria-pressed={activeMaterialId === material.id}
                >
                  {proxiedUrl ? (
                    <img 
                      src={proxiedUrl} 
                      alt={material.name}
                      className="w-full h-14 object-cover rounded-lg"
                      loading="lazy"
                      onError={(e) => {
                        console.warn('[MaterialMissingThumbnail]', { id: material.id, name: material.name });
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-14 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500">
                      No Image
                    </div>
                  )}
                  <div 
                    className="text-xs font-medium line-clamp-2 mt-1 leading-tight text-gray-900" 
                    title={material.name}
                  >
                    {material.name}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedMask && isPoolInterior && (
        <div className="flex-shrink-0 p-4 bg-blue-50 border-t border-b border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-blue-900">Quick Sections</span>
            <span className="text-xs text-blue-600">({selectedMask.poolSectionType})</span>
          </div>
          
          {/* Batch Create Button */}
          {!createdSectionTypes.has('waterline') && !createdSectionTypes.has('coping') && !createdSectionTypes.has('paving') && (
            <button
              onClick={handleBatchCreate}
              disabled={isCreatingSections}
              className="w-full mb-3 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              title="Creates waterline, coping and paving in one go (uses calibration for exact widths)"
            >
              {isCreatingSections ? 'Creating...' : 'Create All Sections (Batch)'}
            </button>
          )}
          
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleAddSection('waterline')}
              disabled={createdSectionTypes.has('waterline')}
              className={`px-2 py-1.5 text-xs rounded transition-all ${
                createdSectionTypes.has('waterline')
                  ? 'bg-gray-100 text-gray-500 border border-gray-300 cursor-not-allowed'
                  : 'bg-white text-blue-700 hover:bg-blue-100 border border-blue-300'
              }`}
            >
              {createdSectionTypes.has('waterline') ? '✓ Waterline' : '+ Waterline'}<br/>
              <span className="text-[10px]">150mm inward</span>
            </button>
            <button
              onClick={() => handleAddSection('coping')}
              disabled={createdSectionTypes.has('coping')}
              className={`px-2 py-1.5 text-xs rounded transition-all ${
                createdSectionTypes.has('coping')
                  ? 'bg-gray-100 text-gray-500 border border-gray-300 cursor-not-allowed'
                  : 'bg-white text-amber-700 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              {createdSectionTypes.has('coping') ? '✓ Coping' : '+ Coping'}<br/>
              <span className="text-[10px]">200mm outward</span>
            </button>
            <button
              onClick={() => handleAddSection('paving')}
              disabled={createdSectionTypes.has('paving')}
              className={`px-2 py-1.5 text-xs rounded transition-all ${
                createdSectionTypes.has('paving')
                  ? 'bg-gray-100 text-gray-500 border border-gray-300 cursor-not-allowed'
                  : 'bg-white text-green-700 hover:bg-green-100 border border-green-300'
              }`}
            >
              {createdSectionTypes.has('paving') ? '✓ Paving' : '+ Paving'}<br/>
              <span className="text-[10px]">600mm outward</span>
            </button>
          </div>
        </div>
      )}

      {/* Batch Section Creator */}
      {showBatchCreator && selectedId && (
        <BatchSectionCreator
          interiorMaskId={selectedId}
          sections={batchConfig}
          onComplete={handleBatchComplete}
          onError={handleBatchError}
        />
      )}

      {/* Fixed Material Settings Section */}
      <div className="flex-shrink-0 border-t bg-white">
        {selectedMask ? (
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Control Bar */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h4 className="font-medium text-gray-900">Material Settings</h4>
              <div className="flex gap-2">
                <button
                  onClick={handleVersionToggle}
                  className={`px-2 py-1 text-xs rounded ${
                    (materialSettings.underwaterVersion || 'v1') === 'v1' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {(materialSettings.underwaterVersion || 'v1').toUpperCase()}
                </button>
                <button
                  onClick={handleResetSettings}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Common Settings */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700 border-b pb-1">Common</h5>
              
              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Opacity: {materialSettings.opacity ?? 70}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.opacity ?? 70}
                  onChange={(e) => handleSliderChange('opacity', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Tint: {materialSettings.tint ?? 55}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.tint ?? 55}
                  onChange={(e) => handleSliderChange('tint', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Edge Feather: {materialSettings.edgeFeather ?? 0}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={materialSettings.edgeFeather ?? 0}
                  onChange={(e) => handleSliderChange('edgeFeather', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Intensity: {materialSettings.intensity ?? 50}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.intensity ?? 50}
                  onChange={(e) => handleSliderChange('intensity', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Texture Scale: {materialSettings.textureScale ?? 100}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={materialSettings.textureScale ?? 100}
                  onChange={(e) => handleSliderChange('textureScale', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Underwater V1/V1.5/V1.6 Settings */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700 border-b pb-1">Underwater V1</h5>
              
              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Blend: {materialSettings.blend ?? 65}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.blend ?? 65}
                  onChange={(e) => handleSliderChange('blend', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Refraction: {materialSettings.refraction ?? 25}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.refraction ?? 25}
                  onChange={(e) => handleSliderChange('refraction', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Edge Softness: {materialSettings.edgeSoftness ?? 6}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={materialSettings.edgeSoftness ?? 6}
                  onChange={(e) => handleSliderChange('edgeSoftness', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Depth Bias: {materialSettings.depthBias ?? 35}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.depthBias ?? 35}
                  onChange={(e) => handleSliderChange('depthBias', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Highlights: {materialSettings.highlights ?? 20}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.highlights ?? 20}
                  onChange={(e) => handleSliderChange('highlights', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Ripple: {materialSettings.ripple ?? 0}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.ripple ?? 0}
                  onChange={(e) => handleSliderChange('ripple', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Material Opacity: {materialSettings.materialOpacity ?? 85}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.materialOpacity ?? 85}
                  onChange={(e) => handleSliderChange('materialOpacity', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Contact Occlusion: {materialSettings.contactOcclusion ?? 9}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.contactOcclusion ?? 9}
                  onChange={(e) => handleSliderChange('contactOcclusion', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Texture Boost: {materialSettings.textureBoost ?? 20}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={materialSettings.textureBoost ?? 20}
                  onChange={(e) => handleSliderChange('textureBoost', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Underwater V2 Settings */}
            {(materialSettings.underwaterVersion || 'v1') === 'v2' && (
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-gray-700 border-b pb-1">Underwater V2</h5>
                
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Meniscus: {materialSettings.meniscus ?? 32}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={materialSettings.meniscus ?? 32}
                    onChange={(e) => handleSliderChange('meniscus', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Softness: {materialSettings.softness ?? 0}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={materialSettings.softness ?? 0}
                    onChange={(e) => handleSliderChange('softness', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <div className="text-sm text-gray-500 text-center py-4">
              Select a mask to apply material settings
            </div>
          </div>
        )}
      </div>
    </div>
  );
}