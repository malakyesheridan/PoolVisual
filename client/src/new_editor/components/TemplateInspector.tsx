/**
 * Template Inspector - Phase 2 Parametric Controls
 * Shows live mm→px controls for template section widths (waterline, coping, paving)
 */

import React, { useMemo } from 'react';
import { useUnifiedTemplateStore } from '../../stores/unifiedTemplateStore';
import { useMaskStore } from '../../maskcore/store';
import { useEditorStore } from '../store';
import { Slider } from '../../components/ui/slider';
import { Gauge, Info } from 'lucide-react';

interface TemplateInspectorProps {
  className?: string;
}

export function TemplateInspector({ className = '' }: TemplateInspectorProps) {
  const maskStore = useMaskStore();
  const templateStore = useUnifiedTemplateStore();
  const editorStore = useEditorStore();

  // Get selected mask
  const selectedMask = maskStore.selectedId ? maskStore.masks[maskStore.selectedId] : null;
  
  // Get template group ID from selected mask or the most recent active group
  const groupId = useMemo(() => {
    if (selectedMask?.templateGroupId) {
      return selectedMask.templateGroupId;
    }
    
    // Fall back to most recent group
    const activeGroups = Object.values(templateStore.activeTemplateGroups);
    if (activeGroups.length > 0) {
      const mostRecent = activeGroups.sort((a, b) => 
        b.lastModified - a.lastModified
      )[0];
      return mostRecent.templateGroupId;
    }
    
    return null;
  }, [selectedMask, templateStore.activeTemplateGroups]);

  // Get params for this group
  const params = groupId ? templateStore.getTemplateGroupParams(groupId) : null;
  
  // Get template info
  const template = params ? templateStore.templates[params.templateId] : null;
  
  // Get calibration
  const calibration = editorStore.calibration;
  const pixelsPerMeter = calibration?.pixelsPerMeter;
  const hasCalibration = pixelsPerMeter !== undefined && pixelsPerMeter > 0;

  // Check if regeneration is in progress (debounce active)
  const isRegenerating = groupId && templateStore.debounceTimers[groupId] !== undefined;

  // Compact hint when no group
  if (!groupId || !params) {
    return (
      <div className={`border-t bg-gray-50 ${className}`}>
        <div className="p-3 text-center text-sm text-gray-500">
          Apply a multi-section template to edit waterline/coping/paving
        </div>
      </div>
    );
  }

  // Convert mm to px for display
  const mmToPx = (mm: number): number => {
    if (hasCalibration) {
      return (mm / 1000) * pixelsPerMeter!;
    }
    return mm / 10; // Fallback
  };

  // Validation ranges
  const ranges = {
    waterline: { min: 60, max: 300 },
    coping: { min: 100, max: 400 },
    paving: { min: 300, max: 2000 }
  };

  const handleWidthChange = (section: 'waterline' | 'coping' | 'paving', value: number) => {
    // Clamp to valid range
    const range = ranges[section];
    const clamped = Math.max(range.min, Math.min(range.max, value));
    
    templateStore.setTemplateGroupWidth(groupId, section, clamped);
  };

  return (
    <div className={`border-t bg-gray-50 ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <h4 className="font-medium text-sm">Template Sections</h4>
          </div>
          {hasCalibration && (
            <div className="text-xs text-gray-500">
              1 mm = {(pixelsPerMeter / 1000).toFixed(2)} px
            </div>
          )}
        </div>
        {template && (
          <div className="text-sm text-gray-600 mb-3">
            {template.name}
          </div>
        )}

        {/* Calibration status */}
        {!hasCalibration && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs flex items-center gap-2 text-yellow-800">
            <Info className="w-3 h-3" />
            Using px fallback (no calibration)
          </div>
        )}

        {/* Waterline Control */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Waterline Width</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={params.widthsMm.waterline}
                onChange={(e) => handleWidthChange('waterline', parseFloat(e.target.value) || 150)}
                min={ranges.waterline.min}
                max={ranges.waterline.max}
                disabled={isRegenerating}
                className="w-16 px-2 py-1 text-sm border rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500">mm</span>
            </div>
          </div>
          <Slider
            value={[params.widthsMm.waterline]}
            min={ranges.waterline.min}
            max={ranges.waterline.max}
            step={10}
            onValueChange={(value) => handleWidthChange('waterline', value[0])}
            disabled={isRegenerating}
            className="mb-1"
          />
          <div className="text-xs text-gray-500">
            Effective: {mmToPx(params.widthsMm.waterline).toFixed(1)} px
            {hasCalibration ? ` @ ${(pixelsPerMeter / 1000).toFixed(2)} mm/px` : ' (uncalibrated)'}
          </div>
        </div>

        {/* Coping Control */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Coping Width</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={params.widthsMm.coping}
                onChange={(e) => handleWidthChange('coping', parseFloat(e.target.value) || 200)}
                min={ranges.coping.min}
                max={ranges.coping.max}
                disabled={isRegenerating}
                className="w-16 px-2 py-1 text-sm border rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500">mm</span>
            </div>
          </div>
          <Slider
            value={[params.widthsMm.coping]}
            min={ranges.coping.min}
            max={ranges.coping.max}
            step={10}
            onValueChange={(value) => handleWidthChange('coping', value[0])}
            disabled={isRegenerating}
            className="mb-1"
          />
          <div className="text-xs text-gray-500">
            Effective: {mmToPx(params.widthsMm.coping).toFixed(1)} px
            {hasCalibration ? ` @ ${(pixelsPerMeter / 1000).toFixed(2)} mm/px` : ' (uncalibrated)'}
          </div>
        </div>

        {/* Paving Control */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Paving Width</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={params.widthsMm.paving}
                onChange={(e) => handleWidthChange('paving', parseFloat(e.target.value) || 600)}
                min={ranges.paving.min}
                max={ranges.paving.max}
                disabled={isRegenerating}
                className="w-16 px-2 py-1 text-sm border rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500">mm</span>
            </div>
          </div>
          <Slider
            value={[params.widthsMm.paving]}
            min={ranges.paving.min}
            max={ranges.paving.max}
            step={50}
            onValueChange={(value) => handleWidthChange('paving', value[0])}
            disabled={isRegenerating}
            className="mb-1"
          />
          <div className="text-xs text-gray-500">
            Effective: {mmToPx(params.widthsMm.paving).toFixed(1)} px
            {hasCalibration ? ` @ ${(pixelsPerMeter / 1000).toFixed(2)} mm/px` : ' (uncalibrated)'}
          </div>
        </div>

        {/* Status summary */}
        <div className="mt-4 p-2 bg-white border rounded text-xs text-gray-600">
          <div>Section widths: {Object.values(params.widthsMm).join(', ')} mm</div>
          {hasCalibration && (
            <div className="mt-1">Calibration: {pixelsPerMeter.toFixed(0)} px/m</div>
          )}
        </div>
      </div>
    </div>
  );
}

