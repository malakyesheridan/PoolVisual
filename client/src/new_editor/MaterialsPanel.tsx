import { useState, useEffect } from 'react';
import { useMaskStore } from '../maskcore/store';
import { ensureLoaded, getAll, Material, getSourceInfo } from '../materials/registry';

export function MaterialsPanel() {
  const masks = useMaskStore(state => state.masks);
  const selectedId = useMaskStore(state => state.selectedId);
  const activeMaterialId = useMaskStore(state => state.activeMaterialId);
  const setMaterialSettings = useMaskStore(state => state.SET_MATERIAL_SETTINGS);

  const [materials, setMaterials] = useState<Record<string, Material>>({});
  const [loading, setLoading] = useState(true);
  const [sourceInfo, setSourceInfo] = useState<{ type: string; url?: string; error?: string }>({ type: 'loading' });

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

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-sm text-gray-600">Loading materials...</div>
      </div>
    );
  }

  const materialList = Object.values(materials);

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Materials</h3>
          {!loading && (
            <div className="text-xs text-gray-500">
              {Object.keys(materials).length} materials ({sourceInfo.type})
            </div>
          )}
        </div>
      </div>
      
      {/* Scrollable Material Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          {materialList.map((material) => (
            <button
              key={material.id}
              onClick={() => handleMaterialSelect(material.id)}
              className={`p-2 border rounded text-left ${
                activeMaterialId === material.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              {material.thumbnailURL || material.albedoURL ? (
                <img 
                  src={material.thumbnailURL || material.albedoURL} 
                  alt={material.name}
                  className="w-full h-12 object-cover rounded mb-1"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.warn('[MaterialMissingThumbnail]', { id: material.id, name: material.name, thumbnailURL: material.thumbnailURL, albedoURL: material.albedoURL });
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-12 bg-gray-100 rounded mb-1 flex items-center justify-center text-xs text-gray-500">
                  {material.name}
                </div>
              )}
              <div className="text-sm font-medium">{material.name}</div>
              <div className="text-xs text-gray-500">
                {material.category} {material.price && typeof material.price === 'number' && `• $${material.price.toFixed(2)}`}
              </div>
            </button>
          ))}
        </div>
      </div>

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