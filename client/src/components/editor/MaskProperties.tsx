/**
 * Mask Properties Panel
 * Shows material settings, visual controls, and live metrics for selected mask
 */

import React, { useState } from 'react';
import { 
  Package, 
  Settings2, 
  Ruler, 
  Calculator,
  RotateCcw,
  Sun,
  Contrast,
  Scale
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorSlice';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { MaterialPicker } from './MaterialPicker';

export function MaskProperties() {
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  
  const {
    selectedMaskId,
    masks,
    editorState,
    maskMaterials,
    updateMaterialSettings,
    setBandHeight,
    computeMetrics
  } = useEditorStore();

  // Get selected mask
  const selectedMask = selectedMaskId ? masks.find(m => m.id === selectedMaskId) : null;
  if (!selectedMask) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Package className="h-8 w-8 mx-auto mb-2" />
          <p>Select a mask to view properties</p>
        </div>
      </div>
    );
  }

  // Get material settings for this mask
  const materialSettings = maskMaterials[selectedMaskId!] || {
    materialId: '',
    repeatScale: 1.0,
    rotationDeg: 0,
    brightness: 0,
    contrast: 1.0
  };

  // Get metrics for selected mask
  const metrics = computeMetrics(selectedMaskId!);
  const hasCalibration = editorState.calibration && editorState.calibration.pixelsPerMeter > 0;

  const handleMaterialSettingChange = (key: keyof typeof materialSettings, value: number) => {
    updateMaterialSettings(selectedMaskId!, { [key]: value });
  };

  const handleBandHeightChange = (value: string) => {
    const height = parseFloat(value);
    if (!isNaN(height) && height > 0) {
      setBandHeight(selectedMaskId!, height);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Mask Properties</h3>
          <Badge variant="outline" className="text-xs">
            {selectedMask.type.replace('_', ' ')}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          ID: {selectedMask.id.slice(0, 8)}...
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Material Section */}
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="font-medium">Material Assignment</span>
          </div>
          
          {materialSettings.materialId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Current Material</span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowMaterialPicker(true)}
                  data-testid="change-material-button"
                >
                  Change
                </Button>
              </div>
              {/* TODO: Show material info */}
              <div className="text-sm text-gray-600">
                Material ID: {materialSettings.materialId.slice(0, 8)}...
              </div>
            </div>
          ) : (
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => setShowMaterialPicker(true)}
              data-testid="assign-material-button"
            >
              <Package className="h-4 w-4 mr-2" />
              Assign Material
            </Button>
          )}
        </div>

        <Separator />

        {/* Visual Controls */}
        {materialSettings.materialId && (
          <>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                <span className="font-medium">Visual Controls</span>
              </div>

              {/* Repeat Scale */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <Scale className="h-3 w-3" />
                  Repeat Scale
                </Label>
                <Slider
                  value={[materialSettings.repeatScale]}
                  onValueChange={([value]) => handleMaterialSettingChange('repeatScale', value)}
                  min={0.2}
                  max={5.0}
                  step={0.1}
                  className="w-full"
                  data-testid="repeat-scale-slider"
                />
                <div className="text-xs text-gray-500 text-right">
                  {materialSettings.repeatScale.toFixed(1)}x
                </div>
              </div>

              {/* Rotation */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <RotateCcw className="h-3 w-3" />
                  Rotation
                </Label>
                <Slider
                  value={[materialSettings.rotationDeg]}
                  onValueChange={([value]) => handleMaterialSettingChange('rotationDeg', value)}
                  min={-180}
                  max={180}
                  step={1}
                  className="w-full"
                  data-testid="rotation-slider"
                />
                <div className="text-xs text-gray-500 text-right">
                  {materialSettings.rotationDeg}°
                </div>
              </div>

              {/* Brightness */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <Sun className="h-3 w-3" />
                  Brightness
                </Label>
                <Slider
                  value={[materialSettings.brightness]}
                  onValueChange={([value]) => handleMaterialSettingChange('brightness', value)}
                  min={-0.5}
                  max={0.5}
                  step={0.1}
                  className="w-full"
                  data-testid="brightness-slider"
                />
                <div className="text-xs text-gray-500 text-right">
                  {materialSettings.brightness > 0 ? '+' : ''}{materialSettings.brightness.toFixed(1)}
                </div>
              </div>

              {/* Contrast */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <Contrast className="h-3 w-3" />
                  Contrast
                </Label>
                <Slider
                  value={[materialSettings.contrast]}
                  onValueChange={([value]) => handleMaterialSettingChange('contrast', value)}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-full"
                  data-testid="contrast-slider"
                />
                <div className="text-xs text-gray-500 text-right">
                  {materialSettings.contrast.toFixed(1)}x
                </div>
              </div>
            </div>

            <Separator />
          </>
        )}

        {/* Waterline Band Height */}
        {selectedMask.type === 'waterline_band' && (
          <>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                <span className="font-medium">Waterline Settings</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Band Height (meters)</Label>
                <Input
                  type="number"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={selectedMask.band_height_m || 0.3}
                  onChange={(e) => handleBandHeightChange(e.target.value)}
                  className="w-full"
                  data-testid="band-height-input"
                />
                <div className="text-xs text-gray-500">
                  Height of the waterline band area
                </div>
              </div>
            </div>

            <Separator />
          </>
        )}

        {/* Measurements */}
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="font-medium">Measurements</span>
          </div>

          {!hasCalibration && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                Set calibration to view accurate measurements
              </p>
            </div>
          )}

          <div className="space-y-3">
            {/* Area */}
            {selectedMask.type === 'area' && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Area:</span>
                <span className="text-sm font-medium" data-testid="area-measurement">
                  {hasCalibration && metrics.area_m2 
                    ? `${metrics.area_m2.toFixed(2)} m²` 
                    : '—'
                  }
                </span>
              </div>
            )}

            {/* Perimeter */}
            {['linear', 'waterline_band'].includes(selectedMask.type) && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Length:</span>
                <span className="text-sm font-medium" data-testid="perimeter-measurement">
                  {hasCalibration && metrics.perimeter_m 
                    ? `${metrics.perimeter_m.toFixed(2)} lm` 
                    : '—'
                  }
                </span>
              </div>
            )}

            {/* Band Area */}
            {selectedMask.type === 'waterline_band' && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Band Area:</span>
                <span className="text-sm font-medium" data-testid="band-area-measurement">
                  {hasCalibration && metrics.band_area_m2 
                    ? `${metrics.band_area_m2.toFixed(2)} m²` 
                    : '—'
                  }
                </span>
              </div>
            )}

            {/* Estimated Cost */}
            {materialSettings.materialId && hasCalibration && metrics.estimatedCost && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Quantity (effective):</span>
                  <span className="text-sm font-medium" data-testid="quantity-measurement">
                    {metrics.qty_effective?.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Estimated Cost:</span>
                  <span className="text-sm font-medium text-green-600" data-testid="cost-estimate">
                    ${metrics.estimatedCost.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Material Picker Modal */}
      <MaterialPicker
        isOpen={showMaterialPicker}
        onClose={() => setShowMaterialPicker(false)}
        selectedMaskId={selectedMaskId}
      />
    </div>
  );
}