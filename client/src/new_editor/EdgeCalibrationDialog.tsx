import React, { useState, useEffect } from 'react';
import { useEditorStore } from './store';
import { useMaskStore } from '../maskcore/store';
import { Point } from './types';
import { extractMaskEdges, Edge, EdgeMeasurement, validateEdgeMeasurements, calculateAreaWithEdgeCalibration } from './edgeCalibrationUtils';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface EdgeCalibrationDialogProps {
  maskId: string;
  onClose: () => void;
  globalPixelsPerMeter?: number;
}

export function EdgeCalibrationDialog({ maskId, onClose, globalPixelsPerMeter = 100 }: EdgeCalibrationDialogProps) {
  const { calibration, dispatch } = useEditorStore();
  const { masks: maskcoreMasks } = useMaskStore();
  
  // Try to find mask in both stores
  const editorMask = useEditorStore.getState().masks.find(m => m.id === maskId);
  const maskcoreMask = maskcoreMasks[maskId];
  
  // Prefer editor store mask, fallback to maskcore mask
  const mask = editorMask || (maskcoreMask ? {
    id: maskcoreMask.id,
    points: maskcoreMask.pts.map(pt => ({ x: pt.x, y: pt.y })),
    name: maskcoreMask.name,
    customCalibration: maskcoreMask.customCalibration,
    type: maskcoreMask.type || (maskcoreMask.mode === 'polygon' ? 'area' : 'area')
  } : null);
  
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeMeasurements, setEdgeMeasurements] = useState<Map<number, EdgeMeasurement>>(new Map());
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium');
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);
  const [validation, setValidation] = useState<{ isValid: boolean; warnings: string[] } | null>(null);
  const [calculatedArea, setCalculatedArea] = useState<number | null>(null);

  // Use global calibration if available
  const effectiveGlobalPpm = calibration?.pixelsPerMeter || globalPixelsPerMeter;

  useEffect(() => {
    if (mask && mask.points.length >= 2) {
      const isClosed = mask.type !== 'linear';
      const extractedEdges = extractMaskEdges(mask.points, isClosed);
      setEdges(extractedEdges);
      
      // Load existing edge measurements if available
      if (mask.customCalibration?.edgeMeasurements) {
        const existing = new Map<number, EdgeMeasurement>();
        mask.customCalibration.edgeMeasurements.forEach(em => {
          existing.set(em.edgeIndex, em);
        });
        setEdgeMeasurements(existing);
      }
      
      // Set confidence from existing calibration
      if (mask.customCalibration?.confidence) {
        setConfidence(mask.customCalibration.confidence);
      }
    }
  }, [mask]);

  // Update validation and calculated area when measurements change
  useEffect(() => {
    if (mask && edges.length > 0 && edgeMeasurements.size > 0) {
      const measurements = Array.from(edgeMeasurements.values());
      const validationResult = validateEdgeMeasurements(edges, measurements);
      setValidation(validationResult);
      
      // Calculate area preview
      const area = calculateAreaWithEdgeCalibration(mask.points, measurements);
      setCalculatedArea(area);
    } else {
      setValidation(null);
      setCalculatedArea(null);
    }
  }, [mask, edges, edgeMeasurements]);

  const handleEdgeLengthChange = (edgeIndex: number, realWorldLength: string) => {
    const edge = edges.find(e => e.edgeIndex === edgeIndex);
    if (!edge) return;
    
    const length = parseFloat(realWorldLength);
    if (isNaN(length) || length <= 0) {
      // Remove measurement if invalid
      const newMeasurements = new Map(edgeMeasurements);
      newMeasurements.delete(edgeIndex);
      setEdgeMeasurements(newMeasurements);
      return;
    }
    
    const pixelsPerMeter = edge.pixelLength / length;
    const measurement: EdgeMeasurement = {
      edgeIndex,
      pixelLength: edge.pixelLength,
      realWorldLength: length,
      pixelsPerMeter
    };
    
    const newMeasurements = new Map(edgeMeasurements);
    newMeasurements.set(edgeIndex, measurement);
    setEdgeMeasurements(newMeasurements);
    
    // Dispatch event to highlight edge on canvas
    window.dispatchEvent(new CustomEvent('highlight-edge', {
      detail: { maskId, edgeIndex, highlight: true }
    }));
  };

  const handleAutoFillFromGlobal = () => {
    if (!mask) return;
    
    const newMeasurements = new Map<number, EdgeMeasurement>();
    edges.forEach(edge => {
      const realWorldLength = edge.pixelLength / effectiveGlobalPpm;
      newMeasurements.set(edge.edgeIndex, {
        edgeIndex: edge.edgeIndex,
        pixelLength: edge.pixelLength,
        realWorldLength,
        pixelsPerMeter: effectiveGlobalPpm
      });
    });
    setEdgeMeasurements(newMeasurements);
  };

  const handleClearAll = () => {
    setEdgeMeasurements(new Map());
    setCalculatedArea(null);
    setValidation(null);
  };

  const handleSave = () => {
    if (!mask || edgeMeasurements.size === 0) {
      return;
    }
    
    const measurements = Array.from(edgeMeasurements.values());
    const validationResult = validateEdgeMeasurements(edges, measurements);
    
    if (!validationResult.isValid && validationResult.warnings.length > 0) {
      // Still allow save, but show warnings
      console.warn('[EdgeCalibration] Validation warnings:', validationResult.warnings);
    }
    
    const customCalibration = {
      ...mask.customCalibration,
      edgeMeasurements: measurements,
      calibrationMethod: 'manual_edges' as const,
      confidence,
      lastUpdated: Date.now()
    };
    
    // Update in editor store if mask exists there
    if (editorMask) {
      dispatch({
        type: 'UPDATE_MASK',
        payload: {
          id: maskId,
          updates: { customCalibration }
        }
      });
    }
    
    // Also update in maskcore store
    if (maskcoreMask) {
      useMaskStore.setState(prev => ({
        masks: {
          ...prev.masks,
          [maskId]: {
            ...prev.masks[maskId],
            customCalibration
          }
        }
      }));
    }
    
    // Clear edge highlighting
    window.dispatchEvent(new CustomEvent('highlight-edge', {
      detail: { maskId, edgeIndex: null, highlight: false }
    }));
    
    onClose();
  };

  const handleEdgeFocus = (edgeIndex: number) => {
    setHoveredEdgeIndex(edgeIndex);
    window.dispatchEvent(new CustomEvent('highlight-edge', {
      detail: { maskId, edgeIndex, highlight: true }
    }));
  };

  const handleEdgeBlur = () => {
    setHoveredEdgeIndex(null);
    window.dispatchEvent(new CustomEvent('highlight-edge', {
      detail: { maskId, edgeIndex: null, highlight: false }
    }));
  };

  if (!mask) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Manual Edge Calibration: {mask.name || `Mask ${mask.id.slice(-4)}`}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Perspective Correction</p>
              <p>
                Enter the real-world length for each edge. This corrects for perspective distortion 
                where different edges may have different pixel-to-meter ratios.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoFillFromGlobal}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Auto-fill from Global Calibration
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Clear All
            </button>
            {calculatedArea !== null && (
              <div className="ml-auto text-sm text-gray-600">
                Calculated Area: <span className="font-semibold">{calculatedArea.toFixed(2)} m²</span>
              </div>
            )}
          </div>

          {/* Edge Measurements */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Edge Measurements</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {edges.map((edge, idx) => {
                const measurement = edgeMeasurements.get(edge.edgeIndex);
                const isHovered = hoveredEdgeIndex === edge.edgeIndex;
                
                return (
                  <div
                    key={edge.edgeIndex}
                    className={`flex items-center gap-3 p-2 rounded-md border transition-colors ${
                      isHovered ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-shrink-0 w-20 text-xs text-gray-600">
                      Edge {edge.edgeIndex + 1}
                    </div>
                    <div className="flex-shrink-0 w-24 text-xs text-gray-500">
                      {edge.pixelLength.toFixed(0)} px
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">=</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={measurement?.realWorldLength || ''}
                        onChange={(e) => handleEdgeLengthChange(edge.edgeIndex, e.target.value)}
                        onFocus={() => handleEdgeFocus(edge.edgeIndex)}
                        onBlur={handleEdgeBlur}
                        placeholder="meters"
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500">m</span>
                    </div>
                    {measurement && (
                      <div className="flex-shrink-0 w-20 text-xs text-gray-500">
                        {measurement.pixelsPerMeter.toFixed(0)} px/m
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Warnings */}
          {validation && validation.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Validation Warnings</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Confidence Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Level
            </label>
            <div className="flex items-center gap-4">
              {(['high', 'medium', 'low'] as const).map((level) => (
                <label key={level} className="flex items-center">
                  <input
                    type="radio"
                    value={level}
                    checked={confidence === level}
                    onChange={() => setConfidence(level)}
                    className="mr-2"
                  />
                  <span className="text-sm capitalize">{level}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={edgeMeasurements.size === 0}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {validation?.isValid && (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save Calibration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

