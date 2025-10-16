import React, { useState, useEffect } from 'react';
import { useEditorStore } from './store';
import { Mask } from './types';

interface MaskCalibrationDialogProps {
  maskId: string;
  onClose: () => void;
}

export function MaskCalibrationDialog({ maskId, onClose }: MaskCalibrationDialogProps) {
  const { masks, dispatch } = useEditorStore();
  const mask = masks.find(m => m.id === maskId);
  
  const [estimatedLength, setEstimatedLength] = useState<string>('');
  const [estimatedWidth, setEstimatedWidth] = useState<string>('');
  const [calibrationMethod, setCalibrationMethod] = useState<'estimated' | 'reference' | 'auto'>('estimated');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (mask?.customCalibration) {
      setEstimatedLength(mask.customCalibration.estimatedLength?.toString() || '');
      setEstimatedWidth(mask.customCalibration.estimatedWidth?.toString() || '');
      setCalibrationMethod(mask.customCalibration.calibrationMethod);
    }
  }, [mask]);

  const handleSave = () => {
    const length = parseFloat(estimatedLength);
    const width = parseFloat(estimatedWidth);

    if (isNaN(length) || length <= 0) {
      setError('Please enter a valid length');
      return;
    }

    if (isNaN(width) || width <= 0) {
      setError('Please enter a valid width');
      return;
    }

    // Calculate confidence based on input method
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (calibrationMethod === 'reference') confidence = 'high';
    else if (calibrationMethod === 'auto') confidence = 'low';

    const customCalibration = {
      estimatedLength: length,
      estimatedWidth: width,
      calibrationMethod,
      confidence,
      lastUpdated: Date.now()
    };

    dispatch({
      type: 'UPDATE_MASK',
      payload: {
        id: maskId,
        updates: { customCalibration }
      }
    });

    onClose();
  };

  const handleAutoEstimate = () => {
    // Simple auto-estimation based on mask area
    if (mask && mask.points.length >= 3) {
      // Calculate bounding box
      const xs = mask.points.map(p => p.x);
      const ys = mask.points.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      
      const pixelWidth = maxX - minX;
      const pixelHeight = maxY - minY;
      
      // Estimate based on common pool dimensions
      // This is a rough estimation - in practice, you'd use more sophisticated algorithms
      const estimatedWidthMeters = Math.max(1, pixelWidth / 100); // Rough estimate
      const estimatedLengthMeters = Math.max(1, pixelHeight / 100); // Rough estimate
      
      setEstimatedLength(estimatedLengthMeters.toFixed(1));
      setEstimatedWidth(estimatedWidthMeters.toFixed(1));
      setCalibrationMethod('auto');
    }
  };

  if (!mask) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Calibrate Mask: {mask.name || `Mask ${mask.id.slice(-4)}`}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calibration Method
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="estimated"
                  checked={calibrationMethod === 'estimated'}
                  onChange={(e) => setCalibrationMethod(e.target.value as any)}
                  className="mr-2"
                />
                <span className="text-sm">Manual Estimate</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="reference"
                  checked={calibrationMethod === 'reference'}
                  onChange={(e) => setCalibrationMethod(e.target.value as any)}
                  className="mr-2"
                />
                <span className="text-sm">Reference Object</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="auto"
                  checked={calibrationMethod === 'auto'}
                  onChange={(e) => setCalibrationMethod(e.target.value as any)}
                  className="mr-2"
                />
                <span className="text-sm">Auto Estimate</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Length (meters)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={estimatedLength}
                onChange={(e) => setEstimatedLength(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 5.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Width (meters)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={estimatedWidth}
                onChange={(e) => setEstimatedWidth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 3.0"
              />
            </div>
          </div>

          {calibrationMethod === 'auto' && (
            <button
              onClick={handleAutoEstimate}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Auto Estimate Dimensions
            </button>
          )}

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Save Calibration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
